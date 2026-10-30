import { signatureMatches } from "../../../../src/engine.js";
import { json, bodyJson } from "../../../_lib/security.js";
export async function onRequestPost({ request, env, params, data }) {
  const { events, version } = await bodyJson(request);
  if (!Array.isArray(events) || events.length > 2000)
    return json({ error: "Ongeldige voortgang." }, 400);
  const row = await env.DB.prepare(
    "SELECT version,document FROM projects WHERE id=?",
  )
    .bind(params.id)
    .first();
  if (!row) return json({ error: "Zaaglijst niet gevonden." }, 404);
  if (row.version !== version)
    return json(
      {
        error:
          "Nieuwe kantoorversie beschikbaar. Accepteer die vóór synchroniseren.",
      },
      409,
    );
  const doc = JSON.parse(row.document);
  const statements = [];
  for (const event of events) {
    if (event.kind !== "good" || typeof event.unit !== "string")
      return json({ error: "Ongeldige registratie." }, 400);
    const separator = event.unit.lastIndexOf(":"),
      id = event.unit.slice(0, separator),
      i = Number(event.unit.slice(separator + 1)),
      piece = doc.pieces.find((p) => p.id === id);
    if (
      !piece ||
      !Number.isInteger(i) ||
      i < 0 ||
      i >= +piece.qty ||
      !signatureMatches(event.signature, piece)
    )
      return json(
        { error: "Stukgegevens zijn veranderd. Controleer de kantoorversie." },
        409,
      );
    statements.push(
      env.DB.prepare(
        "INSERT INTO progress(project_id,unit,event,author) VALUES(?,?,?,?) ON CONFLICT(project_id,unit) DO NOTHING",
      ).bind(params.id, event.unit, JSON.stringify(event), data.user.email),
    );
  }
  if (statements.length) await env.DB.batch(statements);
  const { results } = await env.DB.prepare(
    "SELECT event FROM progress WHERE project_id=?",
  )
    .bind(params.id)
    .all();
  return json({ events: results.map((x) => JSON.parse(x.event)) });
}
