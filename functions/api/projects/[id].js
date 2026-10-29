import { json, bodyJson } from "../../_lib/security.js";
import { validate } from "../../../src/engine.js";
export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare("SELECT * FROM projects WHERE id=?")
    .bind(params.id)
    .first();
  if (!row) return json({ error: "Zaaglijst niet gevonden." }, 404);
  return json({ ...row, document: JSON.parse(row.document) });
}
export async function onRequestPut({ request, env, params, data }) {
  if (data.user.role !== "office")
    return json(
      { error: "Alleen kantoor kan nieuwe versies publiceren." },
      403,
    );
  const { document, baseVersion } = await bodyJson(request);
  if (
    !document ||
    document.id !== params.id ||
    !Array.isArray(document.events) ||
    !Array.isArray(document.pieces) ||
    !Array.isArray(document.profiles) ||
    !Array.isArray(document.attachments) ||
    !Number.isInteger(baseVersion) ||
    baseVersion < 0
  )
    return json({ error: "Ongeldig document." }, 400);
  const errors = validate(document);
  if (errors.length) return json({ error: errors[0] }, 400);
  const encoded = JSON.stringify({ ...document, execution: null, cutIds: [] });
  const version = baseVersion + 1;
  const update =
    baseVersion === 0
      ? env.DB.prepare(
          "INSERT INTO projects(id,name,version,document) VALUES(?,?,1,?) ON CONFLICT(id) DO NOTHING RETURNING version",
        ).bind(params.id, String(document.name).slice(0, 200), encoded)
      : env.DB.prepare(
          "UPDATE projects SET name=?,version=version+1,document=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? RETURNING version",
        ).bind(
          String(document.name).slice(0, 200),
          encoded,
          params.id,
          baseVersion,
        );
  // The trigger records each successful revision inside the same atomic write.
  const result = await update.first();
  if (!result)
    return json(
      {
        error:
          "Versieconflict: haal eerst de actuele versie op. Niets is overschreven.",
      },
      409,
    );
  return json({ version });
}
