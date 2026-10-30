import React, { useState } from "react";
import {
  Check,
  RotateCcw,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Calculator as CalculatorIcon,
} from "lucide-react";
import { barSignature, colorFor, polygon } from "./geometry";
import { calculate } from "./expression";
export function Calculator({ initial, onUse }) {
  const [value, setValue] = useState(String(initial ?? "")),
    answer = calculate(value);
  return (
    <>
      <h2>Hoek uitrekenen</h2>
      <p>Bijvoorbeeld 180 − 105 of 90 ÷ 2.</p>
      <input
        aria-label="Berekening"
        inputMode="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="calculator-result">
        {answer === null ? "…" : answer + "°"}
      </div>
      <div className="calculator-keys">
        {[
          "7",
          "8",
          "9",
          "÷",
          "4",
          "5",
          "6",
          "×",
          "1",
          "2",
          "3",
          "−",
          "0",
          ".",
          "(",
          ")",
          "C",
          "⌫",
          "+",
          "=",
        ].map((k) => (
          <button
            key={k}
            onClick={() =>
              k === "C"
                ? setValue("")
                : k === "⌫"
                  ? setValue((v) => v.slice(0, -1))
                  : k === "="
                    ? answer !== null && setValue(String(answer))
                    : setValue((v) => v + k)
            }
          >
            {k}
          </button>
        ))}
      </div>
      <button
        className="button primary"
        disabled={answer === null || answer < 15 || answer > 165}
        onClick={() => onUse(answer)}
      >
        Gebruik {answer ?? "…"}°
      </button>
      <p className="footnote">Voer de tekeningshoek in: 90° is recht.</p>
    </>
  );
}
export function PieceShape({ piece, profile, highlight, orientationLabel }) {
  const s = piece.shape || polygon(piece, profile, piece.flipped),
    L = s.length || 1,
    w = s.width || 1;
  return (
    <div className="piece-orientation">
      <svg
        viewBox="0 0 360 95"
        role="img"
        aria-label={`${piece.flipped ? "Onderzijde" : "Bovenzijde"} boven, links ${piece.left} graden, rechts ${piece.right} graden`}
      >
        <polygon
          points={`${10 + (s.lt / L) * 340},12 ${10 + (s.rt / L) * 340},12 ${10 + (s.rb / L) * 340},75 ${10 + (s.lb / L) * 340},75`}
          fill="#e5eeff"
          stroke="#006bd5"
          strokeWidth="2"
        />
        <line
          x1={10 + ((highlight === "links" ? s.lt : s.rt) / L) * 340}
          y1="12"
          x2={10 + ((highlight === "links" ? s.lb : s.rb) / L) * 340}
          y2="75"
          stroke="#e86436"
          strokeWidth="3"
        />
        <text
          x="180"
          y="45"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="14"
          fill="#365b8b"
        >
          {piece.code} {piece.flipped ? "↻" : ""}
        </text>
      </svg>
      <div>
        <span>
          {piece.left}° {s.lt > s.lb ? "/" : s.lt < s.lb ? "\\" : "│"}
        </span>
        <strong>
          {orientationLabel ||
            (piece.flipped ? "Onderzijde boven" : "Bovenzijde boven")}
        </strong>
        <span>
          {s.rt > s.rb ? "/" : s.rt < s.rb ? "\\" : "│"} {piece.right}°
        </span>
      </div>
    </div>
  );
}
function OneBar({ bar, doc, done, onToggle, index }) {
  const [detail, setDetail] = useState(false);
  const width = bar.capacity || 1,
    xscale = 360 / width;
  const fallback = bar.items.map((p, i) => {
    const start = bar.items.slice(0, i).reduce((n, x) => n + x.required, 0);
    return {
      ...p,
      start: p.start ?? start,
      shape:
        p.shape ||
        polygon(
          p,
          doc.profiles.find((x) => x.id === bar.profileId),
          p.flipped,
        ),
    };
  });
  return (
    <section className="card bar-card" data-bar-id={bar.id}>
      <div className="section-heading">
        <div>
          <h2>
            Lengte {index}{" "}
            <span className="badge">
              {bar.source === "rest" ? "Reststuk" : "Nieuwe staaf"}
            </span>
          </h2>
          <p>{doc.profiles.find((p) => p.id === bar.profileId)?.name}</p>
        </div>
        <strong>{bar.capacity} mm</strong>
      </div>
      <div className="saw-bar-wrap">
        <svg
          viewBox="0 0 360 115"
          className="saw-bar"
          role="img"
          aria-label={"Zaagindeling lengte " + index}
        >
          {fallback.map((p) => {
            const s = p.shape,
              scale = 80 / (s.width || 1),
              top = 12,
              bottom = 80;
            const finished = done.has(p.unit);
            return (
              <g
                key={p.unit}
                role="button"
                tabIndex="0"
                aria-label={`${p.code}, ${p.length} millimeter, ${finished ? "gereed" : "openstaand"}${p.flipped ? ", omgekeerd" : ""}`}
                onClick={() => onToggle(p.unit)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(p.unit);
                  }
                }}
              >
                <polygon
                  points={`${(p.start + s.lt) * xscale},${top} ${(p.start + s.rt) * xscale},${top} ${(p.start + s.rb) * xscale},${bottom} ${(p.start + s.lb) * xscale},${bottom}`}
                  fill={finished ? "#bde8c9" : colorFor(p, doc)}
                  stroke={p.shared ? "#28835e" : "#8a9cb5"}
                  strokeWidth="1"
                />
                <text
                  x={(p.start + p.long / 2) * xscale}
                  y="39"
                  textAnchor="middle"
                  fontSize="12"
                  fill="#253e61"
                >
                  {p.code}
                  {finished ? " ✓" : ""}
                </text>
                <text
                  x={(p.start + p.long / 2) * xscale}
                  y="62"
                  textAnchor="middle"
                  fontSize="9"
                  fill="#5a6e8a"
                >
                  {p.length}
                  {p.flipped ? " ↻" : ""}
                </text>
                {p.shared && (
                  <line
                    x1={(p.start + s.lt) * xscale}
                    y1={top - 4}
                    x2={(p.start + s.lb) * xscale}
                    y2={bottom + 4}
                    stroke="#16845d"
                    strokeWidth="2"
                  />
                )}
              </g>
            );
          })}
          <text
            x={Math.min(310, Math.max(50, bar.used * xscale))}
            y="107"
            textAnchor="middle"
            fontSize="9"
            fill="#8594a8"
          >
            Rest {Math.round(width - bar.used)} mm
          </text>
        </svg>
      </div>
      <div className="bar-caption">
        <span>Tik op een stuk om het gereed te melden.</span>
        <button className="text-button" onClick={() => setDetail((v) => !v)}>
          {detail ? "Details sluiten" : "Hoeken & omkeren"}{" "}
          {detail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {detail && (
        <div className="bar-pieces">
          {fallback.map((p) => (
            <div className="bar-piece-detail" key={p.unit}>
              <button
                className="piece-tag"
                style={{ background: colorFor(p, doc) }}
                onClick={() => onToggle(p.unit)}
              >
                {p.code}
                {done.has(p.unit) ? " ✓" : ""}
              </button>
              <div>
                <strong>{p.length} mm</strong>
                <PieceShape
                  piece={p}
                  profile={doc.profiles.find((x) => x.id === bar.profileId)}
                />
                {p.shared && (
                  <p className="shared-note">Gedeelde snede met vorig stuk</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export function PlanBars({ bars, doc, onToggle }) {
  const [expanded, setExpanded] = useState({});
  const done = new Set(
      doc.events.filter((e) => e.kind === "good").map((e) => e.unit),
    ),
    groups = [];
  const map = new Map();
  bars.forEach((b, i) => {
    const key = barSignature(b);
    if (map.has(key)) map.get(key).bars.push({ ...b, index: i + 1 });
    else {
      const g = { key, bars: [{ ...b, index: i + 1 }] };
      map.set(key, g);
      groups.push(g);
    }
  });
  return (
    <div className="plan-bars">
      {groups.map((g) => {
        const isExpanded = expanded[g.key],
          repeat = g.bars.length > 1;
        return (
          <div key={g.key}>
            {repeat && (
              <div className="repeat-bar">
                <strong>{g.bars.length}× dezelfde indeling</strong>
                <button
                  className="text-button"
                  onClick={() =>
                    setExpanded((s) => ({ ...s, [g.key]: !s[g.key] }))
                  }
                >
                  {isExpanded ? "Samenvoegen" : "Staven apart bekijken"}
                </button>
                <span>
                  {g.bars
                    .map(
                      (b) =>
                        `${b.index}: ${b.items.filter((p) => done.has(p.unit)).length}/${b.items.length}`,
                    )
                    .join(" · ")}{" "}
                  gereed
                </span>
              </div>
            )}
            {(repeat && !isExpanded ? [g.bars[0]] : g.bars).map((b) => (
              <OneBar
                key={b.id}
                bar={b}
                index={
                  repeat && !isExpanded
                    ? g.bars.map((x) => x.index).join(", ")
                    : b.index
                }
                doc={doc}
                done={done}
                onToggle={onToggle}
              />
            ))}
            {repeat && !isExpanded && (
              <p className="footnote">
                Tik ‘Staven apart bekijken’ om de voortgang per afzonderlijke
                staaf af te vinken. Het zichtbare staafbeeld bedient alleen
                lengte {g.bars[0].index}.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
export function ProgressOverview({ doc, onBack, onSave, onSync }) {
  return (
    <section className="progress-sheet" aria-label="Gereedoverzicht">
      <header>
        <div>
          <h2>Gereedoverzicht</h2>
          <p>Veeg naar rechts om terug te keren.</p>
        </div>
        <button className="button" onClick={onBack}>
          <ArrowRight size={17} />
          Terug naar zaaglijst
        </button>
      </header>
      <div className="progress-sheet-content">
        <div className="two-buttons">
          <button className="button" onClick={onSave}>
            Voortgang opslaan
          </button>
          <button className="button" onClick={onSync}>
            Synchroniseren
          </button>
        </div>
        {doc.pieces.map((p) => {
          const good = doc.events.filter(
            (e) => e.kind === "good" && e.unit.startsWith(p.id + ":"),
          ).length;
          return (
            <article className="progress-total" key={p.id}>
              <span
                className="piece-tag"
                style={{ background: colorFor(p, doc) }}
              >
                {p.code}
              </span>
              <div>
                <strong>{p.length} mm</strong>
                <p>
                  {p.left}° / {p.right}°
                </p>
              </div>
              <div>
                <strong>
                  {good} / {p.qty}
                </strong>
                <p>{+p.qty - good} te gaan</p>
              </div>
              <div className="progress-track">
                <i style={{ width: (good / +p.qty) * 100 + "%" }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
