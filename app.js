"use strict";
const MAANDEN=["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
const SPAAR_KEY="kasboek:spaarpot", VAST_KEY="kasboek:vastelasten", INK_KEY="kasboek:inkomsten", WENS_KEY="kasboek:wensenlijst";
const $=id=>document.getElementById(id);
const num=v=>{const n=parseFloat(String(v).replace(",","."));return Number.isFinite(n)?n:0;};
const euro=n=>(num(n)).toLocaleString("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2});
const uid=()=>crypto.randomUUID();
const som=r=>r.reduce((a,x)=>a+num(x.bedrag),0);
const somBron=(r,b)=>r.filter(x=>x.bron===b).reduce((a,x)=>a+num(x.bedrag),0);
const prioVan=x=>(x.prioriteit===""||x.prioriteit==null)?9999:num(x.prioriteit);

let cursor=new Date(); cursor.setDate(1);
let data=leegMaand(), spaar={rekening:0,contant:0}, vaste=[], globaleInkomsten=[], globaleWensenlijst=[];

function leegMaand(){return{opnames:[],expenses:[],
  afgesloten:false,overgemaakt:{rekening:0,contant:0},
  telling:{rekening:"",contant:""},correctie:{rekening:0,contant:0}};}
function mk(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");}
function maandKey(){return "kasboek:"+mk(cursor);}

function lees(key,fallback){return KasboekSecurity.get(key,fallback);}
function schrijf(key,waarde){
  try{KasboekSecurity.set(key,waarde);}catch(err){$("opslagStatus").textContent="Ongeldige invoer — niet opgeslagen";$("opslagStatus").style.color="#A8462E";}
}
const bewaarMaand=()=>schrijf(maandKey(),data);
const bewaarSpaar=()=>schrijf(SPAAR_KEY,spaar);
const bewaarVaste=()=>schrijf(VAST_KEY,vaste);
const bewaarGlobaleInkomsten=()=>schrijf(INK_KEY,globaleInkomsten);
const bewaarGlobaleWensen=()=>schrijf(WENS_KEY,globaleWensenlijst);

function laadMaand(){
  const g=lees(maandKey(),null);
  data=g?Object.assign(leegMaand(),g):leegMaand();
  data.telling=data.telling||{rekening:"",contant:""};
  data.correctie=data.correctie||{rekening:0,contant:0};

  data.income=globaleInkomsten;
  data.wishlist=globaleWensenlijst;
  data.opnames=(data.opnames||[]).map(r=>Object.assign({bron:"rekening"},r));
  data.expenses=(data.expenses||[]).map(r=>Object.assign({bron:"rekening"},r));

  $("telRek").value=data.telling.rekening; $("telCon").value=data.telling.contant;
  $("maandLabel").textContent=MAANDEN[cursor.getMonth()]+" "+cursor.getFullYear();
  tekenAlles();
}

function actiefNu(v){const m=mk(cursor);
  if(v.start&&v.start>m)return false; if(v.eind&&v.eind<m)return false; return true;}

// ---------- rekenwerk ----------
function bereken(){
  const vasteNu=vaste.filter(actiefNu);
  const opgenomen=som(data.opnames);
  const gekocht=data.wishlist.filter(w=>w.gekocht);
  const c=data.correctie;
  const b={
    rekening:spaar.rekening+somBron(data.income,"rekening")-somBron(vasteNu,"rekening")
      -somBron(data.expenses,"rekening")-opgenomen-somBron(gekocht,"rekening")+num(c.rekening),
    contant:spaar.contant+somBron(data.income,"contant")-somBron(vasteNu,"contant")
      -somBron(data.expenses,"contant")+opgenomen-somBron(gekocht,"contant")+num(c.contant)
  };
  const pot={rekening:b.rekening,contant:b.contant};
  const status={};
  data.wishlist.slice().sort((x,y)=>prioVan(x)-prioVan(y)).forEach(w=>{
    const bron=w.bron==="contant"?"contant":"rekening";
    if(w.gekocht){status[w.id]={status:null,rest:pot[bron],bron};return;}
    const prijs=num(w.bedrag); let s=null;
    if(prijs>0){ if(pot[bron]<prijs)s="rood"; else if(pot[bron]<prijs*5)s="oranje"; else s="groen"; }
    const nodig=(s==="rood"&&bron==="contant"&&pot.rekening>=(prijs-pot.contant))?prijs-pot.contant:0;
    status[w.id]={status:s,rest:pot[bron],bron,nodig};
    if(s==="oranje"||s==="groen")pot[bron]-=prijs;
  });
  return {b,status,vasteNu,opgenomen,gekocht};
}

function cel(v){const k=v<0?"min":v>0?"plus":"nul";
  return '<span class="cel '+k+'">'+(v<0?"− ":"")+"€ "+euro(Math.abs(v))+"</span>";}
function rij(label,a,b,dik){return '<div class="rij'+(dik?" dik":"")+'"><span>'+label+"</span><span>"+cel(a)+cel(b)+"</span></div>";}

function ververs(){
  const {b,status,vasteNu,opgenomen,gekocht}=bereken();
  $("besRek").textContent="€ "+euro(b.rekening);
  $("besCon").textContent="€ "+euro(b.contant);
  $("besRek").style.color=b.rekening<0?"#E8A08D":"#F2EEE6";
  $("besCon").style.color=b.contant<0?"#E8A08D":"#F2EEE6";

  const wr=somBron(gekocht,"rekening"), wc=somBron(gekocht,"contant"), c=data.correctie;
  let h=rij("Spaarpot",spaar.rekening,spaar.contant)
    +rij("Inkomsten",somBron(data.income,"rekening"),somBron(data.income,"contant"))
    +rij("Vaste lasten",-somBron(vasteNu,"rekening"),-somBron(vasteNu,"contant"))
    +rij("Opnames",-opgenomen,opgenomen)
    +rij("Losse uitgaven",-somBron(data.expenses,"rekening"),-somBron(data.expenses,"contant"));
  if(wr+wc>0)h+=rij("Gekochte wensen",-wr,-wc);
  if(num(c.rekening)||num(c.contant))h+=rij("Kascorrectie",num(c.rekening),num(c.contant));
  h+='<div class="streep"></div>'+rij("Beschikbaar",b.rekening,b.contant,true);
  $("overzichtRijen").innerHTML=h;

  $("totInk").textContent="€ "+euro(som(data.income));
  $("totVast").textContent="€ "+euro(som(vasteNu))+" deze maand";
  $("totOpn").textContent="€ "+euro(opgenomen);
  $("totUit").textContent="€ "+euro(som(data.expenses));
  $("totWens").textContent="€ "+euro(som(data.wishlist.filter(w=>!w.gekocht)))+" openstaand";

  // kascontrole
  ["rekening","contant"].forEach(k=>{
    const el=$(k==="rekening"?"diffRek":"diffCon"); const t=data.telling[k];
    if(t===""||t==null){el.textContent="nog niet geteld";el.style.color="#B7AF9E";return;}
    const v=num(t)-b[k];
    el.textContent=v===0?"klopt precies":(v<0?"tekort € ":"over € ")+euro(Math.abs(v));
    el.style.color=v===0?"var(--groen)":v<0?"var(--rood)":"var(--oranje)";
  });
  const dR=data.telling.rekening===""?0:num(data.telling.rekening)-b.rekening;
  const dC=data.telling.contant===""?0:num(data.telling.contant)-b.contant;
  let kn="";
  if(dR||dC)kn+='<button class="knop blauw" id="verwerkVerschil">✓ Verschil verwerken</button>';
  if(num(c.rekening)||num(c.contant))kn+='<button class="knop" id="wisCorrectie" style="color:var(--licht)">Correctie wissen</button>';
  $("corrKnoppen").innerHTML=kn;
  if($("verwerkVerschil"))$("verwerkVerschil").onclick=()=>{
    data.correctie={rekening:num(c.rekening)+dR,contant:num(c.contant)+dC};bewaarMaand();ververs();};
  if($("wisCorrectie"))$("wisCorrectie").onclick=()=>{
    data.correctie={rekening:0,contant:0};bewaarMaand();ververs();};

  // afsluiten
  const oR=b.rekening-spaar.rekening, oC=b.contant-spaar.contant, ietsOver=oR>0||oC>0;
  if(data.afgesloten){
    $("afsluitBlok").innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'
      +'<span style="font-size:13px;color:var(--groen)">✓ € '+euro(data.overgemaakt.rekening)+' rekening + € '
      +euro(data.overgemaakt.contant)+' contant naar de spaarpotten</span>'
      +'<button class="knop" id="ongedaan" style="color:var(--licht)">Ongedaan maken</button></div>';
    $("ongedaan").onclick=()=>{
      spaar={rekening:spaar.rekening-num(data.overgemaakt.rekening),contant:spaar.contant-num(data.overgemaakt.contant)};
      $("spaarRek").value=spaar.rekening;$("spaarCon").value=spaar.contant;bewaarSpaar();
      data.afgesloten=false;data.overgemaakt={rekening:0,contant:0};bewaarMaand();ververs();};
  }else{
    $("afsluitBlok").innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'
      +'<span style="font-size:13px;color:var(--grijs)">'+(ietsOver
        ?'Over deze maand: <strong class="mono">€ '+euro(oR)+'</strong> rekening, <strong class="mono">€ '+euro(oC)+'</strong> contant'
        :'Deze maand blijft er niets over om te sparen.')+'</span>'
      +'<button class="knop donker" id="afsluiten"'+(ietsOver?"":" disabled")+'>Maand afsluiten</button></div>';
    if(ietsOver)$("afsluiten").onclick=()=>{
      spaar={rekening:b.rekening,contant:b.contant};
      $("spaarRek").value=spaar.rekening;$("spaarCon").value=spaar.contant;bewaarSpaar();
      data.afgesloten=true;data.overgemaakt={rekening:oR,contant:oC};bewaarMaand();ververs();};
  }

  // wenskleuren
  data.wishlist.forEach(w=>{
    const el=document.querySelector('[data-wens="'+w.id+'"]'); if(!el)return;
    const s=status[w.id]||{};
    el.className="wens"+(w.gekocht?" gekocht":(s.status?" "+s.status:""));
    const st=el.querySelector(".status"), op=el.querySelector(".opnemen");
    if(!w.gekocht&&s.status){st.style.display="";
      st.textContent=({groen:"5× gespaard",oranje:"krap — wel te betalen",rood:"nog niet te betalen"})[s.status]
        +" · € "+euro(s.rest)+" "+s.bron+" beschikbaar op dit punt";
    }else st.style.display="none";
    if(!w.gekocht&&s.nodig>0){op.style.display="";op.textContent="⚠ neem € "+euro(s.nodig)+" op van je rekening en dit kan wél";}
    else op.style.display="none";
  });
  // vaste lasten dimmen
  vaste.forEach(v=>{const el=document.querySelector('[data-vast="'+v.id+'"]');
    if(el)el.classList.toggle("dim",!actiefNu(v));});
}

// ---------- bouwstenen ----------
function inputEl(cls,type,ph,waarde,cb){
  const i=document.createElement("input");
  i.type=type; i.placeholder=ph||""; i.value=waarde==null?"":waarde;
  if(type==="number"){i.inputMode="decimal";i.max="1000000000000";}
  if(type==="text")i.maxLength=500;
  if(type==="url")i.maxLength=2048;
  if(cls&&cls.includes("prio")){i.min="0";i.max="10000";}
  if(cls)i.className=cls;
  i.addEventListener("input",()=>{if(i.validity.rangeUnderflow||i.validity.rangeOverflow||i.validity.badInput)return;cb(i.value);});
  return i;
}
function bedragEl(waarde,cb){
  const d=document.createElement("div"); d.className="bedrag mono";
  const s=document.createElement("span"); s.textContent="€"; d.appendChild(s);
  const input=inputEl(null,"number","0,00",waarde,cb);input.min="0";input.step="0.01";d.appendChild(input);
  return d;
}
function bronEl(waarde,cb){
  const d=document.createElement("div"); d.className="toggle";
  [["rekening","rek"],["contant","con"]].forEach(([k,kort])=>{
    const b=document.createElement("button");
    b.textContent=k; b.className=(waarde===k?"aan ":"")+kort;
    b.onclick=()=>{cb(k);
      Array.from(d.children).forEach(c=>c.className=c.className.replace("aan ",""));
      b.className="aan "+kort; ververs();};
    d.appendChild(b);
  });
  return d;
}
function wisEl(cb){const b=document.createElement("button");b.className="wis";b.textContent="🗑";
  b.setAttribute("aria-label","Verwijderen");b.onclick=cb;return b;}

function tekenLijst(doelId,rows,opties){
  const doel=$(doelId); doel.innerHTML="";
  if(!rows.length){const d=document.createElement("div");d.className="leeg";
    d.textContent=opties.leegTekst||"Nog niets ingevuld.";doel.appendChild(d);return;}
  rows.forEach(r=>{
    const rij=document.createElement("div"); rij.className="regel";
    if(opties.prio){
      rij.appendChild(inputEl("prio mono","number","–",r.prioriteit,v=>{r.prioriteit=v;opties.bewaar();}));
    }
    rij.appendChild(inputEl("omschrijving","text",opties.ph||"omschrijving",r.omschrijving,
      v=>{r.omschrijving=v;opties.bewaar();}));
    if(opties.bron)rij.appendChild(bronEl(r.bron,v=>{r.bron=v;opties.bewaar();}));
    rij.appendChild(bedragEl(r.bedrag,v=>{r.bedrag=v;opties.bewaar();ververs();}));
    rij.appendChild(wisEl(()=>opties.verwijder(r.id)));
    doel.appendChild(rij);
  });
}

function tekenVaste(){
  const doel=$("lijstVaste"); doel.innerHTML="";
  if(!vaste.length){doel.innerHTML='<div class="leeg">Nog geen vaste lasten.</div>';return;}
  vaste.forEach(v=>{
    const wrap=document.createElement("div"); wrap.className="regel"; wrap.style.display="block";
    wrap.setAttribute("data-vast",v.id);
    const boven=document.createElement("div");
    boven.style.cssText="display:flex;align-items:center;gap:9px;flex-wrap:wrap";
    boven.appendChild(inputEl("omschrijving","text","bijv. huur, telefoon",v.omschrijving,
      x=>{v.omschrijving=x;bewaarVaste();}));
    boven.appendChild(bronEl(v.bron,x=>{v.bron=x;bewaarVaste();}));
    boven.appendChild(bedragEl(v.bedrag,x=>{v.bedrag=x;bewaarVaste();ververs();}));
    boven.appendChild(wisEl(()=>{vaste=vaste.filter(y=>y.id!==v.id);bewaarVaste();tekenVaste();ververs();}));
    wrap.appendChild(boven);
    const dat=document.createElement("div"); dat.className="datums";
    const l1=document.createElement("label"); l1.style.cssText="display:flex;align-items:center;gap:5px";
    l1.appendChild(document.createTextNode("vanaf"));
    l1.appendChild(inputEl(null,"month","",v.start,x=>{v.start=x;bewaarVaste();ververs();}));
    const l2=document.createElement("label"); l2.style.cssText="display:flex;align-items:center;gap:5px";
    l2.appendChild(document.createTextNode("t/m"));
    l2.appendChild(inputEl(null,"month","",v.eind,x=>{v.eind=x;bewaarVaste();ververs();}));
    dat.appendChild(l1); dat.appendChild(l2);
    wrap.appendChild(dat);
    doel.appendChild(wrap);
  });
}

function tekenWensen(){
  const doel=$("lijstWensen"); doel.innerHTML="";
  const rows=data.wishlist.slice().sort((a,b)=>prioVan(a)-prioVan(b));
  if(!rows.length){doel.innerHTML='<div class="leeg">Nog geen wensen toegevoegd.</div>';return;}
  rows.forEach(w=>{
    const el=document.createElement("div"); el.className="wens"; el.setAttribute("data-wens",w.id);
    const boven=document.createElement("div");
    boven.style.cssText="display:flex;align-items:center;gap:9px;flex-wrap:wrap";
    boven.appendChild(inputEl("prio mono","number","–",w.prioriteit,v=>{w.prioriteit=v;bewaarGlobaleWensen();ververs();}));
    const vink=document.createElement("button");
    vink.className="vink"+(w.gekocht?" aan":""); vink.textContent=w.gekocht?"✓":"";
    vink.setAttribute("aria-label","Gekocht markeren");
    vink.onclick=()=>{w.gekocht=!w.gekocht;bewaarGlobaleWensen();tekenWensen();ververs();};
    boven.appendChild(vink);
    boven.appendChild(inputEl("omschrijving","text","wat wil je?",w.omschrijving,v=>{w.omschrijving=v;bewaarGlobaleWensen();}));
    boven.appendChild(bronEl(w.bron,v=>{w.bron=v;bewaarGlobaleWensen();}));
    boven.appendChild(bedragEl(w.bedrag,v=>{w.bedrag=v;bewaarGlobaleWensen();ververs();}));
    boven.appendChild(wisEl(()=>{data.wishlist=data.wishlist.filter(x=>x.id!==w.id);globaleWensenlijst=globaleWensenlijst.filter(x=>x.id!==w.id);bewaarMaand();bewaarGlobaleWensen();tekenWensen();ververs();}));
    el.appendChild(boven);

    const lk=document.createElement("div"); lk.className="link";
    lk.appendChild(document.createTextNode("🔗"));
    lk.appendChild(inputEl(null,"url","link naar website (optioneel)",w.link,v=>{
      w.link=v;bewaarGlobaleWensen();
      const a=lk.querySelector("a"); if(a){const safe=KasboekSecurity.safeUrl(v);a.href=safe||"#";a.style.display=safe?"":"none";}}));
    const a=document.createElement("a"); a.target="_blank"; a.rel="noopener noreferrer";
    const safe=KasboekSecurity.safeUrl(w.link);
    a.textContent="open"; a.href=safe||"#"; a.style.display=safe?"":"none";
    lk.appendChild(a); el.appendChild(lk);

    const st=document.createElement("div"); st.className="status"; el.appendChild(st);
    const op=document.createElement("div"); op.className="opnemen"; el.appendChild(op);
    doel.appendChild(el);
  });
}

function tekenAlles(){
  tekenLijst("lijstInkomsten",data.income,{bron:true,bewaar:bewaarGlobaleInkomsten,
    verwijder:id=>{data.income=data.income.filter(r=>r.id!==id);globaleInkomsten=globaleInkomsten.filter(r=>r.id!==id);bewaarMaand();bewaarGlobaleInkomsten();tekenAlles();ververs();}});
  tekenVaste();
  tekenLijst("lijstOpnames",data.opnames,{ph:"bijv. pinnen zaterdag",leegTekst:"Nog niets opgenomen.",bewaar:bewaarMaand,
    verwijder:id=>{data.opnames=data.opnames.filter(r=>r.id!==id);bewaarMaand();tekenAlles();ververs();}});
  tekenLijst("lijstUitgaven",data.expenses.slice().sort((a,b)=>prioVan(a)-prioVan(b)),{prio:true,bron:true,bewaar:bewaarMaand,
    verwijder:id=>{data.expenses=data.expenses.filter(r=>r.id!==id);bewaarMaand();tekenAlles();ververs();}});
  tekenWensen();
  ververs();
}

// ---------- events ----------
document.querySelectorAll("[data-add]").forEach(b=>{
  b.onclick=()=>{
    const soort=b.getAttribute("data-add");
    if(soort==="vaste"){
      vaste.push({id:uid(),omschrijving:"",bedrag:"",bron:"rekening",start:"",eind:""});
      bewaarVaste();tekenVaste();ververs();return;
    }
    const basis={id:uid(),omschrijving:"",bedrag:"",bron:"rekening"};
    if(soort==="expenses"||soort==="wishlist")basis.prioriteit=String(data[soort].length+1);
    if(soort==="wishlist"){basis.link="";basis.gekocht=false;}

  data[soort].push(basis);
  if(soort==="income")bewaarGlobaleInkomsten();
  else if(soort==="wishlist")bewaarGlobaleWensen();
  else bewaarMaand();

    tekenAlles();
  };
});
$("vorige").onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);laadMaand();};
$("volgende").onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);laadMaand();};
$("spaarRek").addEventListener("input",e=>{spaar.rekening=num(e.target.value);bewaarSpaar();ververs();});
$("spaarCon").addEventListener("input",e=>{spaar.contant=num(e.target.value);bewaarSpaar();ververs();});
$("telRek").addEventListener("input",e=>{data.telling.rekening=e.target.value;bewaarMaand();ververs();});
$("telCon").addEventListener("input",e=>{data.telling.contant=e.target.value;bewaarMaand();ververs();});

