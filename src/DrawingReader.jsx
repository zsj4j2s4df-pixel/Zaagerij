import React, { useState, useEffect, useRef } from "react";
import { fileGet } from "./storage";
import { downloadFile } from "./cloud";
import { drawingFields, completeDrawingRow } from "./drawing";
const labels = {
  length: "Lengte · mm",
  qty: "Aantal",
  left: "Linkerhoek",
  right: "Rechterhoek",
};
const dataUrl = (f) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
export default function DrawingReader({
  attachment,
  attachments,
  projectId,
  profiles,
  session,
  onApply,
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [rows, setRows] = useState([]),
    [checked, setChecked] = useState({}),
    [supportId, setSupportId] = useState(""),
    [source, setSource] = useState(null),
    [previews, setPreviews] = useState([]);
  const urls = useRef([]);
  useEffect(
    () => () => urls.current.forEach((u) => URL.revokeObjectURL(u)),
    [],
  );
  async function localFile(a) {
    return (await fileGet(a.id)) || (await downloadFile(projectId, a.id));
  }
  async function read() {
    setBusy(true);
    setError("");
    setResult(null);
    setRows([]);
    setChecked({});
    setSource(null);
    try {
      if (!session) throw Error("Log eerst in voor beveiligde herkenning.");
      const selected = [
        attachment,
        ...(supportId ? [attachments.find((a) => a.id === supportId)] : []),
      ];
      const files = await Promise.all(selected.map(localFile));
      if (files.reduce((n, f) => n + f.size, 0) > 15000000)
        throw Error("Tekening en stuklijst samen mogen maximaal 15 MB zijn.");
      const encoded = await Promise.all(
        files.map(async (f, i) => ({
          name: selected[i].name,
          type: f.type,
          data: await dataUrl(f),
        })),
      );
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = files.map((f) => URL.createObjectURL(f));
      setPreviews(
        files.map((f, i) => ({
          url: urls.current[i],
          type: f.type,
          name: selected[i].name,
        })),
      );
      const response = await fetch("/api/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...encoded[0], support: encoded[1] }),
      });
      if (!response.headers.get("Content-Type")?.includes("application/json"))
        throw Error("Log opnieuw in via Cloudflare.");
      const parsed = await response.json();
      if (!response.ok) throw Error(parsed.error || "Uitlezen mislukt.");
      setResult(parsed);
      setRows(parsed.pieces.map((p) => ({ ...p, profileId: "" })));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function edit(i, key, value) {
    setRows((a) => a.map((p, j) => (j === i ? { ...p, [key]: value } : p)));
    setChecked((c) => ({ ...c, [i]: false }));
  }
  const active = source && previews[(source.file || 1) - 1];
  return (
    <div className="drawing-reader">
      <p>
        Controleer de herkende waarde naast de bron. Ontbrekende maten worden
        leeg gelaten; afgeleide waarden vragen extra controle.
      </p>
      <label className="field">
        <span>Stuklijst of tweede tekening (optioneel)</span>
        <select
          value={supportId}
          disabled={busy}
          onChange={(e) => {
            setSupportId(e.target.value);
            setResult(null);
            setRows([]);
            setChecked({});
            setSource(null);
          }}
        >
          <option value="">Alleen dit bestand</option>
          {attachments
            .filter(
              (a) => a.id !== attachment.id && a.status !== "Conversie nodig",
            )
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </label>
      <button className="button primary" disabled={busy} onClick={read}>
        {busy ? "Tekening en bronnen worden uitgelezen…" : "Lees tekening uit"}
      </button>
      {error && <div className="notice error">{error}</div>}
      {result && (
        <>
          {!result.complete && (
            <div className="notice error">
              De tekening is niet volledig uitgelezen. Lees een kleiner document
              of afzonderlijke bladen opnieuw; deze onvolledige lijst wordt niet
              automatisch toegevoegd.
            </div>
          )}
          {result.warnings?.map((w, i) => (
            <p className="notice error" key={i}>
              {w}
            </p>
          ))}
          {!rows.length && (
            <p className="notice">Geen bruikbare stukregels gevonden.</p>
          )}
          {rows.map((p, i) => (
            <section className="drawing-row" key={i}>
              <h3>Stuk {p.code}</h3>
              {p.location?.bbox && (
                <button
                  className="button"
                  onClick={() => setSource(p.location)}
                >
                  Wijs stuk {p.code} aan op de tekening
                </button>
              )}
              {p.calculationError && (
                <p className="notice error">{p.calculationError}</p>
              )}
              {p.lengthSteps?.length > 0 && (
                <details>
                  <summary>Hoe is de lengte van {p.code} berekend?</summary>
                  <ol>
                    {p.lengthSteps.map((step) => (
                      <li key={step.id}>
                        <strong>{step.id}</strong>:{" "}
                        {step.op === "input"
                          ? step.source.text
                          : `${step.op}(${step.args.join(", ")})`}{" "}
                        = {Number(step.value.toFixed(4))} {step.unit}
                        {step.source && (
                          <button
                            className="source-button"
                            onClick={() => setSource(step.source)}
                          >
                            Toon bronmaat
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                  <p>
                    Controleer of de maatlijnen bij de juiste uiteinden horen.
                    De berekening controleert de gekozen geometrie niet
                    automatisch.
                  </p>
                </details>
              )}
              <p>
                Bronprofiel: {p.profileName || "niet gevonden"} ·{" "}
                {p.material || "materiaal niet gevonden"}
              </p>
              <div className="drawing-fields">
                {drawingFields.map((k) => (
                  <div key={k}>
                    <label className="field">
                      <span>{labels[k]}</span>
                      <input
                        type="number"
                        aria-label={labels[k] + " " + p.code}
                        value={p[k] ?? ""}
                        onChange={(e) =>
                          edit(
                            i,
                            k,
                            e.target.value === "" ? null : +e.target.value,
                          )
                        }
                      />
                    </label>
                    <button
                      className={
                        "source-button " + (p.sources?.[k]?.status || "missing")
                      }
                      disabled={
                        !p.sources?.[k] || p.sources[k].status === "missing"
                      }
                      onClick={() => setSource(p.sources[k])}
                    >
                      Bron:{" "}
                      {p.sources?.[k]?.status === "stated"
                        ? "gevonden"
                        : p.sources?.[k]?.status === "inferred"
                          ? "afgeleid"
                          : "ontbreekt"}
                    </button>
                  </div>
                ))}
              </div>
              <label className="field">
                <span>Controleer het profiel voor deze regel</span>
                <select
                  aria-label={"Profiel " + p.code}
                  value={p.profileId}
                  onChange={(e) => edit(i, "profileId", e.target.value)}
                >
                  <option value="">Kies het juiste profiel</option>
                  {profiles.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.material || ""} {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Maatbasis</span>
                <select
                  aria-label={"Maatbasis " + p.code}
                  value={p.basis || "unknown"}
                  onChange={(e) => edit(i, "basis", e.target.value)}
                >
                  <option value="unknown">Nog te controleren</option>
                  <option value="long">Buitenste lange punten</option>
                  <option value="short">Korte punten</option>
                  <option value="center">Hartmaat</option>
                </select>
              </label>
              {Object.entries(p.angleCalculations || {}).map(
                ([end, calc]) =>
                  calc && (
                    <p className="notice" key={end}>
                      {end === "left" ? "Links" : "Rechts"}: tekeningshoek{" "}
                      {p[end]}° · machine {Math.abs(90 - p[end])}°.
                      {calc.kind === "inside" &&
                        ` Binnenhoek ${calc.angle}°: (180 − ${calc.angle}) ÷ 2 = ${calc.machine}° op de machine.`}
                      {calc.kind === "turn" &&
                        ` Richtingsverandering ${calc.angle}° ÷ 2 = ${calc.machine}° op de machine.`}
                    </p>
                  ),
              )}
              <p>{p.note}</p>
              <label className="toggle-line">
                <input
                  type="checkbox"
                  disabled={!completeDrawingRow(p, profiles)}
                  checked={!!checked[i]}
                  onChange={(e) =>
                    setChecked((c) => ({ ...c, [i]: e.target.checked }))
                  }
                />
                Ik heb deze regel, het profiel en de maatbasis gecontroleerd.
              </label>
            </section>
          ))}
          <button
            className="button primary"
            disabled={
              !result.complete ||
              !rows.length ||
              rows.some(
                (p, i) => !completeDrawingRow(p, profiles) || !checked[i],
              )
            }
            onClick={() =>
              onApply(
                rows.map((p) => ({
                  ...p,
                  sourceAttachmentId: attachment.id,
                  sourceSupportAttachmentId: supportId || null,
                })),
              )
            }
          >
            Gecontroleerde regels toevoegen
          </button>
        </>
      )}
      {active && (
        <div className="drawing-source">
          <strong>
            {active.name} · pagina {source.page || "onbekend"}
          </strong>
          <p>{source.text || "Geen letterlijk bronfragment gevonden."}</p>
          {active.type.startsWith("image/") ? (
            <div className="source-image">
              <img src={active.url} alt="Bron van de herkende maat" />
              {source.bbox?.length === 4 && (
                <span
                  style={{
                    left: source.bbox[0] * 100 + "%",
                    top: source.bbox[1] * 100 + "%",
                    width: (source.bbox[2] - source.bbox[0]) * 100 + "%",
                    height: (source.bbox[3] - source.bbox[1]) * 100 + "%",
                  }}
                />
              )}
            </div>
          ) : (
            <a
              className="button"
              href={active.url + "#page=" + (source.page || 1)}
              target="_blank"
              rel="noreferrer"
            >
              Open bronblad in PDF
            </a>
          )}
          <p className="footnote">
            De markering is een AI-aanwijzing. Controleer het gedrukte getal en
            de bijbehorende maatlijn.
          </p>
          <button className="button" onClick={() => setSource(null)}>
            Bron sluiten
          </button>
        </div>
      )}
    </div>
  );
}
