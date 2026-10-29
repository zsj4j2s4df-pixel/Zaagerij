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

De planner gebruikt conservatief twee losse sneden per stuk en zaagverlies `kerf/sin(tekenhoek)`. Er wordt geen gedeelde versteksnede of geometrische overlap geclaimd. De tijdstrategie kiest uit de eerst bereikbare sneden per staaf. Dit is een heuristiek en geen bewezen globaal optimum. Restmateriaal is een gemeten restlengte, nog niet automatisch ingedeeld in bewaarbaar reststuk versus afval op basis van een bedrijfsgrens.

Bij herplannen vanuit een afwijking: meet de resterende lengte en eindhoek opnieuw. Niet-geregistreerde halfproducten moeten eerst worden afgehandeld; de app modelleert geen afzonderlijke voorraad halfproducten. Vooruitgang blijft lokaal totdat je die expliciet synchroniseert. Verschillen in kantoorversie vereisen acceptatie.

## Origineel en andere projecten

`main` en `backup/origineel-2026-10-29` bewaren de originele code. De nieuwe build bevat daarnaast `/origineel/`. Originele lokale browsergegevens zijn herkomstgebonden: download/importeer een back-up wanneer je naar een ander webadres gaat. Het afzonderlijke project in `waterslag/` wordt niet gewijzigd, gebouwd of gepubliceerd door deze versie.

## Huisstijl

Het originele blauwe bedrijfslogo komt van `https://www.avandervelden.nl/img/VanDerVeldenLogoBluw.svg` (opgehaald 29 oktober 2026). Blauw `#006bd5` komt uit dat logo. Paars `#7654b3` is een voorgestelde ondersteunende kleur; niet als exacte kleurmeting uit de video bevestigd.

## Verificatie

`npm test` controleert de rekenbalans, aantallen, zaagverlies, profielscheiding en fysieke snedevolgorde. Browserchecks controleren opslag/kopie, mobiele uitvoering, verwijderbevestiging en zichtbare bijlagen. Screenshots staan in `docs/`.
