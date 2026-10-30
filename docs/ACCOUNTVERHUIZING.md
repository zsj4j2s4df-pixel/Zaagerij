# Cloudflare-accountverhuizing

Doel op verzoek van de gebruiker: Cloudflare-account Jesse Boontje,
`7d5fa36f0987a01dcf47b34791495fa6`. GitHub blijft
`zsj4j2s4df-pixel/Zaagerij`; een GitHub-overdracht is niet gewenst.

## Al voorbereid

- D1 `zaagerij`, EU, ID `97758236-9df7-46e1-83b1-4891c9972034`.
- Schema uit `migrations/0001_zaagerij.sql`, inclusief versietriggers.
- Beheerder `jesseboontje@hotmail.com`, rol `office`.
- Broncontrole op 30 oktober 2026: nul centrale projecten, versies,
  voortgangsregels, bijlageregistraties en AI-verbruik; één lid.
  Controleer dit opnieuw vóór omschakelen: dit is geen doorlopende replicatie.

## Blokkades vastgesteld via API

- Doelaccount: R2 geeft `Please enable R2 through the Cloudflare Dashboard`.
- Doelaccount: Access geeft `access.api.error.not_enabled`.
- Aanmaken Pages met dezelfde GitHub-repository geeft fout `8000093`:
  repository al gekoppeld aan Pages in een ander account. Er is geen tweede
  Pages-project gemaakt en niets verwijderd of losgekoppeld in het bronaccount.
- `OPENAI_API_KEY` is in het bronproject een versleuteld Cloudflare-secret.
  De waarde is niet uitleesbaar voor overzetten; opnieuw veilig invoeren in
  het doelproject. Nooit een sleutel in git of dit document plaatsen.

## Afronden zodra dashboardactivatie gereed is

1. R2 activeren in het doelaccount; private bucket `zaagerij-bestanden` maken.
2. Zero Trust/Access activeren; eenmalige e-mailcode en een Access-app met
   uitsluitend Jesse als toegestane gebruiker instellen. Nieuwe teamdomein en
   audience horen in `ACCESS_TEAM_DOMAIN` en `ACCESS_AUD`.
3. Verhuisprocedure voor de Git-koppeling controleren aan de hand van
   https://developers.cloudflare.com/pages/platform/git-integration/ .
   Niet eerst het live bronproject verwijderen om een koppeling vrij te maken.
   Bronconfiguratie, domeinbehoud en terugval moeten vooraf vaststaan.
4. Doelproject met D1-binding `DB`, R2-binding `FILES` en secret aanmaken;
   alleen vrijgeven als Access en server-JWT-controle beide werken.
5. Vóór omschakelen nieuwe centrale data en R2-objecten opnieuw controleren
   en zo nodig overnemen. Lokale lijsten/IndexedDB worden niet automatisch
   meegenomen naar een andere domeinnaam: eerst exporteren en import testen.
6. Login, opslaan, bijlage en AI testen; daarna pas oude configuratie opruimen.

De bestaande app https://zaagerij.pages.dev/ draait voorlopig in het bronaccount.
Een Cloudflare-beheerlogin is iets anders dan de werkplaatslogin via Access;
voor die laatste was Jesse al toegelaten.
