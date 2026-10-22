const {test,expect}=require('@playwright/test');
const PASS='Test-wachtwoord-voor-kasboek-2026';
async function open(page,{existing=false}={}){
  await page.goto('/');
  await expect(page.locator('#wachtwoordDialoog')).toBeVisible();
  await page.locator('#wachtwoordDialoog').waitFor({state:'visible'});if(await page.locator('#gebruikersnaamBlok').isVisible())await page.locator('#gebruikersnaam').fill('testgebruiker');await page.locator('#wachtwoord').fill(PASS);
  if(!existing)await page.locator('#wachtwoordHerhaal').fill(PASS);
  await page.locator('#wachtwoordDoorgaan').click();
  await expect(page.locator('#wachtwoordDialoog')).not.toBeVisible();
  await page.locator('#splash').waitFor({state:'detached'});
}
async function settled(page){await expect(page.locator('#opslagStatus')).toHaveText('versleuteld opgeslagen');}
async function upload(page,contents){
  await page.locator('#bestand').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(typeof contents==='string'?contents:JSON.stringify(contents))});
}
function legacy(){return {
  'kasboek:spaarpot':JSON.stringify({rekening:123,contant:0}),
  'kasboek:inkomsten':JSON.stringify([{id:'income1',omschrijving:'Synthetisch salaris',bedrag:1000,bron:'rekening'}]),
  'kasboek:wensenlijst':JSON.stringify([{id:'wish1',omschrijving:'Fiets',bedrag:25,bron:'contant',prioriteit:'1',link:'https://example.com',gekocht:false}])
};}
test('all add buttons, edits, monthly boundaries and persistence work under CSP',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 for(const [kind,id] of [['income','lijstInkomsten'],['wishlist','lijstWensen'],['opnames','lijstOpnames'],['expenses','lijstUitgaven'],['vaste','lijstVaste']]){
  await page.locator(`[data-add="${kind}"]`).click();
  await expect(page.locator(`#${id} .omschrijving`)).toHaveCount(1);
  await page.locator(`#${id} .omschrijving`).fill('test-'+kind);
  await page.locator(`#${id} .bedrag input`).fill(kind==='income'?'1000':'25');await settled(page);
 }
 await page.locator('#lijstWensen .link input').fill('https://example.com');await settled(page);
 await page.locator('#lijstWensen .vink').click();await settled(page);
 await page.reload();await expect(page.locator('#besRek')).toHaveText('€ 0,00');
 await open(page,{existing:true});
 await expect(page.locator('#lijstInkomsten .bedrag input')).toHaveValue('1000');
 await expect(page.locator('#lijstWensen .vink.aan')).toHaveCount(1);
 await page.locator('#volgende').click();await expect(page.locator('#lijstInkomsten .omschrijving')).toHaveValue('test-income');
 await expect(page.locator('#lijstOpnames .omschrijving')).toHaveCount(0);
 await page.locator('#vorige').click();await expect(page.locator('#lijstOpnames .omschrijving')).toHaveValue('test-opnames');
 const storage=await page.evaluate(()=>({...localStorage}));
 expect(Object.keys(storage)).toEqual(['kasboek:vault:v1']);expect(JSON.stringify(storage)).not.toContain('test-income');
 expect(errors).toEqual([]);
});
test('legacy migration preserves data, removes plaintext and rejects wrong password',async({page})=>{
 await page.goto('/');await page.evaluate(v=>{for(const [k,s]of Object.entries(v))localStorage.setItem(k,s);},legacy());await open(page);
 await expect(page.locator('#lijstInkomsten .omschrijving')).toHaveValue('Synthetisch salaris');
 expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual(['kasboek:vault:v1']);
 await page.locator('#vergrendelen').click();await expect(page.locator('#wachtwoordDialoog')).toBeVisible();
 await page.locator('#wachtwoordDialoog').waitFor({state:'visible'});if(await page.locator('#gebruikersnaamBlok').isVisible())await page.locator('#gebruikersnaam').fill('testgebruiker');await page.locator('#wachtwoord').fill('Verkeerd-wachtwoord');await page.locator('#wachtwoordDoorgaan').click();
 await expect(page.locator('#wachtwoordFout')).toContainText('Gebruikersnaam of wachtwoord klopt niet');
 await expect(page.locator('#lijstInkomsten .omschrijving')).toHaveCount(0);
 await page.locator('#wachtwoordDialoog').waitFor({state:'visible'});if(await page.locator('#gebruikersnaamBlok').isVisible())await page.locator('#gebruikersnaam').fill('testgebruiker');await page.locator('#wachtwoord').fill(PASS);await page.locator('#wachtwoordDoorgaan').click();
 await expect(page.locator('#lijstInkomsten .omschrijving')).toHaveValue('Synthetisch salaris');
});
test('invalid import is atomic, bounded and cannot poison next startup',async({page})=>{
 await open(page);await page.locator('#spaarRek').fill('123');await settled(page);
 const before=await page.evaluate(()=>localStorage.getItem('kasboek:vault:v1'));
 const messages=[];page.on('dialog',async d=>{messages.push(d.message());await d.dismiss();});
 for(const bad of [
  {'kasboek:spaarpot':'{"rekening":999,"contant":0}','kasboek:vastelasten':'[null]'},
  {'kasboek:vastelasten':JSON.stringify([{id:'bad"]',bedrag:1}])},
  {'kasboek:spaarpot':'{"rekening":"Infinity"}'},
  JSON.parse('{"__proto__":"{}"}'),
  {'kasboek:2026-10':'{"opnames":{}}'},
  {'kasboek:inkomsten':JSON.stringify(Array(2001).fill({id:'x'}))},
  'not JSON',
 ]){await upload(page,bad);await expect.poll(()=>messages.length).toBeGreaterThan(0);await expect(page.locator('#importeren')).toBeEnabled();expect(await page.evaluate(()=>localStorage.getItem('kasboek:vault:v1'))).toBe(before);messages.length=0;}
 await page.reload();await open(page,{existing:true});await expect(page.locator('#spaarRek')).toHaveValue('123');
});
test('encrypted backup round trip on another origin; tampering and wrong passwords rejected',async({page,browser})=>{
 await open(page);page.on('dialog',d=>d.dismiss());await upload(page,legacy());await expect(page.locator('#lijstInkomsten .omschrijving')).toHaveValue('Synthetisch salaris');
 const downloadEvent=page.waitForEvent('download');await page.locator('#exporteren').click();const download=await downloadEvent;
 const fs=require('node:fs');const text=fs.readFileSync(await download.path(),'utf8'),envelope=JSON.parse(text);
 expect(envelope.format).toBe('kasboek-vault');expect(text).not.toContain('Synthetisch salaris');expect(text).not.toContain(PASS);
 const context=await browser.newContext(),other=await context.newPage();other.on('dialog',d=>d.dismiss());
 await other.goto('http://127.0.0.1:4174/');await other.locator('#wachtwoordDialoog').waitFor({state:'visible'});if(await other.locator('#gebruikersnaamBlok').isVisible())await other.locator('#gebruikersnaam').fill('testgebruiker');await other.locator('#wachtwoord').fill('Nieuw-apparaat-wachtwoord');await other.locator('#wachtwoordHerhaal').fill('Nieuw-apparaat-wachtwoord');await other.locator('#wachtwoordDoorgaan').click();await expect(other.locator('#wachtwoordDialoog')).not.toBeVisible();
 const before=await other.evaluate(()=>localStorage.getItem('kasboek:vault:v1'));
 const tampered={...envelope,ciphertext:(envelope.ciphertext[0]==='A'?'B':'A')+envelope.ciphertext.slice(1)};
 await upload(other,tampered);await other.locator('#wachtwoordDialoog').waitFor({state:'visible'});if(await other.locator('#gebruikersnaamBlok').isVisible())await other.locator('#gebruikersnaam').fill('testgebruiker');await other.locator('#wachtwoord').fill(PASS);await other.locator('#wachtwoordDoorgaan').click();await expect(other.locator('#wachtwoordFout')).toContainText('Verkeerd wachtwoord');expect(await other.evaluate(()=>localStorage.getItem('kasboek:vault:v1'))).toBe(before);await other.locator('#wachtwoordAnnuleren').click();
 await upload(other,envelope);await other.locator('#wachtwoordDialoog').waitFor({state:'visible'});if(await other.locator('#gebruikersnaamBlok').isVisible())await other.locator('#gebruikersnaam').fill('testgebruiker');await other.locator('#wachtwoord').fill(PASS);await other.locator('#wachtwoordDoorgaan').click();await expect(other.locator('#lijstInkomsten .omschrijving')).toHaveValue('Synthetisch salaris');
 await context.close();
});
test('unsafe URLs and HTML stay inert; only HTTPS links open',async({page})=>{
 await open(page);page.on('dialog',d=>d.dismiss());
 for(const link of ['javascript:window.injected=1','data:text/html,hello','http://example.com','https://user:password@example.com']){
  const data=legacy();data['kasboek:wensenlijst']=JSON.stringify([{id:'x',omschrijving:'<img src=x onerror="window.injected=1">',bedrag:1,link}]);await upload(page,data);
  await expect(page.locator('#lijstWensen .link a')).not.toBeVisible();expect(await page.locator('#lijstWensen img').count()).toBe(0);expect(await page.evaluate(()=>window.injected)).toBeUndefined();
 }
 await page.locator('#lijstWensen .link input').fill('https://example.com');await expect(page.locator('#lijstWensen .link a')).toHaveAttribute('href','https://example.com/');await expect(page.locator('#lijstWensen .link a')).toHaveAttribute('rel','noopener noreferrer');
});
test('a second tab cannot overwrite an open vault',async({page,context})=>{
 await open(page);const second=await context.newPage();await second.goto('/');await expect(second.locator('#wachtwoordUitleg')).toContainText('ander tabblad');await second.close();
});
test('storage failure preserves previous encrypted data',async({page})=>{
 await open(page);const original=await page.evaluate(()=>localStorage.getItem('kasboek:vault:v1'));
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')};});
 await page.locator('#spaarRek').fill('999');await expect(page.locator('#opslagStatus')).toContainText('Opslaan mislukt');
 expect(await page.evaluate(()=>localStorage.getItem('kasboek:vault:v1'))).toBe(original);
});

test('oversized files and hostile KDF settings are rejected before touching storage',async({page})=>{
 await open(page);page.on('dialog',d=>d.dismiss());const before=await page.evaluate(()=>localStorage.getItem('kasboek:vault:v1'));
 await upload(page,'x'.repeat(4*1024*1024+1));await expect(page.locator('#importeren')).toBeEnabled();
 expect(await page.evaluate(()=>localStorage.getItem('kasboek:vault:v1'))).toBe(before);
 await upload(page,{format:'kasboek-vault',version:1,kdf:'PBKDF2-SHA256',iterations:999999999999,salt:'',iv:'',ciphertext:''});
 await expect(page.locator('#importeren')).toBeEnabled();await expect(page.locator('#wachtwoordDialoog')).not.toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('kasboek:vault:v1'))).toBe(before);
});
test('inactivity clears the unlocked app and requires the password again',async({page})=>{
 await page.clock.install();await open(page);await page.locator('#spaarRek').fill('123');await settled(page);
 await page.clock.runFor(10*60*1000+1000);await expect(page.locator('#wachtwoordDialoog')).toBeVisible();
 await expect(page.locator('#spaarRek')).toHaveValue('');
});
