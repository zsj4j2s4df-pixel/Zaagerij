# Zaagerij — centrale installatie

## 1. Supabase

Kies expliciet het bedoelde project; raak bestaande tabellen van andere apps niet aan. Voer de SQL in `supabase/migrations/20261029141029_zaagerij_v2.sql` één keer uit. Elke publieke tabel heeft RLS. Alleen ingeschreven Zaagerij-medewerkers krijgen toegang; de frontend kan zichzelf geen lid maken.

Maak medewerkers aan via Supabase Authentication → Users → Invite user. Maak één team-UUID en voeg per bestaande auth-user een rij toe aan `zaagerij_members`: user_id, team_id en role (`office` of `workshop`). Houd team_id gelijk voor collega's. Gebruik uitsluitend echte auth-user-ID's; geef jezelf `office`.

Stel bij Authentication → URL Configuration de gepubliceerde HTTPS-site in als Site URL en voeg de gebruikte callback-URL toe aan Redirect URLs. De frontend vraagt een e-maillink aan met `shouldCreateUser:false`.

## 2. Publieke browserconfiguratie

Vul Cloudflare Pages build variables in:

- `VITE_SUPABASE_URL`: Supabase Project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key, nooit een secret/service-role key.

Stel voor de serverfunctie ook `SUPABASE_URL` en `SUPABASE_PUBLISHABLE_KEY` in. Deze namen zijn bewust verschillend van de Vite-variabelen.

## 3. OpenAI veilig koppelen

Een OpenAI API-sleutel wordt bij OpenAI aangemaakt, niet bij Supabase of Cloudflare. Gebruik de beveiligde sleutelkeuze die in deze sessie is geopend. Geef de sleutel nooit in chat of Git door.

Na het aanmaken: open in Cloudflare het **Zaagerij** Pages-project → Settings → Variables and Secrets. Voeg `OPENAI_API_KEY` toe als **Secret** voor de bedoelde omgeving. De sleutel hoort uitsluitend op de server. Zet optioneel `OPENAI_MODEL` op een model met beeld- en PDF-invoer en structured outputs; standaard `gpt-4.1-mini`.

Plaats nooit `VITE_OPENAI_API_KEY` in de build. Stel een passend projectbudget bij OpenAI in. De serverfunctie controleert de ingelogde gebruiker en Zaagerij-lidmaatschap, beperkt de invoergrootte en laat per gebruiker maximaal 30 herkenningspogingen per dag toe via een atomaire databasefunctie. De quota is geen vervanging voor een providerbudget.

## 4. Publiceren

Koppel alleen repository `zsj4j2s4df-pixel/Zaagerij` aan het bedoelde Cloudflare-account. Productiebranch: `versie-2.0`. Build command: `npm ci && npm run build`. Output directory: `dist`. De root bevat Pages Functions onder `functions/`.

Na toevoegen van omgevingsvariabelen opnieuw deployen. Controleer een lokale lijst, login, centraal publiceren, QR openen op tweede apparaat, nieuwe versie accepteren en voortgang synchroniseren. Test daarna een foto en PDF. CAD-bestanden tonen bewust ‘Conversie nodig’; er is geen native SolidWorks-parser.

## 5. Offline en voortgang

Lokaal opslaan werkt zonder login. Centrale publicatie is voor kantoor. De werkplaats synchroniseert voortgang expliciet; bij offline gebruik blijven registraties lokaal totdat opnieuw verbonden en gesynchroniseerd wordt. Hetzelfde stuk op meerdere apparaten telt centraal eenmaal mee. Een centrale voortgangscorrectie/ongedaan maken is nog niet als gedeelde correctieprocedure uitgewerkt; stem correcties daarom af met kantoor.

Bijlagen blijven in deze versie op het apparaat waarop ze zijn toegevoegd. Download deze afzonderlijk voor archivering; cross-device bestanden delen vraagt een private Storage-bucket en is nog niet geactiveerd.

## 6. Terugschakelen

De oorspronkelijke GitHub Pages-site blijft op `main`. De code is ook vastgelegd in `backup/origineel-2026-10-29` en de nieuwe build bevat `/origineel/`. Open de oude site of publiceer die backupbranch opnieuw. Download voor een overgang eerst de zaaglijsten: lokale opslag verhuist niet automatisch tussen domeinen.
