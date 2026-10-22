# Kasboek

Huishoudboekje met aparte saldi voor rekening en contant, vaste lasten,
opnames, losse uitgaven, wensen en maandelijkse kascontrole.

## Online

De actuele app staat op **https://kasboek.zsj4j2s4df.workers.dev/**.
De oude GitHub Pages-versie toont instructies voor het overzetten van gegevens.

## Gegevens en wachtwoord

Alle financiële gegevens blijven in je browser. Ze worden niet naar Cloudflare,
GitHub of een andere server verstuurd. Bij het eerste gebruik kies je een uniek
wachtwoord van minimaal 12 tekens. Bewaar dat in een wachtwoordmanager: er is
geen herstelmogelijkheid zonder je wachtwoord.

Browseropslag en nieuwe back-ups zijn versleuteld met AES-256-GCM en een sleutel
afgeleid via PBKDF2-SHA256 (600.000 iteraties, willekeurig zout van 16 bytes).
Elke opslag krijgt een nieuwe willekeurige IV van 12 bytes. Het wachtwoord en de
sleutel worden niet opgeslagen. Een tweede tabblad mag niet tegelijk schrijven.
De app vergrendelt bij herladen, met de knop Vergrendelen en na 10 minuten
inactiviteit. Tijdens gebruik zijn gegevens in het geheugen ontsleuteld.

Gebruik een beveiligd apparaat en een recente browser met Web Crypto, Web Locks
en ondersteuning voor HTML-dialogen. Versleuteling beschermt niet tegen malware,
onbetrouwbare browserextensies of gewijzigde appcode die draait terwijl je de app
ontgrendelt. Browsergegevens wissen verwijdert ook je kasboek: maak regelmatig
versleutelde back-ups. Reeds bestaande onversleutelde back-ups worden niet
achteraf versleuteld; verwijder die zelf zodra je de nieuwe back-up hebt getest.

## Overstappen vanaf GitHub Pages

1. Open de oude app op dezelfde telefoon/browser waarin je gegevens staan:
   https://zsj4j2s4df-pixel.github.io/Kasboek/.
2. Kies een wachtwoord. De bestaande gegevens worden pas uit de oude opslag
   verwijderd nadat de versleutelde kopie succesvol is opgeslagen.
3. Kies **Versleutelde back-up opslaan**.
4. Open het nieuwe adres, kies een wachtwoord en kies **Back-up terugzetten**.
5. Vul het wachtwoord van de back-up in en controleer je bedragen.

Gegevens worden niet automatisch tussen verschillende hostnamen overgezet.
De app accepteert ook bestaande JSON-back-ups, maar controleert vóór opslag de
volledige structuur, aantallen, bedragen, datums en identifiers. Bij fouten
blijft de eerdere versleutelde opslag behouden. Geïmporteerde sleutels vervangen
dezelfde sleutels in je kasboek; overige maanden blijven behouden. Alleen
HTTPS-links zonder gebruikersnaam of wachtwoord zijn aanklikbaar.

## Ontwikkeling en controle

```sh
npm ci
npx playwright install chromium
npm test
```

De tests controleren versleuteling, foutieve wachtwoorden, gemanipuleerde en oude
back-ups, opslagfouten, onveilige links, tabbladen, headers en appfuncties.
GitHub Actions voert dezelfde controles uit bij pull requests en op `main`.

## Publiceren

`npm run build` bouwt `dist/worker-bundle.mjs`. Dit bevat uitsluitend de expliciet
toegestane publieke bestanden. De Worker accepteert alleen GET en HEAD en zet
onder meer CSP, frameblokkering, HSTS, no-store en no-referrer op alle antwoorden.
De HTML heeft daarnaast een CSP voor GitHub Pages; frameblokkering vereist de
HTTP-headers van de nieuwe Cloudflare-host.

Cloudflare-configuratie: `wrangler.jsonc`. Publiceren met een geautoriseerde
Cloudflare-koppeling via de Workers API of met Wrangler. Deploy na wijzigingen
altijd opnieuw vanaf de geteste commit. De huidige inrichting voert geen
Cloudflare-deploy uit vanuit GitHub Actions en heeft daar geen API-token nodig.

Branchbeveiliging hoort pull requests, geslaagde `Security checks`, geen force
pushes en geen verwijdering van `main` af te dwingen. Het wijzigen daarvan
vereist afzonderlijke GitHub-beheerrechten.

Met een GitHub-koppeling met voldoende beheerrechten kan de branchbeveiliging
worden ingesteld met:

```sh
gh api --method PUT repos/zsj4j2s4df-pixel/Kasboek/branches/main/protection \
  --input scripts/branch-protection.json
```

Dit vereist een pull request en geslaagde automatische controles, ook voor
beheerders. Het vereist geen tweede menselijke goedkeurder: dit is een
persoonlijke repository. Force pushes en verwijderen van `main` zijn verboden.
