# Zaagerij 2.0

Voorbereiden op kantoor, aflezen en registreren bij de metaalzaag. React + Vite, met Cloudflare Access, D1-opslag en een Cloudflare Pages Function voor OpenAI-tekeningherkenning.

## Starten

```sh
npm ci
npm run dev
npm test
npm run test:e2e
npm run build
```

Publiceer `dist/` met de `functions/` map als Cloudflare Pages-project. Build: `npm ci && npm run build`, output: `dist`, branch: `versie-2.0`.

## Wat werkt lokaal

- Projecten, Opslaan en Opslaan als, JSON-import/export (ook originele Zaagerij-formaten).
- Stuknummers, meerdere profielen/handelslengtes, maatbasis en hoekuitleg.
- Zelfstandige sneden met geprojecteerde zaagdikte, reststukken en controle op aantallen/materiaalbalans.
- Uitvoering met vastgelegd plan, individuele snederegistratie, omkeren per profiel en afwijkingen.
- Foto/camera, PDF en CAD-bijlagen met zichtbare status. Bijlagebytes blijven in IndexedDB op het apparaat; JSON-back-ups en centrale documenten bevatten alleen metadata.
- Offline cache na eerste bezoek. Open de pagina en relevante schermen eerst online.

## Centrale onderdelen

Zie [installatie](docs/INSTALLATIE.md). D1 en Access zijn ingericht. Toegang vereist een toegelaten medewerker. R2 en de OpenAI-secret moeten nog worden geactiveerd voor centrale bijlagen en AI. Ontbrekende configuratie wordt expliciet gemeld.

## Rekenmodel en grenzen

De maatbasis is standaard de bounding lengte tussen buitenste lange punten in één zaagvlak. Korte maat en hartmaat worden omgerekend met de breedte in dat vlak. 90° tekenhoek = 0° machinehoek. Hoeken 15–165°; geen samengestelde 3D-hoeken. Voor richting en omkeren moet de machineconventie ter plaatse worden bevestigd.

De planner gebruikt standaard twee losse sneden per stuk en geprojecteerd zaagverlies `kerf/sin(tekenhoek)`. Met Combineren ingeschakeld mogen opeenvolgende uiteinden één snede delen als hun snijvlakken in hetzelfde zaagvlak overeenkomen, inclusief snijrichting en toegestane oriëntatie. De twee zijden van elk profiel worden afzonderlijk gecontroleerd; bij een gedeelde snede worden beide betrokken stukuiteinden geregistreerd. De tijdstrategie kiest uit de eerst bereikbare sneden per staaf. Dit is een heuristiek en geen bewezen globaal optimum. Restmateriaal is een gemeten restlengte, nog niet automatisch ingedeeld in bewaarbaar reststuk versus afval op basis van een bedrijfsgrens.

Bij herplannen vanuit een afwijking: meet de resterende lengte en eindhoek opnieuw. Niet-geregistreerde halfproducten moeten eerst worden afgehandeld; de app modelleert geen afzonderlijke voorraad halfproducten. Vooruitgang blijft lokaal totdat je die expliciet synchroniseert. Verschillen in kantoorversie vereisen acceptatie.

## Origineel en andere projecten

`main` en `backup/origineel-2026-10-29` bewaren de originele code. De nieuwe build bevat daarnaast `/origineel/`. Originele lokale browsergegevens zijn herkomstgebonden: download/importeer een back-up wanneer je naar een ander webadres gaat. Het afzonderlijke project in `waterslag/` wordt niet gewijzigd, gebouwd of gepubliceerd door deze versie.

## Huisstijl

Het originele blauwe bedrijfslogo komt van `https://www.avandervelden.nl/img/VanDerVeldenLogoBluw.svg` (opgehaald 29 oktober 2026). Blauw `#006bd5` komt uit dat logo. Paars `#7654b3` is een voorgestelde ondersteunende kleur; niet als exacte kleurmeting uit de video bevestigd.

## Verificatie

