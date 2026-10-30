import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Hand,
  MessageSquare,
  Download,
  RotateCcw,
  Trash2,
  ExternalLink,
} from "lucide-react";
import "./review.css";
const screens = [
  ["invoer", "Materiaal & instellingen"],
  ["stukken", "Stukken invoeren"],
  ["bijlagen", "Tekening toevoegen"],
  ["zaagplan", "Zaagplan"],
  ["uitvoering", "Uitvoering"],
  ["afwijken", "Afwijken"],
  ["opslaan", "Opslaan"],
  ["inloggen", "Inloggen"],
];
const oldRound = new URLSearchParams(location.search).get("round") === "1";
const KEY = oldRound
  ? "zaagerij:review:2026-10-30"
  : "zaagerij:review:2026-10-30-r2";
const screenPath = oldRound ? "/review-screens/" : "/review-screens-r2/";
const empty = () => ({ strokes: [], comment: "", pins: [] });
function paint(canvas, image, strokes, pins = []) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (image) ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = canvas.width * 0.009;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    stroke.points.forEach(([x, y], i) =>
      i
        ? ctx.lineTo(x * canvas.width, y * canvas.height)
        : ctx.moveTo(x * canvas.width, y * canvas.height),
    );
    if (stroke.points.length === 1) {
      const [x, y] = stroke.points[0];
      ctx.lineTo(x * canvas.width + 0.1, y * canvas.height + 0.1);
    }
    ctx.stroke();
  }
  pins.forEach((pin, i) => {
    const x = pin.x * canvas.width,
      y = pin.y * canvas.height,
      r = canvas.width * 0.035;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = "#006bd5";
    ctx.fill();
    ctx.lineWidth = canvas.width * 0.006;
    ctx.strokeStyle = "white";
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.round(r * 1.1)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x, y);
  });
}
export default function Review() {
  const [index, setIndex] = useState(0),
    [notes, setNotes] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem(KEY)) || {};
      } catch {
        return {};
      }
    }),
    [mode, setMode] = useState("view"),
    [color, setColor] = useState("#e43b54"),
    [editing, setEditing] = useState(false),
    [editingPin, setEditingPin] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [ready, setReady] = useState(false);
  const canvas = useRef(),
    img = useRef(),
    draft = useRef(null),
    pinStart = useRef(null);
  const [id, title] = screens[index],
    note = notes[id] || empty();
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(notes));
    } catch {
      setMessage("Opslag vol. Download je beoordeling om je werk te bewaren.");
    }
  }, [notes]);
  useEffect(() => {
    if (canvas.current && ready) paint(canvas.current, null, note.strokes);
  }, [note.strokes, ready, index]);
  function move(delta) {
    draft.current = null;
    setIndex((i) => Math.max(0, Math.min(screens.length - 1, i + delta)));
    setReady(false);
    setMode("view");
    window.scrollTo(0, 0);
  }
  function point(e) {
    const r = canvas.current.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  }
  function down(e) {
    if (mode === "pin" && ready) {
      pinStart.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        point: point(e),
      };
      return;
    }
    if (mode !== "draw" || !ready) return;
    e.preventDefault();
    canvas.current.setPointerCapture(e.pointerId);
    draft.current = { color, points: [point(e)] };
    paint(canvas.current, null, [...note.strokes, draft.current]);
  }
  function draw(e) {
    if (!draft.current) return;
    e.preventDefault();
    if (draft.current.points.length < 4000) draft.current.points.push(point(e));
    paint(canvas.current, null, [...note.strokes, draft.current]);
  }
  function end(e) {
    if (mode === "pin" && pinStart.current) {
      const start = pinStart.current;
      pinStart.current = null;
      if (
        Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) < 12
      ) {
        setEditingPin({
          id: crypto.randomUUID(),
          x: start.point[0],
          y: start.point[1],
          text: "",
        });
      }
      return;
    }
    if (!draft.current) return;
    const stroke = draft.current;
    draft.current = null;
    setNotes((n) => ({
      ...n,
      [id]: {
        ...(n[id] || empty()),
        strokes: [...(n[id]?.strokes || []), stroke],
      },
    }));
  }
  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      zip.file(
        "opmerkingen.txt",
        "ZAAGERIJ — ONTWERPBEOORDELING\nSchermversie: 30 oktober 2026\n\n" +
          screens
            .map(
              ([k, t]) =>
                `${t}\n${notes[k]?.comment || "(Geen algemene opmerking)"}\n${(notes[k]?.pins || []).map((p, i) => `Punt ${i + 1} (${Math.round(p.x * 100)}%, ${Math.round(p.y * 100)}%): ${p.text}`).join("\n")}\nTekeningen: ${notes[k]?.strokes.length || 0}\n`,
            )
            .join("\n"),
      );
      zip.file(
        "beoordeling.json",
        JSON.stringify(
          {
            version: oldRound ? "2026-10-30" : "2026-10-30-r2",
            savedAt: new Date().toISOString(),
            screens,
            notes,
          },
          null,
          2,
        ),
      );
      for (const [k] of screens) {
        if (
          !notes[k]?.strokes.length &&
          !notes[k]?.comment &&
          !notes[k]?.pins?.length
        )
          continue;
        const image = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () =>
            reject(Error("Schermvoorbeeld kon niet geladen worden."));
          image.src = screenPath + k + ".png";
        });
        const out = document.createElement("canvas");
        out.width = image.naturalWidth;
        out.height = image.naturalHeight;
        paint(out, image, notes[k]?.strokes || [], notes[k]?.pins || []);
        const blob = await new Promise((resolve) =>
          out.toBlob(resolve, "image/png"),
        );
        if (!blob) throw Error("Afbeelding kon niet worden opgeslagen.");
        zip.file(k + ".png", blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "zaagerij-beoordeling.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "Gedownload. Stuur het ZIP-bestand in deze chat; er is niets automatisch verstuurd.",
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="review-app">
      <header className="review-header">
        <div>
          <a href="/" aria-label="Terug naar Zaagerij">
            <img src="/brand/van-der-velden.svg" alt="Van der Velden" />
          </a>
          <h1>Bekijk. Tik. Geef je mening.</h1>
          <p>
            Schermvoorbeelden · {oldRound ? "Eerste ronde" : "Tweede ronde"} ·
            alleen voorbeeldgegevens
          </p>
          <a
            className="review-round"
            href={oldRound ? "/review/" : "/review/?round=1"}
          >
            {oldRound
              ? "Naar de nieuwste schermen"
              : "Eerste beoordeling terugzien"}
          </a>
        </div>
        <a className="button" href="/" target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          Open echte app
        </a>
      </header>
      <div className="review-toolbar">
        <div className="review-modes">
          <button
            className={mode === "view" ? "selected" : ""}
            onClick={() => setMode("view")}
          >
            <Hand size={17} />
            Bekijken
          </button>
          <button
            disabled={!ready}
            className={mode === "draw" ? "selected" : ""}
            onClick={() => setMode("draw")}
          >
            <Pencil size={17} />
            Tekenen
          </button>
          <button
            disabled={!ready}
            className={mode === "pin" ? "selected" : ""}
            onClick={() => setMode("pin")}
          >
            <MessageSquare size={17} />
            Aanwijzen
          </button>
          <button onClick={() => setEditing(true)}>
            <MessageSquare size={17} />
            Opmerking{note.comment ? " •" : ""}
          </button>
        </div>
        <div className="review-tools">
          {["#e43b54", "#006bd5", "#e4a325"].map((c) => (
            <button
              key={c}
              className={"color-swatch " + (color === c ? "selected" : "")}
              style={{ background: c }}
              aria-label={"Tekenkleur " + c}
              onClick={() => {
                setColor(c);
                setMode("draw");
              }}
            />
          ))}
          <button
            title="Laatste lijn ongedaan maken"
            aria-label="Laatste lijn ongedaan maken"
            disabled={!note.strokes.length}
            onClick={() =>
              setNotes((n) => ({
                ...n,
                [id]: { ...note, strokes: note.strokes.slice(0, -1) },
              }))
            }
          >
            <RotateCcw size={18} />
          </button>
          <button
            aria-label="Wis dit scherm"
            onClick={() => {
              if (confirm("Tekening en opmerking op dit scherm wissen?"))
                setNotes((n) => ({ ...n, [id]: empty() }));
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <main className="review-main">
        <div className="review-title">
          <span>
            {index + 1} / {screens.length}
          </span>
          <h2>{title}</h2>
          <span>{note.strokes.length} lijnen</span>
        </div>
        <p className="review-help">
          {mode === "draw"
            ? "Teken met je vinger of muis. Kies Bekijken om te scrollen."
            : mode === "pin"
              ? "Tik op de plek waar je opmerking over gaat. Daarna kun je je tekst schrijven."
              : "Scroll door het voorbeeld. Kies Aanwijzen voor een opmerking op een specifieke plek."}
        </p>
        <div
          className={
            "review-screen " +
            (mode === "draw" ? "drawing" : mode === "pin" ? "pinning" : "")
          }
        >
          <img
            ref={img}
            src={screenPath + id + ".png"}
            alt={"Voorbeeldscherm " + title}
            onLoad={() => {
              canvas.current.width = img.current.naturalWidth;
              canvas.current.height = img.current.naturalHeight;
              setReady(true);
              paint(canvas.current, null, note.strokes);
            }}
          />
          <canvas
            ref={canvas}
            aria-label="Tekenlaag"
            onPointerDown={down}
            onPointerMove={draw}
            onPointerUp={end}
            onPointerCancel={() => {
              draft.current = null;
              pinStart.current = null;
              if (ready) paint(canvas.current, null, note.strokes);
            }}
          />
          {(note.pins || []).map((pin, i) => (
            <button
              key={pin.id}
              className="review-pin"
              style={{ left: pin.x * 100 + "%", top: pin.y * 100 + "%" }}
              aria-label={`Opmerking ${i + 1}: ${pin.text}`}
              title={pin.text}
              onClick={() => setEditingPin({ ...pin })}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {(note.pins || []).length > 0 && (
          <section className="review-pins-list">
            {note.pins.map((pin, i) => (
              <button key={pin.id} onClick={() => setEditingPin({ ...pin })}>
                <strong>{i + 1}</strong>
                <span>{pin.text}</span>
              </button>
            ))}
          </section>
        )}
        {note.comment && (
          <section className="review-comment">
            <strong>Jouw opmerking</strong>
            <p>{note.comment}</p>
            <button onClick={() => setEditing(true)}>Bewerken</button>
          </section>
        )}
        <p className="review-privacy">
          Je opmerkingen blijven op dit apparaat. Download je beoordeling en
          stuur het bestand in deze chat om ze met mij te delen.
        </p>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        <button
          className="button primary review-download"
          disabled={busy}
          onClick={download}
        >
          <Download size={17} />
          {busy ? "Beoordeling opslaan…" : "Download beoordeling (ZIP)"}
        </button>
      </main>
      <nav className="review-nav">
        <button disabled={index === 0} onClick={() => move(-1)}>
          <ArrowLeft size={19} />
          Vorige
        </button>
        <button onClick={() => setEditing(true)}>
          <MessageSquare size={19} />
          Opmerking
        </button>
        <button disabled={index === screens.length - 1} onClick={() => move(1)}>
          Volgende
          <ArrowRight size={19} />
        </button>
      </nav>
      {editingPin && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>Opmerking op de aangewezen plek</h2>
            <p>
              {title} · punt{" "}
              {(note.pins || []).findIndex((p) => p.id === editingPin.id) >= 0
                ? note.pins.findIndex((p) => p.id === editingPin.id) + 1
                : (note.pins || []).length + 1}
            </p>
            <textarea
              autoFocus
              rows="5"
              aria-label="Opmerking bij deze plek"
              placeholder="Wat wil je hier veranderen?"
              value={editingPin.text}
              onChange={(e) =>
                setEditingPin((p) => ({
                  ...p,
                  text: e.target.value.slice(0, 10000),
                }))
              }
            />
            <button
              className="button primary"
              disabled={!editingPin.text.trim()}
              onClick={() => {
                setNotes((n) => {
                  const item = n[id] || empty(),
                    pins = item.pins || [];
                  return {
                    ...n,
                    [id]: {
                      ...item,
                      pins: pins.some((p) => p.id === editingPin.id)
                        ? pins.map((p) =>
                            p.id === editingPin.id ? editingPin : p,
                          )
                        : [...pins, editingPin],
                    },
                  };
                });
                setEditingPin(null);
                setMode("view");
              }}
            >
              Opmerking bewaren
            </button>
            <button className="button" onClick={() => setEditingPin(null)}>
              Annuleren
            </button>
            {(note.pins || []).some((p) => p.id === editingPin.id) && (
              <button
                className="button"
                onClick={() => {
                  if (confirm("Deze opmerking verwijderen?")) {
                    setNotes((n) => ({
                      ...n,
                      [id]: {
                        ...(n[id] || empty()),
                        pins: (n[id]?.pins || []).filter(
                          (p) => p.id !== editingPin.id,
                        ),
                      },
                    }));
                    setEditingPin(null);
                  }
                }}
              >
                Verwijderen
              </button>
            )}
          </section>
        </div>
      )}
      {editing && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>Opmerking bij {title}</h2>
            <textarea
              autoFocus
              rows="6"
              aria-label="Jouw opmerking"
              placeholder="Wat moet duidelijker, anders of eenvoudiger?"
              value={note.comment}
              onChange={(e) =>
                setNotes((n) => ({
                  ...n,
                  [id]: {
                    ...(n[id] || empty()),
                    comment: e.target.value.slice(0, 10000),
                  },
                }))
              }
            />
            <p>Wordt automatisch op dit apparaat bewaard.</p>
            <button
              className="button primary"
              onClick={() => setEditing(false)}
            >
              Klaar
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
