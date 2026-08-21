# Kasboek — Doelstelling & huisstijl-brief

Kort document om een logo te (laten) maken en de huisstijl consistent aan te passen.

## 1. Wat is Kasboek?

Kasboek is een eenvoudig, eerlijk huishoudboekje dat in één zelfstandig
HTML-bestand draait. Het houdt **rekening en contant apart** bij en geeft per
maand overzicht over vaste lasten, opnames, losse uitgaven, spaarpotten en een
wensenlijst — met een ingebouwde **kascontrole** om te tellen of het klopt.
Alle gegevens blijven **lokaal in de eigen browser**; er gaat niets naar een
server.

## 2. Doelstelling (missie)

> Mensen rustig en zonder ruis grip geven op hun geld — precies zien wat er op
> de rekening en in de portemonnee overblijft, zodat elke uitgave een bewuste
> keuze is in plaats van een verrassing.

Kernbelofte: **overzicht, eerlijkheid en rust.** Geen bank-koppeling, geen
reclame, geen ingewikkelde grafieken — gewoon tellen wat er is en zien wat kan.

## 3. Doelgroep

- Mensen die hun huishoudgeld met de hand willen bijhouden en overzicht willen.
- Mensen die deels contant leven (opnames, portemonnee) naast hun rekening.
- Waardeert privacy en eenvoud boven fancy features.
- Gebruikt de app vooral op de telefoon (thuisscherm-app).

## 4. Persoonlijkheid & tone of voice

| Wél | Niet |
|-----|------|
| Rustig, nuchter, betrouwbaar | Druk, hip, schreeuwerig |
| Warm en menselijk | Koud en corporate |
| Ambachtelijk / analoog (papier, inkt) | Digitaal-glimmend, neon |
| Helder en direct in taal | Jargon of bank-taal |

Toon in teksten: kort, vriendelijk, geruststellend. ("Deze maand blijft er
niets over om te sparen." / "5× gespaard".)

## 5. Kernwaarden voor het beeld

1. **Eerlijk** — laat de echte cijfers zien, ook als het tegenvalt.
2. **Overzichtelijk** — rust, witruimte, één ding tegelijk.
3. **Analoog gevoel** — het kasboek/ledger als warm, tastbaar object.
4. **Privé** — van jou, blijft bij jou.

## 6. Visuele richting (bestaande stijl, vastgelegd)

De app heeft al een duidelijke "papier & inkt"-look. Bouw daarop voort.

### Kleuren

| Rol | Naam | Hex |
|-----|------|-----|
| Achtergrond (papier) | papier | `#F6F2E9` |
| Kaart / vlak | kaart | `#FFFFFF` |
| Rand / lijn | rand | `#E4DFD3` |
| Tekst (inkt) | inkt | `#24211D` |
| Grijstint | grijs | `#6B6558` |
| Positief / spaar | groen | `#3F6B4B` |
| Let op / krap | oranje | `#C97F1E` |
| Tekort / fout | rood | `#A8462E` |
| Rekening | blauw | `#3D5A80` (diep: `#2C3E50`) |
| Contant | bruin | `#8C6D3F` (diep: `#463726`) |
| Accent | goud | `#B98A3D` |

Sfeer: warm, aards, ingetogen. Geen felle primaire kleuren.

### Typografie

- Interface: systeem-sans (San Francisco / Segoe / Roboto) — schoon en neutraal.
- Bedragen: **monospace met tabular numerals** (uitgelijnde cijfers, als een
  echt kasboek). Dit is een handtekening-element — laat het terugkomen in het
  logo of woordmerk waar cijfers voorkomen.

### Vormtaal

- Rechte, rustige vlakken met kleine hoekafronding (≈6 px).
- Dunne lijnen en gestreepte "ledger"-regels (het papier heeft liniatuur).
- Veel witruimte; niets overladen.

## 7. Logo-richting

**Wat het moet uitstralen:** een warm, betrouwbaar kasboek — overzicht en rust,
met een analoge/ambachtelijke knipoog.

**Ideeën / motieven om te verkennen:**
- Een gesloten of half-open **kasboek/grootboek** met liniatuur.
- Een **munt of muntstapel** gecombineerd met een lijntje (rekening ↔ contant).
- De **€** verwerkt in een boek-rug of in tabular-cijfers.
- Twee "potjes" (rekening blauw, contant bruin) als subtiel dubbelmotief.

**Do's**
- Werkt in één kleur (inkt op papier) én in de aardse kleurenset.
- Herkenbaar klein: als **app-icoon** en **favicon**.
- Rustig, tijdloos, niet trendgevoelig.

**Don'ts**
- Geen glans, verloop-neon of 3D-effecten.
- Geen drukke illustratie met veel details.
- Geen bank-/creditcard-clichés.

**Benodigde formaten**
- App-icoon: 192×192 en 512×512 px (PNG, met marge).
- Favicon: 32×32 (moet als silhouet herkenbaar blijven).
- Splashscreen: logo gecentreerd op papier-achtergrond (`#F6F2E9`).
- Liefst ook een schaalbare **SVG** van het beeldmerk.

## 8. Toepassingen om rekening mee te houden

- Thuisscherm-app op telefoon (icoon + naam "Kasboek").
- Bovenaan in de app: woordmerk "Kasboek".
- `manifest.json` met `theme-color` `#F6F2E9` en de icoon-set.

## 9. In één zin (voor een ontwerp-brief of AI-prompt)

> Ontwerp een rustig, warm logo voor "Kasboek", een privé-huishoudboekje:
> een analoog kasboek/ledger-gevoel met inkt-op-papier, aardse tinten
> (papier `#F6F2E9`, inkt `#24211D`, groen `#3F6B4B`, blauw `#3D5A80`,
> bruin `#8C6D3F`), monospace cijfers, tijdloos en herkenbaar als klein
> app-icoon.