`npm test` controleert de rekenbalans, aantallen, zaagverlies, profielscheiding en fysieke snedevolgorde. Browserchecks controleren opslag/kopie, mobiele uitvoering, verwijderbevestiging en zichtbare bijlagen. Screenshots staan in `docs/`.

## Ontwerp beoordelen

Open `/review/` voor de actuele derde ronde met acht mobiele schermvoorbeelden. Eerdere rondes met hun lokale opmerkingen blijven bereikbaar via `/review/?round=1` en `/review/?round=2`. Wissel met Vorige/Volgende, teken met vinger/muis en plaats opmerkingen. Alles blijft lokaal in de browser. Download de ZIP om opmerkingen en geannoteerde PNG's met de ontwikkelaar te delen; er wordt niets automatisch verstuurd. De voorbeelden bevatten uitsluitend demo-invoer. Regenereren na schermwijzigingen: draai de ontwikkelserver op poort 5173 en voer `node scripts/review-assets.mjs` uit.

Het appicoon is versiegebonden en gebruikt het originele bedrijfsbeeldmerk. iOS kan een eerder geïnstalleerd beginschermicoon vasthouden; verwijder in dat geval alleen de snelkoppeling en voeg de website opnieuw toe aan het beginscherm. Wis geen websitegegevens: lokale zaaglijsten staan daarin.

## Werkplaatsbediening

Het staafbeeld staat centraal en gebruikt een vaste kleur per stuk, ook in de invoer. Tik op een stuk om het na bevestiging gereed te melden. Identieke indelingen zijn gegroepeerd, maar kunnen per staaf worden geopend voor individuele registratie. Veeg links voor het gereedoverzicht en rechts om terug te keren op dezelfde scrollpositie; de knop onderaan werkt ook. Formuliervelden en horizontaal scrollbare vlakken activeren geen veegactie.

De instructie voor de volgende snede is inklapbaar. Omkeren betekent rollen om de lengteas: onderzijde wordt bovenzijde, zonder linker- en rechteruiteinde te verwisselen. De tekening wordt voor deze instructie naar de werkelijke kijkrichting omgezet. Groene grenzen in het staafbeeld zijn gedeelde sneden; de detailweergave toont de hoekrichting en oriëntatie per stuk. De weergave is schematisch. Zaagplannen van vóór dit geometrische model vragen expliciet om vernieuwen; reeds gezaagd materiaal moet via Afwijken met een gemeten restant worden voortgezet.

Print/PDF bevat order- en klantgegevens, staafindelingen en bij centrale publicatie een QR-code. Dezelfde centrale link kan via WhatsApp, e-mail of het deelmenu van de telefoon worden doorgestuurd. Profielgeheugen blijft lokaal op het apparaat; materiaalkeuze is apart van profielafmeting.

## Tekeningherkenning en machineopstelling

Zie [MCP-onderzoek en importstrategie](docs/TEKENINGHERKENNING.md) voor Werk24, native SolidWorks en alternatieven. Er is geen nieuwe externe leverancier gekoppeld. De bestaande OpenAI-lezer toont per veld broninformatie, onderscheidt gevonden/afgeleide/ontbrekende waarden en ondersteunt een optionele tweede tekening of stuklijst. Elk stuk vereist controle en een expliciete profielkeuze; onbekende aantallen krijgen geen standaardwaarde. De tests voor de herkenningsroute gebruiken gesimuleerde providerantwoorden en meten geen echte OCR-nauwkeurigheid.

De bevestigde praktijkopstelling is verwerkt: aanvoer links, afgemeten stuk rechts, het lange punt tegen de rechter aanslag. Het ongebruikte restant staat links in het staafbeeld; de volgorde loopt vanaf rechts. Eerst wordt rechts voorbereid, daarna links afgezaagd. Ook bij korte-punt- of hartmaatinvoer toont de werkplaats de omgerekende lange aanslagmaat. Oude uitvoeringsplannen worden expliciet als vernieuwingsplichtig gemarkeerd.
