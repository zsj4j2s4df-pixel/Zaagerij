# Zaagerij — Cloudflare

De app gebruikt Cloudflare Access voor login, D1 voor centrale lijsten/versies/voortgang en optioneel R2 voor bijlagen. Supabase is niet nodig.

## Ingericht

- Primary-account: e9922d90d4223d8522e44cb000c5d608.
- Pages: https://zaagerij.pages.dev, GitHub branch versie-2.0, build npm run build, output dist.
- D1: zaagerij, EU-jurisdictie, binding DB. Schema in migrations/0001_zaagerij.sql.
- Access: snowy-snowflake-4760.cloudflareaccess.com, app Zaagerij centrale opslag op /api, e-mailcodes en 24 uur sessie.

Elke API-aanvraag valideert de Access-JWT cryptografisch (issuer, audience, vervaltijd en handtekening) en controleert D1 members. Preview-URL's omzeilen deze controle niet. De publieke app blijft lokaal bruikbaar.

## Medewerkers

Voeg het e-mailadres toe aan de Access Allow-policy en aan D1 members. Rol office mag publiceren; workshop mag lezen en voortgang registreren. Geen open registratie. Klik in de app op Inloggen via Cloudflare. Access vraagt een e-mailcode.

## R2 activeren

Cloudflare vereist eenmalige activering van R2 Object Storage via het dashboard. Controleer zelf de voorwaarden en eventuele facturering. De API geeft anders 403 Please enable R2. Daarna: private bucket zaagerij-bestanden, binding FILES in Pages productie, opnieuw deployen. Schakel publieke buckettoegang niet in.

Bij publiceren uploadt de app lokale bijlagen zodra FILES actief is. Andere apparaten kunnen ze via de beveiligde API downloaden. Tot activering blijven bijlagen in IndexedDB op het oorspronkelijke apparaat. Een JSON-back-up bevat geen bijlagebytes.

## OpenAI

De sleutel wordt bij OpenAI aangemaakt. Gebruik de beveiligde sleutelkeuze uit de sessie of sla OPENAI_API_KEY op als Secret in het Zaagerij Pages-project. Geef sleutels nooit in chat of Git door. Geen VITE-prefix gebruiken. Optioneel OPENAI_MODEL; standaard gpt-4.1-mini.

De functie controleert Access, lidmaatschap, bestandsgrootte en een atomaire D1-quota van maximaal 30 herkenningspogingen per medewerker per dag. Controle door de gebruiker blijft verplicht. Stel ook een OpenAI-projectbudget in. Native SolidWorks-conversie is nog niet aangesloten.

## Versies en voortgang

Atomaire versievergelijking voorkomt overschrijven; eerdere documenten worden bewaard. De werkplaats accepteert nieuwe versies expliciet. Voortgang synchroniseert via een knop; offline werk blijft lokaal. De server controleert versie, stukidentiteit en maatgegevens. Correcties van reeds centraal geregistreerde voortgang vragen nog afstemming met kantoor.

## Origineel

De originele app blijft op /origineel/. GitHub main en backup/origineel-2026-10-29 blijven ongewijzigd. Download lokale lijsten voordat je naar een ander domein verhuist. Waterslag en bestaande Supabase-projecten worden niet aangepast.