$("exporteren").onclick=async()=>{
  try{await KasboekSecurity.download();}catch(err){alert("Back-up maken mislukt: "+err.message);}
};
$("importeren").onclick=()=>$("bestand").click();
$("bestand").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  $("importeren").disabled=true;document.querySelector(".wrap").inert=true;
  try{if(await KasboekSecurity.restore(f)){start();alert("Back-up gecontroleerd en versleuteld teruggezet.");}}
  catch(err){alert("Back-up niet teruggezet. "+(err instanceof SyntaxError?"Dit is geen geldig back-upbestand.":err.message));}
  finally{e.target.value="";$("importeren").disabled=false;document.querySelector(".wrap").inert=false;}
};
$("vergrendelen").onclick=async()=>{
  try{await KasboekSecurity.flush();await KasboekSecurity.setRemembered(false);location.reload();}catch(err){alert(err.message);}
};

function start(){
  const s=lees(SPAAR_KEY,{rekening:0,contant:0});
  spaar={rekening:num(s.rekening),contant:num(s.contant)};
  $("spaarRek").value=spaar.rekening; $("spaarCon").value=spaar.contant;
  vaste=lees(VAST_KEY,[]); if(!Array.isArray(vaste))vaste=[];
  globaleInkomsten=lees(INK_KEY,[]); if(!Array.isArray(globaleInkomsten))globaleInkomsten=[];
  globaleWensenlijst=lees(WENS_KEY,[]); if(!Array.isArray(globaleWensenlijst))globaleWensenlijst=[];
  globaleInkomsten=globaleInkomsten.map(r=>Object.assign({bron:"rekening"},r));
  globaleWensenlijst=globaleWensenlijst.map(r=>Object.assign({bron:"rekening"},r));
  laadMaand();
}
KasboekSecurity.open().then(()=>{
  start();
  const banner=$("migratieBericht");
  banner.hidden=false;
  if(location.hostname.endsWith('github.io')){
    banner.appendChild(document.createTextNode('Kasboek heeft een eigen, beter afgeschermd adres. Sla hier eerst een versleutelde back-up op. Open daarna '));
    const a=document.createElement('a');a.href='https://kasboek.zsj4j2s4df.workers.dev/';a.textContent='het nieuwe Kasboek';a.rel='noopener noreferrer';banner.appendChild(a);
    banner.appendChild(document.createTextNode(' en zet je back-up daar terug. Gebruik hetzelfde wachtwoord om je back-up te openen.'));
  }else{
    banner.textContent='Je gegevens blijven versleuteld in deze browser. Kom je van de oude app? Sla daar eerst een back-up op en kies hier “Back-up terugzetten”. Bewaar je wachtwoord en maak regelmatig een back-up.';
  }
}).catch(err=>{
  $("wachtwoordTitel").textContent='Kasboek kan niet worden geopend';
  $("wachtwoordUitleg").textContent=err.message+' Je opgeslagen gegevens zijn niet verwijderd.';
  $("wachtwoordFormulier").querySelectorAll('input,button,label').forEach(el=>el.hidden=true);
  if(!$("wachtwoordDialoog").open)$("wachtwoordDialoog").showModal();
});

// splashscreen wegfaden — pas nadat het handschrift-lettertype geladen is,
// zodat de titel niet even in een terugval-lettertype flitst
(function(){
  const s=$("splash"); if(!s)return;
  const weg=()=>{s.classList.add("weg");setTimeout(()=>s.remove(),650);};
  let klaar=false;
  const toon=()=>document.documentElement.classList.add("fonts-klaar");
  const go=()=>{if(klaar)return;klaar=true;toon();setTimeout(weg,650);};
  const cap=setTimeout(go,2600); // veiligheidslimiet als fonts niet laden
  const ready=()=>{clearTimeout(cap);go();};
  if(document.fonts&&document.fonts.load){
    Promise.all([
      document.fonts.load("700 52px 'Caveat'"),
      document.fonts.load("400 16px 'Patrick Hand'")
    ]).then(()=>document.fonts.ready).then(ready).catch(ready);
  }else{
    window.addEventListener("load",()=>setTimeout(ready,600));
    setTimeout(ready,1200);
  }
})();
