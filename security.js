"use strict";
// Financial data never leave the browser. Only an authenticated encrypted envelope is persisted.
const KasboekSecurity = (() => {
  const VAULT_KEY = 'kasboek:vault:v1', ITERATIONS = 600000;
  const MAX_BYTES = 2 * 1024 * 1024;
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal:true});
  let key, salt, snapshot = Object.create(null), queue = Promise.resolve();
  let pending = 0, failed = false, currentEnvelope = null, sessionActive = false, rememberUntil = 0;
  const invalid = () => { throw new Error('De back-up bevat ongeldige of te veel gegevens. Er is niets gewijzigd.'); };
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype,null].includes(Object.getPrototypeOf(x));
  const fields = (x, allowed) => { if (!object(x) || Object.keys(x).some(k => !allowed.includes(k))) invalid(); };
  const str = (v, max = 500) => { if (typeof v !== 'string' || v.length > max) invalid(); return v; };
  const amount = (v, signed = false) => {
    if (v === '' || v === undefined) return '';
    if (typeof v !== 'string' && typeof v !== 'number') invalid();
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || Math.abs(n) > 1e12 || (!signed && n < 0)) invalid();
    return n;
  };
  const month = v => { if (v === '' || v === undefined) return ''; if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) invalid(); return v; };
  const bool = v => { if (v === undefined) return false; if (typeof v !== 'boolean') invalid(); return v; };
  const pair = (v, signed = true, empty = false) => {
    if (v === undefined) return {rekening:empty?'':0,contant:empty?'':0};
    fields(v,['rekening','contant']);
    return {rekening:amount(v.rekening,signed),contant:amount(v.contant,signed)};
  };
  function safeUrl(value) {
    if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return '';
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  }
  function rows(value, kind) {
    if (!Array.isArray(value) || value.length > 2000) invalid();
    const ids = new Set();
    return value.map(r => {
      fields(r,['id','omschrijving','bedrag','bron',...(kind==='fixed'?['start','eind']:[]),...(kind==='wish'?['prioriteit','link','gekocht']:[]),...(kind==='expense'?['prioriteit']:[])]);
      const id = str(r.id,80);
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) invalid();
      ids.add(id);
      const bron = r.bron === undefined ? 'rekening' : r.bron;
      if (!['rekening','contant'].includes(bron)) invalid();
      const out = {id,omschrijving:str(r.omschrijving??''),bedrag:amount(r.bedrag),bron};
      if (kind==='wish' || kind==='expense') { out.prioriteit=amount(r.prioriteit); if(out.prioriteit>10000)invalid(); }
      if (kind==='wish') { out.link=safeUrl(r.link??''); out.gekocht=bool(r.gekocht); }
      if (kind==='fixed') { out.start=month(r.start);out.eind=month(r.eind); if(out.start&&out.eind&&out.start>out.eind)invalid(); }
      return out;
    });
  }
  function validateBackup(input) {
    if (!object(input) || Object.keys(input).length > 604 || encoder.encode(JSON.stringify(input)).length > MAX_BYTES) invalid();
    const output = Object.create(null);
    for (const [name, raw] of Object.entries(input)) {
      if (typeof raw !== 'string') invalid();
      let v; try {v=JSON.parse(raw);} catch {invalid();}
      let clean;
      if (name==='kasboek:spaarpot') clean=pair(v);
      else if (name==='kasboek:vastelasten') clean=rows(v,'fixed');
      else if (name==='kasboek:inkomsten') clean=rows(v,'income');
      else if (name==='kasboek:wensenlijst') clean=rows(v,'wish');
      else if (/^kasboek:\d{4}-(0[1-9]|1[0-2])$/.test(name)) {
        fields(v,['opnames','expenses','income','wishlist','afgesloten','overgemaakt','telling','correctie']);
        clean={opnames:rows(v.opnames??[],'withdrawal'),expenses:rows(v.expenses??[],'expense'),afgesloten:bool(v.afgesloten),overgemaakt:pair(v.overgemaakt),telling:pair(v.telling,true,true),correctie:pair(v.correctie)};
        if(v.income!==undefined)clean.income=rows(v.income,'income');
        if(v.wishlist!==undefined)clean.wishlist=rows(v.wishlist,'wish');
      } else invalid();
      output[name]=JSON.stringify(clean);
    }
    return output;
  }
  const b64 = bytes => { let s=''; for(const b of bytes)s+=String.fromCharCode(b);return btoa(s); };
  const unb64 = s => { if(typeof s!=='string'||s.length>MAX_BYTES*2||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))invalid();return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); };
  const aad = encoder.encode('kasboek-vault:1:PBKDF2-SHA256:600000:AES-256-GCM');
  async function derive(password, saltBytes) {
    const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:saltBytes,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function envelopeParts(envelope) {
    fields(envelope,['format','version','kdf','iterations','salt','iv','ciphertext']);
    if(envelope.format!=='kasboek-vault'||envelope.version!==1||envelope.kdf!=='PBKDF2-SHA256'||envelope.iterations!==ITERATIONS)invalid();
    const s=unb64(envelope.salt),iv=unb64(envelope.iv),ciphertext=unb64(envelope.ciphertext);
    if(s.length!==16||iv.length!==12||ciphertext.length<16||ciphertext.length>MAX_BYTES)invalid();
    return {s,iv,ciphertext};
  }
  async function encrypt(data) {
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const bytes=encoder.encode(JSON.stringify(data));
    if(bytes.length>MAX_BYTES-16)invalid();
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,bytes);
    return {format:'kasboek-vault',version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(ciphertext))};
  }
  async function decryptWithKey(envelope,candidate){
    const {iv,ciphertext}=envelopeParts(envelope);
    const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},candidate,ciphertext);
    return validateBackup(JSON.parse(decoder.decode(bytes)));
  }
  async function decrypt(envelope,password) {
    const {s}=envelopeParts(envelope),candidate=await derive(password,s);
    return {data:await decryptWithKey(envelope,candidate),key:candidate,salt:s};
  }
  const isRemembered=()=>rememberUntil>Date.now();
  async function setRemembered(remember){
    if(!remember){await LocalLogin.forget();rememberUntil=0;return;}
    await LocalLogin.remember(key,b64(salt));rememberUntil=Date.now()+30*86400000;
  }
  function status(text, error=false) {
    const el=document.getElementById('opslagStatus');if(el){el.textContent=text;el.style.color=error?'#A8462E':'#61745E';}
  }
  function ensureUnchanged() {
    if(localStorage.getItem(VAULT_KEY)!==currentEnvelope)throw new Error('Kasboek is in een ander tabblad gewijzigd. Sla een back-up op en herlaad.');
  }
  async function commit(data) {
    const envelope=JSON.stringify(await encrypt(data));
    ensureUnchanged();
    // One atomic localStorage write: validation/encryption failures cannot partially overwrite data.
    localStorage.setItem(VAULT_KEY,envelope);currentEnvelope=envelope;
  }
  function set(name,value) {
    if(!sessionActive)throw new Error('Kasboek is vergrendeld.');
    const data=validateBackup({...snapshot,[name]:JSON.stringify(value)});snapshot=data;pending++;status('opslaan…');
    queue=queue.catch(()=>{}).then(()=>commit(data)).then(()=>{failed=false;},()=>{failed=true;status('Opslaan mislukt — maak een back-up',true);}).finally(()=>{pending--;if(!pending&&!failed)status('versleuteld opgeslagen');});
  }
  async function flush() {await queue;if(failed)throw new Error('Opslaan is mislukt. Maak een back-up voordat je afsluit.');}
  function passwordDialog({title,description,create=false,cancel=false,login=false,setup=false,remember=false,action}) {
    LocalLogin.prepare({login,create,setup,remember});
    const dialog=document.getElementById('wachtwoordDialoog'),form=document.getElementById('wachtwoordFormulier');
    const password=document.getElementById('wachtwoord'),repeat=document.getElementById('wachtwoordHerhaal');
    const error=document.getElementById('wachtwoordFout'),submit=document.getElementById('wachtwoordDoorgaan'),abort=document.getElementById('wachtwoordAnnuleren');
    document.getElementById('wachtwoordTitel').textContent=title;document.getElementById('wachtwoordUitleg').textContent=description;
    document.getElementById('wachtwoordHerhaalBlok').hidden=!create;repeat.required=create;
    password.autocomplete=create?'new-password':'current-password';password.value='';repeat.value='';error.textContent='';
    submit.textContent=create?'Inloggen instellen':login?'Inloggen':'Ontgrendelen';abort.hidden=!cancel;
    return new Promise(resolve=>{
      let busy=false;
      dialog.oncancel=e=>{e.preventDefault();if(cancel&&!busy){dialog.close();resolve(null);}};
      abort.onclick=()=>{if(!busy){dialog.close();resolve(null);}};
      form.onsubmit=async e=>{
        e.preventDefault();if(busy)return;
        if(create&&(password.value.length<12||password.value!==repeat.value)){error.textContent='Kies minstens 12 tekens en vul tweemaal hetzelfde wachtwoord in.';return;}
        busy=true;submit.disabled=true;abort.disabled=true;error.textContent='Even geduld…';
        try{const value=await action(password.value,remember&&document.getElementById('rememberDialog').checked);password.value='';repeat.value='';dialog.close();resolve(value);}
        catch(err){error.textContent=err.name==='OperationError'?(login?'Gebruikersnaam of wachtwoord klopt niet.':'Verkeerd wachtwoord of beschadigde back-up.'):err.message;}
        finally{busy=false;submit.disabled=false;abort.disabled=false;}
      };
      dialog.showModal();(login?document.getElementById('gebruikersnaam'):password).focus();
    });
  }
  async function open() {
    if(!crypto.subtle)throw new Error('Open Kasboek via HTTPS om versleuteling te gebruiken.');
    currentEnvelope=localStorage.getItem(VAULT_KEY);
    if(currentEnvelope){
      if(currentEnvelope.length>MAX_BYTES*2)invalid();
      const envelope=JSON.parse(currentEnvelope);envelopeParts(envelope);
      let remembered=await LocalLogin.recalled(envelope.salt),automaticallyOpened=false;
      if(remembered){try{snapshot=await decryptWithKey(envelope,remembered.key);key=remembered.key;salt=envelopeParts(envelope).s;rememberUntil=remembered.expiresAt;automaticallyOpened=true;}catch{await setRemembered(false);}}
      if(!automaticallyOpened)await passwordDialog({title:'Welkom terug',login:true,setup:!await LocalLogin.hasIdentity(envelope.salt),remember:true,description:'Je gegevens blijven versleuteld op dit apparaat. Vul je wachtwoord in.',action:async(password,remember)=>{
        const unlocked=await decrypt(envelope,password);await LocalLogin.verify(unlocked.key,envelope.salt,LocalLogin.username());key=unlocked.key;salt=unlocked.salt;snapshot=unlocked.data;await setRemembered(remember);return true;
      }});
    }else{
      const legacy=Object.create(null);
      for(let i=0;i<localStorage.length;i++){const name=localStorage.key(i);if(name.startsWith('kasboek:'))legacy[name]=localStorage.getItem(name);}
      const clean=validateBackup(legacy);
      await passwordDialog({title:'Inloggen instellen',login:true,setup:true,remember:true,create:true,description:'Kies een wachtwoord van minstens 12 tekens. Bewaar het goed: zonder wachtwoord zijn je gegevens niet te herstellen.',action:async(password,remember)=>{
        salt=crypto.getRandomValues(new Uint8Array(16));key=await derive(password,salt);await LocalLogin.verify(key,b64(salt),LocalLogin.username());await commit(clean);snapshot=clean;await setRemembered(remember);return true;
      }});
      // Delete plaintext only after the encrypted copy has been successfully stored.
      for(const name of Object.keys(legacy))localStorage.removeItem(name);
    }
    // Complete a migration interrupted after the durable encrypted write.
    for(let i=localStorage.length-1;i>=0;i--){const name=localStorage.key(i);if(name!==VAULT_KEY&&name.startsWith('kasboek:'))localStorage.removeItem(name);}
    sessionActive=true;status('versleuteld opgeslagen');
    let idle;const reset=()=>{clearTimeout(idle);idle=setTimeout(()=>{if(isRemembered()){reset();return;}flush().then(()=>location.reload()).catch(()=>status('Vergrendelen uitgesteld: maak eerst een back-up',true));},10*60*1000);};
    for(const event of ['pointerdown','keydown','input'])document.addEventListener(event,reset,{passive:true});reset();
  }
  async function restore(file) {
    if(!file||file.size>MAX_BYTES*2)throw new Error('De back-up is te groot (maximaal 4 MB).');
    const parsed=JSON.parse(await file.text());
    let incoming;
    if(parsed&&parsed.format==='kasboek-vault'){
      envelopeParts(parsed);
      incoming=await passwordDialog({title:'Back-up ontgrendelen',cancel:true,description:'Vul het wachtwoord in waarmee deze back-up is gemaakt.',action:async password=>(await decrypt(parsed,password)).data});
      if(incoming===null)return false;
    }else incoming=validateBackup(parsed);
    // Merge fully validated entries, matching the original import behaviour.
    const merged=validateBackup({...snapshot,...incoming});
    await flush();await commit(merged);snapshot=merged;failed=false;status('versleuteld opgeslagen');return true;
  }
  async function download() {
    await queue;
    const clean=validateBackup(snapshot);
    const blob=new Blob([JSON.stringify(await encrypt(clean))],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='kasboek-versleuteld-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  window.addEventListener('beforeunload',e=>{if(pending||failed){e.preventDefault();e.returnValue='';}});
  // Requiring an exclusive browser lock prevents two writable copies racing on the same vault.
  async function exclusiveOpen() {
    if(!navigator.locks)throw new Error('Gebruik een recente browser die veilige tabbladvergrendeling ondersteunt.');
    return new Promise((resolve,reject)=>{
      navigator.locks.request('kasboek-vault-session',{ifAvailable:true},async lock=>{
        if(!lock){reject(new Error('Kasboek staat al open in een ander tabblad. Sluit dat tabblad en herlaad.'));return;}
        try{await open();resolve();await new Promise(()=>{});}catch(err){reject(err);}
      }).catch(reject);
    });
  }
  return {open:exclusiveOpen,get:(name,fallback)=>snapshot[name]===undefined?fallback:JSON.parse(snapshot[name]),set,flush,restore,download,safeUrl,validateBackup,setRemembered,isRemembered};
})();
