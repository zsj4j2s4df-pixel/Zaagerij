# Technische tekeningen uitlezen — onderzoek 30 oktober 2026

Exa: 25 zoekresultaten over gespecialiseerde engineering-OCR, CAD-MCP en native SolidWorks/FreeCAD-koppelingen. Primaire documentatie en repositories gecontroleerd. Plugin-directory apart doorzocht; geen Werk24/SolidWorks/FreeCAD-plugin gevonden in de beschikbare zoekresultaten. Dat sluit andere custom MCP's niet uit.

## Advies voor Zaagerij

| Route | Wat is geverifieerd | Beperking / toepassing |
|---|---|---|
| Werk24 officiële MCP | Hosted MCP op https://mcp.w24.co/mcp, Streamable HTTP, OAuth. Tools list_ask_types/read_drawing, engineeringvelden zoals maten/toleranties, metadata en stuklijst. | Account met abonnement en betaalmethode vereist. PDF/TIFF/JPEG/PNG; geen native SLDPRT/SLDDRW, STEP, DXF of DWG. Niet gekoppeld of betaald getest. |
| Werk24 HTTP API | Volgens de officiële MCP-documentatie geschikter voor een vaste serverworkflow en verwerking zonder interactieve agent. | Voor productie in de webapp waarschijnlijk eenvoudiger dan een MCP-client met OAuth. Eerst kwaliteit en prijs met eigen tekeningen vergelijken. |
| SolidWorks-MCP | Native documenten kunnen via COM op een Windows/SolidWorks-pc worden geopend; modelmaten, eigenschappen en tekenaanzichten zijn uitleesbaar. | Communitysoftware, versiegebonden en niet op Cloudflare Workers uitvoerbaar. Bouw uitsluitend een afgeschermde lees/exportverbinding, geen openbaar CAD-besturingsendpoint. |
| CAKE | MCP met uitlezen van DXF-entiteiten, dimensies, teksten en PDF-tekst/uitsneden. | Structurele CAD/PDF-extractie, geen bewezen volledig automatische zaaglijstherkenning. DWG-conversie vraagt een geschikte lokale CAD-engine. |
| FreeCAD-MCP | Document-/object-/vormanalyse en neutrale CAD-invoer kunnen geometrische data geven. | Geen gelijkwaardige native SolidWorks-tekeninglezer. Een bounding box is geen bewijs voor de bedoelde zaaglengte, aantallen of tolerantie. |

MCP is de toegangsvorm tot gereedschap; de extractie, juiste koppeling van maatlijnen aan stukken en verificatie bepalen de betrouwbaarheid. Een leveranciersclaim over algemene nauwkeurigheid zegt niet of alle kritische velden in een zaaglijst correct zijn.

## Voorwaarden voor betrouwbare import

- Voorkeur: expliciete brongegevens uit een native CAD-cutlist, BOM of digitale PDF. Foto's/scans zijn de minder zekere route. Meet geen werkelijke maten uit foto-perspectief of pixels.
- Koppel een eventuele aparte stuklijst op exact stuknummer. Tel verschillende aanzichten van hetzelfde onderdeel niet als extra stukken.
- Houd aantallen onbekend wanneer een getekend enkel onderdeel geen expliciet aantal heeft. Standaard 1 invullen is onjuist.
- Verwar een afschuining (bijvoorbeeld 2 × 45°), gatmaat of boorhoek niet met een eindzaaghoek of totale stuklengte.
- Per numeriek veld: bronbestand, blad, bronfragment, eventueel plaatsvak, en onderscheid tussen letterlijk gevonden, afgeleid en ontbrekend. Een door een model aangewezen plaatsvak is zelf ook een voorspelling.
- Controleer per regel het profiel, materiaal, maatbasis, eenheden en aantallen voordat de regel wordt toegevoegd. Onvolledige documenten worden niet als complete lijst aangeboden.
- Vergelijk vóór kiezen van een betaalde koppeling 5–10 representatieve eigen tekeningen met een handmatig gecontroleerde lijst. Meet vooral stilzwijgend foute of verzonnen kritische velden. In deze sessie is geen technische productietekening aangeleverd; de foto's tonen de machineopstelling. Er is dus nog geen gemeten herkenningsnauwkeurigheid op eigen tekeningen.

De bestaande OpenAI-route is uitgebreid met brongegevens en een optionele tweede bijlage. Werk24 is niet aangesloten en er zijn geen klantbestanden aan deze nieuwe leverancier gestuurd. Een serverintegratie zou tijdelijke bestandslinks of directe uploads moeten gebruiken; een door Access afgeschermde viewerlink is niet vanzelf door een externe lezer op te halen.

## Bevestigde machineopstelling

De gebruiker heeft bevestigd: aanvoer links; het afgemeten stuk rechts van het blad; lengteaanslag rechts; het lange punt raakt de aanslag. Opdrachten kunnen een losse stuklijst hebben. Exacte hoeken worden niet uit de machinefoto's gemeten.

Daarom: de staafverdeling staat tegen rechts uitgelijnd, het ongebruikte restant staat links en de snedevolgorde loopt van rechts naar links. Eerst het rechter uiteinde voorbereiden, daarna links op maat afzagen. Een gedeelde snede is de linkerzijde van het zojuist afgezaagde rechter stuk en de rechterzijde van het volgende stuk links daarvan. De onder-/bovenzijde wordt per handeling in dezelfde referentie weergegeven. Bij korte-punt- of hartmaat toont het zaagscherm de omgerekende lange aanslagmaat.

## Primaire bronnen

- Officiële Werk24-MCP-documentatie: https://v2.docs.werk24.io/low-code/mcp/
- Werk24-integraties: https://werk24.io/integrations
- Community SolidWorks 2021-brug: https://github.com/haunchen/solidworks-mcp (alleen 2021 getest; README vermeldt geen ingebouwde authenticatie).
- SolidPilot: https://github.com/eyfel/mcp-server-solidworks (SolidWorks 2026 SP3 als doel; native SLDDRW-reader wordt als test/reference beschreven, DXF/DWG-reader uitgebreider).
- CAKE: https://github.com/luckyman9487/CAKE
- FreeCAD-vormanalyse: https://github.com/theosib/FreeCAD-MCP-Server

### Hoekbetekenis en vaste berekening

De herkenner onderscheidt per uiteinde een zaaghoek t.o.v. de lengteas,
een machine-instelling vanuit recht, een binnenhoek en een richtingsverandering.
Alleen bij aantoonbaar symmetrisch verstek mag de server een verbindingshoek
verdelen. Binnenhoek 135° en richtingsverandering 45° leveren beide machine
22,5° en tekeningszaaghoek 67,5°. Een stompe haakse aansluiting heeft juist
zaaghoek 90° en machine 0°. De eerder uitgesproken 51° was een
spraakmisverstand en vormt geen projectgegeven.

De server herberekent hoekwaarden uit deze classificatie; onduidelijke
verbindingen blijven leeg. De controleweergave toont de gebruikte hoek en formule.
Dit voorkomt rekenfouten na de classificatie, maar bewijst niet dat de AI de
verbinding goed heeft herkend. Samenstellingslengtes mogen alleen uit sluitende
maatketens worden afgeleid, met uitleg in de notitie. Een onafhankelijke
algemene oplosser voor samenstellingsgeometrie en genummerde beeldsegmentatie
zijn hiermee nog niet gerealiseerd. Praktijkvalidatie met de twee ingestuurde
foto's via de echte API staat nog open.
