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
const KEY = "zaagerij:review:2026-10-30";
const empty = () => ({ strokes: [], comment: "" });
function paint(canvas, image, strokes) {
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
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [ready, setReady] = useState(false);
  const canvas = useRef(),
    img = useRef(),
    draft = useRef(null);
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
  function end() {
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
                `${t}\n${notes[k]?.comment || "(Geen opmerking)"}\nTekeningen: ${notes[k]?.strokes.length || 0}\n`,
            )
            .join("\n"),
      );
      zip.file(
        "beoordeling.json",
        JSON.stringify(
          {
            version: "2026-10-30",
            savedAt: new Date().toISOString(),
            screens,
            notes,
          },
          null,
          2,
        ),
      );
      for (const [k] of screens) {
        if (!notes[k]?.strokes.length && !notes[k]?.comment) continue;
        const image = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () =>
            reject(Error("Schermvoorbeeld kon niet geladen worden."));
          image.src = "/review-screens/" + k + ".png";
        });
        const out = document.createElement("canvas");
        out.width = image.naturalWidth;
        out.height = image.naturalHeight;
        paint(out, image, notes[k]?.strokes || []);
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
          <p>Schermvoorbeelden · 30 oktober 2026 · alleen voorbeeldgegevens</p>
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
            className={mode === "draw" ? "selected" : ""}
            onClick={() => setMode("draw")}
          >
            <Pencil size={17} />
            Tekenen
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
            : "Scroll door het voorbeeld. Kies Tekenen om iets te omcirkelen of aan te wijzen."}
        </p>
        <div className={"review-screen " + (mode === "draw" ? "drawing" : "")}>
          <img
            ref={img}
            src={"/review-screens/" + id + ".png"}
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
              if (ready) paint(canvas.current, null, note.strokes);
            }}
          />
        </div>
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
