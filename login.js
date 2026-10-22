'use strict';
// Local credentials only: usernames are encrypted with the existing vault key.
const LocalLogin=(()=>{
 const app=document.getElementById('loginBrand').dataset.app;
 const enc=new TextEncoder(),dec=new TextDecoder();
 const aad=enc.encode(app+':login-identity:1');
 const normalize=name=>String(name).normalize('NFKC').trim().toLocaleLowerCase('nl');
 async function record(slot,value,write=false){
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(app+'-login',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('records',write?'readwrite':'readonly'),store=tx.objectStore('records');const r=write?(value===undefined?store.delete(slot):store.put(value,slot)):store.get(slot);tx.oncomplete=()=>resolve(r.result);tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Inloggegevens opslaan mislukt.'));});}finally{db.close();}
 }
 const hasIdentity=async salt=>(await record('identity'))?.salt===salt;
 async function verify(key,salt,name){
  const username=normalize(name);if(username.length<3||username.length>80)throw new Error('Kies een gebruikersnaam van 3 tot 80 tekens.');
  const existing=await record('identity');
  if(existing?.salt===salt){
   const value=dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:existing.iv,additionalData:aad},key,existing.ciphertext));
   if(value!==username)throw new DOMException('Onjuiste inloggegevens','OperationError');
  }else{
   const iv=crypto.getRandomValues(new Uint8Array(12));
   const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,enc.encode(username));
   await record('identity',{salt,iv,ciphertext},true);
  }
 }
 function prepare({login=false,create=false,setup=false,remember=false}){
  const dialog=document.getElementById('wachtwoordDialoog'),name=document.getElementById('gebruikersnaam');
  dialog.classList.toggle('login-screen',login);
  const forgot=document.getElementById('wachtwoordVergeten'),recovery=document.getElementById('wachtwoordHerstel');
  forgot.hidden=!login;forgot.setAttribute('aria-expanded','false');recovery.hidden=true;
  forgot.onclick=()=>{const expanded=forgot.getAttribute('aria-expanded')!=='true';forgot.setAttribute('aria-expanded',String(expanded));recovery.hidden=!expanded;if(expanded)recovery.scrollIntoView({block:'nearest'});};
  document.getElementById('gebruikersnaamBlok').hidden=!login;name.required=login;name.value='';
  document.getElementById('gebruikersnaamLabel').textContent=setup?'Kies je gebruikersnaam':'Gebruikersnaam';
  document.getElementById('loginHint').hidden=!login;
  document.getElementById('loginHint').textContent=setup&&!create?'Gebruik je bestaande wachtwoord. Kies eenmalig een gebruikersnaam voor dit apparaat.':'Je gegevens blijven versleuteld op dit apparaat.';
  document.getElementById('rememberDialogLabel').hidden=!remember;document.getElementById('rememberDialog').checked=false;
  const toggle=document.getElementById('toonWachtwoord');toggle.textContent='Toon';toggle.setAttribute('aria-pressed','false');
  for(const id of ['wachtwoord','wachtwoordHerhaal'])document.getElementById(id).type='password';
  toggle.onclick=()=>{const show=document.getElementById('wachtwoord').type==='password';for(const id of ['wachtwoord','wachtwoordHerhaal'])document.getElementById(id).type=show?'text':'password';toggle.textContent=show?'Verberg':'Toon';toggle.setAttribute('aria-pressed',String(show));};
 }
 const username=()=>document.getElementById('gebruikersnaam').value;
 const forget=()=>record('remember',undefined,true);
 async function remember(key,salt){await record('remember',{key,salt,expiresAt:Date.now()+30*86400000},true);}
 async function recalled(salt){
  const r=await record('remember');if(!r)return null;
  if(r.salt!==salt||!Number.isFinite(r.expiresAt)||r.expiresAt<=Date.now()||r.expiresAt>Date.now()+31*86400000||!(r.key instanceof CryptoKey)||r.key.extractable||!await hasIdentity(salt)){await forget();return null;}
  return r;
 }
 return {prepare,username,verify,hasIdentity,remember,recalled,forget};
})();
