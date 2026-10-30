import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  FolderOpen,
  List,
  ChartNoAxesGantt,
  Hammer,
  Plus,
  Save,
  Copy,
  Download,
  Upload,
  Camera,
  FileImage,
  Check,
  ArrowRight,
  ChevronRight,
  Info,
  Trash2,
  RotateCcw,
  RefreshCw,
  WifiOff,
  Cloud,
  Search,
  X,
  QrCode,
  Settings2,
  LogIn,
  CheckCircle2,
  AlertTriangle,
  Scissors,
  FileText,
  Printer,
  Calculator as CalculatorIcon,
} from "lucide-react";
import QRCode from "qrcode";
import {
  uid,
  plan,
  remaining,
  recordGood,
  machineAngle,
  validate,
  signatureMatches,
} from "./engine";
import {
  fresh,
  demo,
  loadAll,
  save,
  remove,
  convert,
  legacy,
  filePut,
  fileGet,
  profileLibrary,
  rememberProfile,
  withColors,
} from "./storage";
import {
  publish,
  fetchVersion,
  syncProgress,
  sessionInfo,
  login as accessLogin,
  logout,
  listCentral,
  uploadFile,
  downloadFile,
} from "./cloud";
import "./style.css";
import Review from "./Review";
import DrawingReader from "./DrawingReader";
import { Calculator, PlanBars, PieceShape, ProgressOverview } from "./SawTools";
import { colorFor, pieceColors } from "./geometry";
const tabs = [
  ["projects", "Projecten", FolderOpen],
  ["input", "Invoer", List],
  ["plan", "Zaagplan", ChartNoAxesGantt],
  ["work", "Uitvoering", Hammer],
];
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Button({ children, icon: Icon, primary = false, ...props }) {
  return (
    <button className={primary ? "button primary" : "button"} {...props}>
      {Icon && <Icon size={17} />} {children}
    </button>
  );
}
function AngleSketch({ left = 45, right = 45 }) {
  return (
    <svg
      viewBox="0 0 300 100"
      className="angle-sketch"
      aria-label="Bovenaanzicht maatvoering"
    >
      <defs>
        <marker
          id="arrow"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto-start-reverse"
        >
          <path d="M0 0L6 3L0 6" fill="#006bd5" />
        </marker>
      </defs>
      <path
        d={`M${left === 90 ? 30 : 60} 35 H${right === 90 ? 270 : 240} L270 80 H30 Z`}
        fill="#e8f0ff"
        stroke="#006bd5"
        strokeWidth="2"
      />
      <path
        d="M30 15 H270"
        stroke="#006bd5"
        markerStart="url(#arrow)"
        markerEnd="url(#arrow)"
      />
      <text x="150" y="10" textAnchor="middle" fill="#52627c" fontSize="10">
        Buitenste lange punten
      </text>
      <text x="13" y="65" fontSize="12">
        {left}°
      </text>
      <text x="274" y="65" fontSize="12">
        {right}°
      </text>
    </svg>
  );
}
function App() {
  const [doc, setDoc] = useState(() => {
      try {
        return withColors(
          JSON.parse(localStorage.getItem("zaagerij:working")) || demo(),
        );
      } catch {
        return demo();
      }
    }),
    [tab, setTab] = useState("input"),
    [projects, setProjects] = useState(loadAll),
    [dirty, setDirty] = useState(false),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(null),
    [online, setOnline] = useState(navigator.onLine),
    [search, setSearch] = useState(""),
    [session, setSession] = useState(null),
    [pending, setPending] = useState(null),
    [step, setStep] = useState(0),
    [doneCuts, setDoneCuts] = useState({}),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(""),
    [cloudVersion, setCloudVersion] = useState(0),
    [qr, setQr] = useState(""),
    [progressOpen, setProgressOpen] = useState(false),
    [library, setLibrary] = useState(profileLibrary),
    [printQr, setPrintQr] = useState("");
  const importRef = useRef(),
    cameraRef = useRef(),
    attachmentRef = useRef(),
    swipeRef = useRef(null),
    returnScroll = useRef(0);
  const calculated = useMemo(() => plan(doc), [doc]);
  const legacyPlan = !!doc.execution && doc.execution.model !== "right-stop-v3";
  const result = doc.execution
    ? {
        ...doc.execution,
        steps: doc.execution.steps.filter(
          (s) =>
            !doc.events.some((e) => e.kind === "good" && e.unit === s.unit) &&
            !(doc.cutIds || []).includes(s.id),
        ),
      }
    : calculated;
  const completed = doc.events.filter((e) => e.kind === "good").length;
  const total = doc.pieces.reduce((n, p) => n + (+p.qty || 0), 0);
  const current =
    result.steps[Math.min(step, Math.max(0, result.steps.length - 1))];
  function notify(s) {
    setToast(s);
    setTimeout(() => setToast(""), 4500);
  }
  function change(fn) {
    setDoc((d) => (typeof fn === "function" ? fn(d) : { ...d, ...fn }));
    setDirty(true);
  }
  function updatePiece(id, key, value) {
    if (
      doc.events.some(
        (e) => e.kind === "good" && e.unit.startsWith(id + ":"),
      ) ||
      (doc.cutIds || []).some((x) => x.startsWith(id + ":"))
    ) {
      notify(
        "Dit stuk is al in bewerking. Gebruik Afwijken voor aanpassingen aan het resterende werk.",
      );
      return;
    }
    change((d) => ({
      ...d,
      execution: null,
      cutIds: [],
      pieces: d.pieces.map((p) => (p.id === id ? { ...p, [key]: value } : p)),
    }));
    setDoneCuts({});
    setStep(0);
  }
  function updateProfile(id, key, value) {
    if (doc.events.some((e) => e.kind === "good") || doc.cutIds?.length) {
      notify(
        "Er is al gezaagd. Gebruik Afwijken of maak een kopie via Opslaan als.",
      );
      return;
    }
    change((d) => ({
      ...d,
      execution: null,
      cutIds: [],
      profiles: d.profiles.map((p) =>
        p.id === id ? { ...p, [key]: value } : p,
      ),
    }));
    setDoneCuts({});
    setStep(0);
  }
  function open(d) {
    if (dirty && !confirm("Onopgeslagen wijzigingen verlaten?")) return;
    setDoc(withColors(d));
    setDirty(false);
    setStep(0);
    setDoneCuts({});
    setCloudVersion(d.cloudVersion || 0);
    setTab("input");
  }
  async function progressSync() {
    setBusy(true);
    try {
      if (!cloudVersion)
        throw Error("Laat kantoor de lijst eerst centraal publiceren.");
      const incoming = await syncProgress(doc);
      const merged = [...doc.events];
      for (const e of incoming) {
        const piece = doc.pieces.find((p) => e.unit.startsWith(p.id + ":"));
        if (
          signatureMatches(e.signature, piece) &&
          !merged.some((x) => x.kind === "good" && x.unit === e.unit)
        )
          merged.push(e);
      }
      const d = save({ ...doc, events: merged });
      setDoc(d);
      setProjects(loadAll());
      notify("Voortgang gesynchroniseerd.");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  function persist(copy = false) {
    let d = doc;
    if (copy) {
      const name = prompt("Naam van de kopie", doc.name + " · kopie");
      if (!name) return;
      d = {
        ...doc,
        id: uid(),
        name,
        events: [],
        execution: null,
        cutIds: [],
        revision: 1,
        cloudVersion: 0,
      };
      setCloudVersion(0);
    }
    try {
      d = save(d);
      setDoc(d);
      setProjects(loadAll());
      setDirty(false);
      notify(
        copy ? "Kopie opgeslagen" : "Zaaglijst opgeslagen op dit apparaat",
      );
    } catch {
      notify("Opslaan mislukt. Download een back-up om je werk te bewaren.");
    }
  }
  function exportDoc() {
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = doc.name.replace(/[^\p{L}\p{N}_-]/gu, "_") + ".zaagerij.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importDoc(e) {
    try {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 2e6) throw Error("Maximaal 2 MB voor een zaaglijst.");
      const d = convert(JSON.parse(await f.text()));
      const errors = validate(d);
      if (errors.length) throw Error(errors[0]);
      open(d);
      setDirty(true);
      notify("Zaaglijst geïmporteerd; sla deze op.");
    } catch (err) {
      notify("Import mislukt: " + err.message);
    } finally {
      e.target.value = "";
    }
  }
  async function addAttachments(e) {
    try {
      const files = [...e.target.files];
      if (files.length + doc.attachments.length > 12)
        throw Error("Maximaal 12 bijlagen per lijst.");
      const items = [];
      for (const f of files) {
        if (f.size > 15e6) throw Error("Maximaal 15 MB per bestand.");
        const ext = f.name.split(".").pop().toLowerCase();
        if (
          ![
            "jpg",
            "jpeg",
            "png",
            "webp",
            "pdf",
            "sldprt",
            "slddrw",
            "step",
            "stp",
          ].includes(ext)
        )
          throw Error("Dit bestandstype wordt niet ondersteund.");
        const id = uid();
        await filePut(id, f);
        items.push({
          id,
          name: f.name,
          size: f.size,
          type: f.type,
          status: ["sldprt", "slddrw", "step", "stp"].includes(ext)
            ? "Conversie nodig"
            : "Toegevoegd",
          local: true,
        });
      }
      change((d) => ({ ...d, attachments: [...d.attachments, ...items] }));
      notify("Bijlage toegevoegd op dit apparaat");
    } catch (err) {
      notify(err.message);
    } finally {
      e.target.value = "";
    }
  }
  async function viewAttachment(a) {
    const f =
      (await fileGet(a.id)) ||
      (session ? await downloadFile(doc.id, a.id).catch(() => null) : null);
    if (!f)
      return notify(
        "Deze bijlage is alleen beschikbaar op het apparaat waarop hij is toegevoegd.",
      );
    const url = URL.createObjectURL(f);
    if (f.type.startsWith("image/") || f.type === "application/pdf")
      setModal({ kind: "file", url, type: f.type, name: a.name });
    else {
      const el = document.createElement("a");
      el.href = url;
      el.download = a.name;
      el.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  async function sync() {
    setBusy(true);
    try {
      if (!session) {
        setModal({ kind: "login" });
        return;
      }
      const version = await publish(doc, cloudVersion);
      if (session.storage?.attachments) {
        for (const a of doc.attachments) {
          const f = await fileGet(a.id);
          if (f) await uploadFile(doc.id, a, f);
        }
      }
      setCloudVersion(version);
      const d = save({ ...doc, cloudVersion: version });
      setDoc(d);
      setProjects(loadAll());
      setDirty(false);
      notify("Versie " + version + " centraal gepubliceerd");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function checkUpdate(id = doc.id) {
    try {
      const row = await fetchVersion(id);
      if (row.version > cloudVersion || id !== doc.id) {
        setPending(row);
        setModal({ kind: "version" });
      } else notify("Je gebruikt de nieuwste versie.");
    } catch (e) {
      notify(e.message);
    }
  }
  async function share() {
    if (!cloudVersion)
      return notify(
        "Publiceer de lijst eerst centraal. Daarna is een QR-code beschikbaar.",
      );
    const url = location.origin + "/#project=" + doc.id;
    setQr(await QRCode.toDataURL(url, { width: 280, margin: 2 }));
    setModal({ kind: "share", url });
  }
  function login(e) {
    e.preventDefault();
    accessLogin();
  }
  function applyCuts(ends) {
    change((d) => {
      const ids = [
        ...new Set([
          ...(d.cutIds || []),
          ...ends.map((e) => `${e.unit}:${e.end}`),
        ]),
      ];
      let next = { ...d, execution: d.execution || calculated, cutIds: ids };
      for (const unit of new Set(ends.map((e) => e.unit))) {
        if (
          ids.includes(`${unit}:links`) &&
          ids.includes(`${unit}:rechts`) &&
          !next.events.some((e) => e.kind === "good" && e.unit === unit)
        )
          next = recordGood(next, unit);
      }
      return next;
    });
    setStep(0);
  }
  function cut() {
    if (!current) return;
    applyCuts(current.ends || [{ unit: current.unit, end: current.end }]);
    notify(
      current.shared
        ? "Gedeelde snede geregistreerd voor beide stukken."
        : "Snede geregistreerd.",
    );
  }
  function toggleGood(unit) {
    const p = doc.pieces.find((p) => unit.startsWith(p.id + ":"));
    const done = doc.events.some((e) => e.kind === "good" && e.unit === unit);
    if (
      !confirm(
        done
          ? `Stuk ${p.code} weer openzetten?`
          : `Stuk ${p.code} gereed? Controleer profiel, lengte en beide hoeken.`,
      )
    )
      return;
    if (done) {
      change((d) => ({
        ...d,
        events: d.events.filter((e) => !(e.kind === "good" && e.unit === unit)),
        cutIds: (d.cutIds || []).filter((id) => !id.startsWith(unit + ":")),
      }));
      return;
    }
    const related = result.steps.filter((s) =>
      (s.ends || [{ unit: s.unit }]).some((e) => e.unit === unit),
    );
    const ends = related.flatMap(
      (s) => s.ends || [{ unit: s.unit, end: s.end }],
    );
    applyCuts([...ends, { unit, end: "links" }, { unit, end: "rechts" }]);
    notify(p.code + " gereed gemeld.");
  }
  function showProgress() {
    returnScroll.current = window.scrollY;
    setProgressOpen(true);
  }
  function hideProgress() {
    setProgressOpen(false);
    requestAnimationFrame(() => window.scrollTo(0, returnScroll.current));
  }
  function touchStart(e) {
    swipeRef.current = null;
    if (!["plan", "work"].includes(tab) && !progressOpen) return;
    const t = e.target;
    if (t.closest("input,select,textarea,button,a,canvas")) return;
    let parent = t;
    while (parent && parent !== e.currentTarget) {
      if (
        parent.scrollWidth > parent.clientWidth + 2 &&
        ["auto", "scroll"].includes(getComputedStyle(parent).overflowX)
      )
        return;
      parent = parent.parentElement;
    }
    swipeRef.current = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };
  }
  function touchEnd(e) {
    const p = swipeRef.current;
    swipeRef.current = null;
    if (!p) return;
    const dx = e.changedTouches[0].clientX - p.x,
      dy = e.changedTouches[0].clientY - p.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    e.preventDefault();
    if (dx < 0 && !progressOpen) showProgress();
    else if (dx > 0 && progressOpen) hideProgress();
  }
  useEffect(() => {
    if (cloudVersion)
      QRCode.toDataURL(location.origin + "/#project=" + doc.id, {
        width: 140,
        margin: 1,
      })
        .then(setPrintQr)
        .catch(() => {});
    else setPrintQr("");
  }, [doc.id, cloudVersion]);
  useEffect(() => {
    localStorage.setItem("zaagerij:working", JSON.stringify(doc));
  }, [doc]);
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => setOnline(false);
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    sessionInfo().then((info) =>
      setSession(info ? { user: info.user, storage: info.storage } : null),
    );
    return () => {
      window.removeEventListener("online", yes);
      window.removeEventListener("offline", no);
    };
  }, []);
  useEffect(() => {
    if (session && location.hash.startsWith("#project=")) {
      const id = location.hash.slice(9);
      checkUpdate(id);
    }
  }, [session]);
  useEffect(() => {
    const before = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  const newPiece = () =>
    change((d) => ({
      ...d,
      pieces: [
        ...d.pieces,
        {
          id: uid(),
          color:
            pieceColors.find((c) => !d.pieces.some((p) => p.color === c)) ||
            pieceColors[d.pieces.length % pieceColors.length],
          code: String(
            Math.max(
              0,
              ...d.pieces.map(
                (p) => Number(String(p.code).replace(/\D/g, "")) || 0,
              ),
            ) + 1,
          ).padStart(3, "0"),
          profileId: d.profiles[0].id,
          length: 600,
          qty: 1,
          left: 90,
          right: 90,
          basis: "long",
        },
      ],
    }));
  return (
    <div
      className="app-shell"
      data-tab={tab}
      onTouchStart={touchStart}
      onTouchEnd={touchEnd}
      onTouchCancel={() => {
        swipeRef.current = null;
      }}
    >
      <aside className="sidebar">
        <a
          href="https://avandervelden.nl/"
          target="_blank"
          rel="noreferrer"
          className="brand"
        >
          <img src="/brand/van-der-velden.svg" alt="Van der Velden" />
        </a>
        <div className="product-name">
          <span className="product-mark">
            <img src="/brand/zaagerij-icon.svg" alt="" width="28" height="28" />
          </span>
          <span>
            Zaagerij <small>2.0</small>
          </span>
        </div>
        <div className="side-label">WERKVOORBEREIDING</div>
        <nav>
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                if (id === "work" && !doc.execution)
                  change((d) => ({ ...d, execution: calculated, cutIds: [] }));
                setTab(id);
              }}
              className={tab === id ? "active" : ""}
            >
              <Icon size={20} />
              {label}
              {id === "work" && (
                <span className="nav-count">
                  {completed}/{total}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/review/">Ontwerp beoordelen & tekenen ↗</a>
          <div className="tip">
            <span className="dot" /> Gebouwd voor de werkplaats
            <p>
              Minder instellen.
              <br />
              Meer meters maken.
            </p>
          </div>
          <button onClick={() => setModal({ kind: "login" })}>
            <LogIn size={18} />
            {session ? "Account" : "Inloggen"}
          </button>
          <a href="/origineel/">Originele Zaagerij ↗</a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Werkplaats <ChevronRight size={14} />
            <strong>{tabs.find((t) => t[0] === tab)[1]}</strong>
          </div>
          <div className="top-actions">
            <span className="connection">
              <span className={"dot " + (!online ? "offline" : "")} />
              {online ? "Online" : "Offline beschikbaar"}
            </span>
            <button
              className="avatar"
              onClick={() => setModal({ kind: "login" })}
              aria-label="Account"
            >
              VDV
            </button>
          </div>
        </header>
        <div
          className={"auth-status " + (session ? "signed-in" : "local-only")}
          role="status"
        >
          <span>
            {session
              ? `Ingelogd als ${session.user.email}`
              : "Lokaal gebruik · niet ingelogd"}
          </span>
          <button
            onClick={() =>
              session ? setModal({ kind: "login" }) : accessLogin()
            }
          >
            {session ? "Account bekijken" : "Inloggen voor centrale opslag"}
          </button>
        </div>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">VAN DER VELDEN · ZAAGERIJ</div>
              <h1>
                {tab === "projects"
                  ? "Alles klaar voor de volgende klus."
                  : tab === "input"
                    ? "Van tekening naar zaaglijst."
                    : tab === "plan"
                      ? "Een slim plan voor elke lengte."
                      : "Aan het werk."}
              </h1>
              <p>
                {tab === "input"
                  ? "Bereid je werk voor. Wij houden het overzicht."
                  : tab === "work"
                    ? "De juiste maat. De juiste hoek. Eén stap tegelijk."
                    : tab === "plan"
                      ? "Gepland met minder hoekwisselingen als prioriteit."
                      : "Je zaaglijsten, op één overzichtelijke plek."}
              </p>
            </div>
            <div className="heading-actions">
              {tab === "projects" ? (
                <Button primary icon={Plus} onClick={() => open(fresh())}>
                  Nieuwe zaaglijst
                </Button>
              ) : (
                <>
                  <Button icon={QrCode} onClick={share}>
                    Delen
                  </Button>
                  <Button primary icon={Save} onClick={() => persist()}>
                    Opslaan
                  </Button>
                  <Button icon={Copy} onClick={() => persist(true)}>
                    Opslaan als
                  </Button>
                </>
              )}
            </div>
          </div>
          {tab !== "projects" && (
            <div className="document-strip">
              <div className="doc-icon">
                <FileText size={20} />
              </div>
              <div>
                <strong>{doc.name}</strong>
                <span>
                  {doc.order || "Geen ordernummer"}{" "}
                  <span className="separator">/</span> Versie{" "}
                  {cloudVersion || doc.revision}
                </span>
              </div>
              <span className={"save-state " + (dirty ? "unsaved" : "")}>
                <span className="dot" />
                {dirty
                  ? "Niet opgeslagen"
                  : doc.savedAt
                    ? "Opgeslagen op dit apparaat"
                    : "Voorbeeld · nog niet opgeslagen"}
              </span>
              <button
                className="icon-button"
                aria-label="Opslagopties"
                onClick={() => setModal({ kind: "save" })}
              >
                <Settings2 size={20} />
              </button>
            </div>
          )}
          {legacyPlan && ["plan", "work"].includes(tab) && (
            <div className="notice">
              Deze lijst heeft nog de oude zaagweergave. Vernieuw het resterende
              plan voor de juiste hoek- en omkeerinstructies.
              <Button
                onClick={() => {
                  if (
                    doc.cutIds?.length ||
                    doc.events.some((e) => e.kind === "good")
                  )
                    setModal({ kind: "deviate" });
                  else change({ execution: null, cutIds: [] });
                }}
              >
                Plan vernieuwen
              </Button>
            </div>
          )}
          {tab === "projects" && (
            <>
              <div className="project-toolbar">
                <Button
                  icon={Cloud}
                  onClick={async () => {
                    try {
                      const rows = await listCentral();
                      setModal({ kind: "central", rows });
                    } catch (e) {
                      notify(e.message);
                      setModal({ kind: "login" });
                    }
                  }}
                >
                  Centrale lijsten
                </Button>
                <label className="search">
                  <Search size={18} />
                  <input
                    placeholder="Zoek een zaaglijst…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <Button icon={Upload} onClick={() => importRef.current.click()}>
                  Bestand openen
                </Button>
                <Button
                  onClick={() => {
                    const items = legacy();
                    if (!items.length)
                      return notify(
                        "Geen oude lokale zaaglijsten gevonden op dit webadres. Gebruik anders bestand openen.",
                      );
                    items.forEach(save);
                    setProjects(loadAll());
                    notify(items.length + " lijsten overgenomen");
                  }}
                >
                  Oude lijsten overnemen
                </Button>
              </div>
              <div className="project-grid">
                {projects
                  .filter((d) =>
                    d.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((d) => (
                    <article className="project-card" key={d.id}>
                      <div className="card-top">
                        <span className="badge">Zaaglijst</span>
                        <button
                          className="icon-button"
                          aria-label={"Verwijder " + d.name}
                          onClick={() => {
                            if (
                              confirm(
                                "Weet je zeker dat je deze zaaglijst wilt verwijderen?",
                              )
                            ) {
                              remove(d.id);
                              setProjects(loadAll());
                            }
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <h2>{d.name}</h2>
                      <p>{d.order || "Zonder ordernummer"}</p>
                      <div className="project-meta">
                        {d.pieces.reduce((n, p) => n + +p.qty, 0)} stukken{" "}
                        <span>·</span>{" "}
                        {new Date(d.savedAt).toLocaleDateString("nl-NL")}
                      </div>
                      <Button onClick={() => open(d)}>
                        Open zaaglijst <ArrowRight size={16} />
                      </Button>
                    </article>
                  ))}
                {!projects.length && (
                  <div className="empty card">
                    <FolderOpen size={35} />
                    <h2>Ruimte voor je volgende project</h2>
                    <p>
                      Sla de voorbeeldlijst op of begin met een nieuwe
                      zaaglijst.
                    </p>
                    <Button primary onClick={() => open(fresh())}>
                      Nieuwe lijst
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
          {tab === "input" && (
            <div className="input-layout">
              <div className="input-main">
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>
                        <span className="section-number">01</span> Materiaal &
                        instellingen
                      </h2>
                      <p>Groepeer stukken op het profiel dat je gaat zagen.</p>
                    </div>
                    <span className="badge blue">mm</span>
                  </div>
                  {doc.profiles.map((p) => (
                    <div className="profile-block" key={p.id}>
                      <div className="profile-fields">
                        <Field label="Materiaal">
                          <select
                            value={p.material || "Aluminium"}
                            onChange={(e) =>
                              updateProfile(p.id, "material", e.target.value)
                            }
                          >
                            {["Aluminium", "Staal", "RVS"].map((m) => (
                              <option key={m}>{m}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Profielafmeting">
                          <input
                            value={p.name}
                            list={"profiles-" + p.id}
                            onBlur={() => {
                              rememberProfile(p);
                              setLibrary(profileLibrary());
                            }}
                            onChange={(e) => {
                              if (
                                doc.events.some((e) => e.kind === "good") ||
                                doc.cutIds?.length
                              )
                                return notify(
                                  "Er is al gezaagd. Gebruik Afwijken voor het resterende werk.",
                                );
                              const picked = library.find(
                                (x) =>
                                  x.name === e.target.value &&
                                  (x.material || "Aluminium") ===
                                    (p.material || "Aluminium"),
                              );
                              if (picked) {
                                change((d) => ({
                                  ...d,
                                  execution: null,
                                  cutIds: [],
                                  profiles: d.profiles.map((x) =>
                                    x.id === p.id
                                      ? { ...x, ...picked, id: p.id }
                                      : x,
                                  ),
                                }));
                              } else
                                updateProfile(p.id, "name", e.target.value);
                            }}
                          />
                        </Field>
                        <Field label="Handelslengtes (mm)">
                          <input
                            defaultValue={p.stocks.join(", ")}
                            key={p.id + "stocks"}
                            onBlur={(e) =>
                              updateProfile(
                                p.id,
                                "stocks",
                                e.target.value.split(/[,;]/).map(Number),
                              )
                            }
                          />
                        </Field>
                        <Field label="Zaagblad (mm)">
                          <input
                            type="number"
                            value={p.kerf}
                            onChange={(e) =>
                              updateProfile(p.id, "kerf", e.target.value)
                            }
                          />
                        </Field>
                        <Field label="Breedte zaagvlak">
                          <input
                            type="number"
                            value={p.width}
                            onChange={(e) =>
                              updateProfile(p.id, "width", e.target.value)
                            }
                          />
                        </Field>
                      </div>
                      <datalist id={"profiles-" + p.id}>
                        {library
                          .filter(
                            (x) =>
                              (x.material || "Aluminium") ===
                              (p.material || "Aluminium"),
                          )
                          .map((x, i) => (
                            <option key={i} value={x.name} />
                          ))}
                      </datalist>
                      <button
                        className="text-button"
                        onClick={() => {
                          rememberProfile(p);
                          setLibrary(profileLibrary());
                          notify("Profiel bewaard in geheugen.");
                        }}
                      >
                        Profiel onthouden
                      </button>
                      <label className="toggle-line">
                        <input
                          type="checkbox"
                          checked={p.allowFlip}
                          onChange={(e) =>
                            updateProfile(p.id, "allowFlip", e.target.checked)
                          }
                        />
                        <span>Materiaal mag ondersteboven gekeerd worden</span>
                        <button
                          className="info"
                          onClick={() => setModal({ kind: "flip" })}
                          aria-label="Uitleg omkeren"
                        >
                          <Info size={15} />
                        </button>
                      </label>
                    </div>
                  ))}
                  <button
                    className="text-button"
                    onClick={() =>
                      change((d) => ({
                        ...d,
                        profiles: [
                          ...d.profiles,
                          {
                            id: uid(),
                            name: "Nieuw profiel",
                            width: 40,
                            kerf: 3,
                            stocks: [6000],
                            allowFlip: false,
                          },
                        ],
                      }))
                    }
                  >
                    <Plus size={16} /> Profiel toevoegen
                  </button>
                </section>
                <details className="card details advanced-options">
                  <summary>
                    Zaagopties{" "}
                    <span>
                      {doc.combine ? "Combineren aan" : "Losse sneden"}
                    </span>
                  </summary>
                  <label className="toggle-line">
                    <input
                      type="checkbox"
                      checked={!!doc.combine}
                      onChange={(e) => {
                        if (
                          doc.cutIds?.length ||
                          doc.events.some((x) => x.kind === "good")
                        )
                          return notify(
                            "Er is al gezaagd. Gebruik Afwijken om het resterende werk te herplannen.",
                          );
                        change({
                          combine: e.target.checked,
                          execution: null,
                          cutIds: [],
                        });
                      }}
                    />
                    Passende schuine sneden combineren
                  </label>
                  <p>
                    Alleen evenwijdige snijvlakken in hetzelfde zaagvlak worden
                    gecombineerd. Omkeren volgt de toestemming per profiel.
                  </p>
                </details>
                <section className="card pieces-card">
                  <div className="section-heading">
                    <div>
                      <h2>
                        <span className="section-number">02</span> Te zagen
                        stukken{" "}
                        <span className="count">{doc.pieces.length}</span>
                      </h2>
                      <p>Neem de maten en hoeken over van je tekening.</p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table className="pieces-table">
                      <thead>
                        <tr>
                          <th>Stuknr.</th>
                          <th>Aantal</th>
                          <th>Lengte · mm</th>
                          <th>Links ⓘ</th>
                          <th>Rechts ⓘ</th>
                          <th>Maatbasis</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {doc.pieces.map((p) => (
                          <React.Fragment key={p.id}>
                            <tr>
                              <td data-label="Stuknummer">
                                <input
                                  style={{ background: colorFor(p, doc) }}
                                  aria-label="Stuknummer"
                                  value={p.code}
                                  onChange={(e) =>
                                    updatePiece(p.id, "code", e.target.value)
                                  }
                                />
                              </td>
                              <td data-label="Aantal">
                                <input
                                  aria-label={"Aantal " + p.code}
                                  type="number"
                                  min="1"
                                  value={p.qty}
                                  onChange={(e) =>
                                    updatePiece(p.id, "qty", e.target.value)
                                  }
                                />
                              </td>
                              <td data-label="Lengte · mm">
                                <input
                                  aria-label={"Lengte " + p.code}
                                  type="number"
                                  value={p.length}
                                  onChange={(e) =>
                                    updatePiece(p.id, "length", e.target.value)
                                  }
                                />
                              </td>
                              {["left", "right"].map((k) => (
                                <td
                                  key={k}
                                  data-label={
                                    k === "left"
                                      ? "Linkerhoek · tekening"
                                      : "Rechterhoek · tekening"
                                  }
                                >
                                  <div className="angle-input">
                                    <input
                                      aria-label={
                                        (k === "left"
                                          ? "Linkerhoek "
                                          : "Rechterhoek ") + p.code
                                      }
                                      type="number"
                                      min="15"
                                      max="165"
                                      value={p[k]}
                                      onChange={(e) =>
                                        updatePiece(p.id, k, e.target.value)
                                      }
                                    />
                                    <button
                                      aria-label="Hoekuitleg"
                                      className={
                                        "info " +
                                        (![90, 45].includes(+p[k])
                                          ? "highlight"
                                          : "")
                                      }
                                      onClick={() =>
                                        setModal({
                                          kind: "angle",
                                          angle: p[k],
                                          left: p.left,
                                          right: p.right,
                                        })
                                      }
                                    >
                                      <Info size={14} />
                                    </button>
                                  </div>
                                  <div className="angle-quick">
                                    {[90, 45].map((a) => (
                                      <button
                                        key={a}
                                        className={
                                          +p[k] === a ? "selected" : ""
                                        }
                                        onClick={() => updatePiece(p.id, k, a)}
                                      >
                                        {a}°
                                      </button>
                                    ))}
                                    <button
                                      aria-label={
                                        "Bereken " +
                                        (k === "left"
                                          ? "linkerhoek "
                                          : "rechterhoek ") +
                                        p.code
                                      }
                                      onClick={() =>
                                        setModal({
                                          kind: "calculator",
                                          pieceId: p.id,
                                          field: k,
                                          initial: p[k],
                                        })
                                      }
                                    >
                                      <CalculatorIcon size={14} />
                                    </button>
                                  </div>
                                </td>
                              ))}
                              <td data-label="Maatbasis">
                                <select
                                  value={p.basis}
                                  onChange={(e) =>
                                    updatePiece(p.id, "basis", e.target.value)
                                  }
                                >
                                  <option value="long">Lange punten</option>
                                  <option value="short">Korte punten</option>
                                  <option value="center">Hartmaat</option>
                                </select>
                              </td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={"Verwijder stuk " + p.code}
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Weet je zeker dat je stuk " +
                                          p.code +
                                          " wilt verwijderen?",
                                      )
                                    )
                                      change((d) => ({
                                        ...d,
                                        pieces: d.pieces.filter(
                                          (x) => x.id !== p.id,
                                        ),
                                        events: d.events.filter(
                                          (e) =>
                                            !e.unit?.startsWith(p.id + ":"),
                                        ),
                                      }));
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                            {doc.profiles.length > 1 && (
                              <tr>
                                <td colSpan="7">
                                  <select
                                    value={p.profileId}
                                    onChange={(e) =>
                                      updatePiece(
                                        p.id,
                                        "profileId",
                                        e.target.value,
                                      )
                                    }
                                  >
                                    {doc.profiles.map((x) => (
                                      <option key={x.id} value={x.id}>
                                        {x.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                    {!doc.pieces.length && (
                      <div className="empty">
                        <p>Voeg je eerste stuk toe of lees een tekening in.</p>
                      </div>
                    )}
                  </div>
                  <div className="add-piece-bottom">
                    <Button icon={Plus} onClick={newPiece}>
                      Stuk toevoegen
                    </Button>
                  </div>
                  <div className="table-footer">
                    <span>
                      <Info size={14} /> 90° op tekening = 0° op de machine
                    </span>
                    <strong>{total} stukken totaal</strong>
                  </div>
                </section>
                <details className="card details">
                  <summary>
                    Reststukken <span>{doc.remnants.length} beschikbaar</span>
                  </summary>
                  <label className="toggle-line">
                    <input
                      type="checkbox"
                      checked={doc.useRemnants !== false}
                      onChange={(e) =>
                        change({
                          useRemnants: e.target.checked,
                          execution: null,
                        })
                      }
                    />
                    Reststukken meenemen
                  </label>
                  {doc.remnants.map((r) => (
                    <div className="remnant-row" key={r.id}>
                      <select
                        value={r.profileId}
                        onChange={(e) =>
                          change((d) => ({
                            ...d,
                            remnants: d.remnants.map((x) =>
                              x.id === r.id
                                ? { ...x, profileId: e.target.value }
                                : x,
                            ),
                          }))
                        }
                      >
                        {doc.profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        aria-label="Restlengte"
                        value={r.length}
                        onChange={(e) =>
                          change((d) => ({
                            ...d,
                            remnants: d.remnants.map((x) =>
                              x.id === r.id
                                ? { ...x, length: e.target.value }
                                : x,
                            ),
                          }))
                        }
                      />
                      <span>mm</span>
                      <button
                        className="icon-button"
                        aria-label="Verwijder reststuk"
                        onClick={() => {
                          if (confirm("Reststuk verwijderen?"))
                            change((d) => ({
                              ...d,
                              remnants: d.remnants.filter((x) => x.id !== r.id),
                            }));
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <Button
                    icon={Plus}
                    onClick={() =>
                      change((d) => ({
                        ...d,
                        remnants: [
                          ...d.remnants,
                          {
                            id: uid(),
                            profileId: d.profiles[0].id,
                            length: 2000,
                            endAngle: 90,
                          },
                        ],
                      }))
                    }
                  >
                    Reststuk toevoegen
                  </Button>
                </details>
              </div>
              <aside className="input-aside">
                <section className="card import-card">
                  <div className="purple-icon">
                    <FileImage size={22} />
                  </div>
                  <h2>Begin bij je tekening.</h2>
                  <p>
                    Voeg een foto of bestand toe. Je tekening blijft bij de
                    zaaglijst.
                  </p>
                  <div
                    className="dropzone"
                    onClick={() => attachmentRef.current.click()}
                  >
                    <Upload size={25} />
                    <strong>Kies een bestand</strong>
                    <span>Foto, PDF of CAD-bestand · max. 15 MB</span>
                  </div>
                  <div className="two-buttons">
                    <Button
                      icon={Camera}
                      onClick={() => cameraRef.current.click()}
                    >
                      Foto maken
                    </Button>
                    <Button
                      icon={FileImage}
                      onClick={() => attachmentRef.current.click()}
                    >
                      Inladen
                    </Button>
                  </div>
                  {doc.attachments.map((a) => (
                    <Attachment
                      key={a.id}
                      a={a}
                      onOpen={() => viewAttachment(a)}
                      onRead={() => setModal({ kind: "ai", attachment: a })}
                    />
                  ))}
                  <div className="subtle-note">
                    <span className="badge purple">AI</span> Herkenning levert
                    een voorstel. Jij controleert de maten.
                  </div>
                </section>
                <section className="card">
                  <h2>Projectgegevens</h2>
                  <div className="stack">
                    <Field label="Naam zaaglijst">
                      <input
                        value={doc.name}
                        onChange={(e) => change({ name: e.target.value })}
                      />
                    </Field>
                    <Field label="Klantnaam">
                      <input
                        value={doc.customer || ""}
                        onChange={(e) => change({ customer: e.target.value })}
                      />
                    </Field>
                    <Field label="Ordernummer">
                      <input
                        value={doc.order}
                        onChange={(e) => change({ order: e.target.value })}
                        placeholder="Bijv. 6026001-000"
                      />
                    </Field>
                    <Field label="Prioriteit">
                      <select
                        value={doc.priority}
                        onChange={(e) => change({ priority: e.target.value })}
                      >
                        <option value="time">Minder hoekwisselingen</option>
                        <option value="material">
                          Minder materiaalgebruik
                        </option>
                      </select>
                    </Field>
                  </div>
                  <div className="priority-note">
                    <CheckCircle2 size={17} />
                    <span>Tijd gaat voor materiaalbesparing.</span>
                  </div>
                </section>
                <Button
                  primary
                  icon={ArrowRight}
                  onClick={() => {
                    setStep(0);
                    setTab("plan");
                  }}
                >
                  Bekijk zaagplan
                </Button>
              </aside>
            </div>
          )}
          {tab === "plan" && (
            <>
              <div className="metrics compact-metrics">
                <Metric
                  value={result.bars.filter((b) => b.source === "new").length}
                  label="Nieuwe lengtes"
                />

                <Metric
                  value={
                    Math.round(
                      result.bars.reduce((n, b) => n + b.capacity - b.used, 0),
                    ) + " mm"
                  }
                  label="Resterend materiaal"
                />
                <Metric value={result.total ?? 0} label="Nog te zagen" />
              </div>
              {result.errors?.length > 0 ? (
                <div className="notice error">
                  {result.errors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              ) : (
                <>
                  <div className="print-header">
                    <div>
                      <h1>Zaaglijst · {doc.name}</h1>
                      <p>
                        Klant: {doc.customer || "—"} · Order: {doc.order || "—"}{" "}
                        · Versie {cloudVersion || doc.revision}
                      </p>
                    </div>
                    {printQr && <img src={printQr} alt="QR-code zaaglijst" />}
                  </div>
                  <div className="plan-heading">
                    <div>
                      <h2>Lengte-indeling</h2>
                      <p>
                        Aanvoer links → · aanslag rechts · lange punt als maat
                      </p>
                      <p>
                        {doc.combine
                          ? `${result.sharedCuts || 0} gedeelde sneden · ${Math.round(result.saved || 0)} mm bespaard`
                          : "Tik op een stuk om het gereed te melden."}
                      </p>
                    </div>
                    <Button
                      primary
                      icon={Hammer}
                      onClick={() => {
                        if (!doc.execution)
                          change((d) => ({
                            ...d,
                            execution: calculated,
                            cutIds: [],
                          }));
                        setStep(0);
                        setTab("work");
                      }}
                    >
                      Start uitvoering
                    </Button>
                    <Button icon={Printer} onClick={() => window.print()}>
                      Print / PDF
                    </Button>
                  </div>
                  {result.unplaced?.length > 0 && (
                    <div className="notice error">
                      {result.unplaced.length} stukken passen niet in de
                      beschikbare lengtes. Pas de voorraad aan.
                    </div>
                  )}
                  <PlanBars
                    bars={result.bars}
                    doc={doc}
                    onToggle={toggleGood}
                  />
                  {result.check?.ok && (
                    <div className="notice success">
                      <CheckCircle2 size={18} /> Aantallen en materiaalbalans
                      onafhankelijk gecontroleerd.
                    </div>
                  )}
                  <p className="footnote">
                    Stukken in een hoekgroep kunnen van verschillende staven
                    komen. Houd ze herkenbaar op stuknummer. Omkeren is alleen
                    toegestaan voor daarvoor vrijgegeven profielen.
                  </p>
                </>
              )}
            </>
          )}
          {tab === "work" && (
            <div className="work-layout">
              <section>
                <PlanBars bars={result.bars} doc={doc} onToggle={toggleGood} />
                <div className="work-progress">
                  <div>
                    <strong>
                      {completed} van {total} stukken gereed
                    </strong>
                    <span>
                      {total ? Math.round((completed / total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <i
                      style={{
                        width: (total ? (completed / total) * 100 : 0) + "%",
                      }}
                    />
                  </div>
                </div>
                {result.errors.length ? (
                  <div className="notice error">
                    Controleer eerst de invoer.
                  </div>
                ) : current ? (
                  <details className="cut-details">
                    <summary>
                      Volgende snede: {current.piece.code} · {current.angle}°{" "}
                      <span>
                        {current.shared
                          ? "Gedeeld"
                          : current.flip
                            ? "Onderzijde boven"
                            : "Bovenzijde boven"}
                      </span>
                    </summary>
                    <section className="card current-cut">
                      <div className="section-heading">
                        <span className="badge blue">HUIDIGE SNEDE</span>
                        <span>
                          Stap {step + 1} / {result.steps.length}
                        </span>
                      </div>
                      <div className="piece-code">{current.piece.code}</div>
                      <p>
                        {current.end === "rechts"
                          ? "Rechter uiteinde voorbereiden; daarna links op maat"
                          : "Aanslagmaat · buitenste lange punten"}
                      </p>
                      <div className="cut-length">
                        {Math.round(current.piece.long * 1000) / 1000}
                        <small>mm</small>
                      </div>
                      <p>
                        {
                          doc.profiles.find((p) => p.id === current.profileId)
                            ?.name
                        }
                      </p>
                      <PieceShape
                        piece={{
                          ...current.piece,
                          shape: undefined,
                          flipped: !!current.piece.flipped !== !!current.flip,
                        }}
                        orientationLabel={
                          current.flip
                            ? "Onderzijde staaf boven"
                            : "Bovenzijde staaf boven"
                        }
                        profile={doc.profiles.find(
                          (p) => p.id === current.profileId,
                        )}
                        highlight={current.end}
                      />
                      {current.shared && (
                        <div className="notice success">
                          Eén gedeelde snede: {current.piece.code} links +{" "}
                          {current.nextCode} rechts.
                        </div>
                      )}
                      <div className="roll-instruction">
                        <RotateCcw size={24} />
                        <strong>
                          {current.flip
                            ? "Onderzijde van de oorspronkelijke staaf boven"
                            : "Bovenzijde van de oorspronkelijke staaf boven"}
                        </strong>
                      </div>
                      <div className="cut-angles">
                        <div>
                          <span>TEKENING · {current.end.toUpperCase()}</span>
                          <strong>{current.angle}°</strong>
                        </div>
                        <ArrowRight size={23} />
                        <div>
                          <span>MACHINE</span>
                          <strong>{current.machine}°</strong>
                        </div>
                      </div>
                      {current.flip && (
                        <div className="notice purple-notice">
                          <RotateCcw size={22} />
                          <strong>
                            Leg de onderzijde boven. Laat de voorkeursrichting
                            van de zaag gelijk.
                          </strong>
                        </div>
                      )}
                      {current.reverseRequired && (
                        <div className="notice error">
                          Omkeren niet toegestaan: controleer de vereiste
                          zaagrichting vóór deze snede.
                        </div>
                      )}
                      <div className="cut-context">
                        Staaf{" "}
                        {result.bars.findIndex((b) => b.id === current.barId) +
                          1}{" "}
                        ·{" "}
                        {current.piece.basis === "long"
                          ? "Buitenste lange punten"
                          : current.piece.basis === "short"
                            ? "Korte punten"
                            : "Hartmaat"}
                      </div>
                      <Button
                        primary
                        icon={Check}
                        disabled={legacyPlan}
                        onClick={cut}
                      >
                        Snede gereed
                      </Button>
                      <div className="two-buttons">
                        <Button
                          icon={RefreshCw}
                          onClick={() => setModal({ kind: "deviate" })}
                        >
                          Afwijken
                        </Button>
                        <Button
                          icon={RotateCcw}
                          onClick={() => {
                            if (!doc.events.length)
                              return notify(
                                "Nog geen registratie om terug te draaien.",
                              );
                            change((d) => ({
                              ...d,
                              events: d.events.slice(0, -1),
                              cutIds: [],
                              execution: null,
                            }));
                            setDoneCuts({});
                            setStep(0);
                          }}
                        >
                          Ongedaan
                        </Button>
                      </div>
                    </section>
                  </details>
                ) : (
                  <section className="card empty">
                    <CheckCircle2 size={50} />
                    <h2>{total ? "Alles gereed!" : "Nog geen stukken"}</h2>
                    <p>
                      {total
                        ? "Alle stukken zijn geregistreerd. Sla je voortgang op."
                        : "Voeg eerst stukken toe bij Invoer."}
                    </p>
                  </section>
                )}
              </section>
              <aside className="card work-list">
                <h2>Stukvoortgang</h2>
                <p>Bestelde aantallen blijven behouden.</p>
                {doc.pieces.map((p) => {
                  const n = doc.events.filter(
                    (e) => e.kind === "good" && e.unit.startsWith(p.id + ":"),
                  ).length;
                  return (
                    <div key={p.id} className="progress-row">
                      <span
                        className="piece-tag"
                        style={{ background: colorFor(p, doc) }}
                      >
                        {p.code}
                      </span>
                      <div>
                        <strong>{p.length} mm</strong>
                        <span>
                          {p.left}° / {p.right}°
                        </span>
                      </div>
                      <strong className={n === +p.qty ? "green" : ""}>
                        {n} / {p.qty}
                      </strong>
                    </div>
                  );
                })}
                <Button icon={RefreshCw} onClick={() => checkUpdate()}>
                  Controleer kantoorversie
                </Button>
                <Button icon={Save} onClick={() => persist()}>
                  Voortgang opslaan
                </Button>
                <Button
                  icon={Cloud}
                  disabled={busy || !online}
                  onClick={progressSync}
                >
                  Voortgang synchroniseren
                </Button>
              </aside>
            </div>
          )}
          <footer className="page-footer">
            <span>
              Zaagerij 2.0 <span>·</span> Van der Velden Metaal Projecten
            </span>
            <span>Gemaakt voor vakwerk.</span>
          </footer>
        </main>
      </div>
      {["plan", "work"].includes(tab) && !progressOpen && (
        <button className="progress-peek" onClick={showProgress}>
          <CheckCircle2 size={16} />
          Gereedoverzicht · {completed}/{total}
          <span>← veeg</span>
        </button>
      )}
      {progressOpen && (
        <ProgressOverview
          doc={doc}
          onBack={hideProgress}
          onSave={() => persist()}
          onSync={progressSync}
        />
      )}
      <nav className="bottom-nav">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              if (id === "work" && !doc.execution)
                change((d) => ({ ...d, execution: calculated, cutIds: [] }));
              setTab(id);
            }}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <input
        ref={importRef}
        hidden
        type="file"
        accept=".json"
        onChange={importDoc}
      />
      <input
        ref={cameraRef}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={addAttachments}
      />
      <input
        ref={attachmentRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,.pdf,.sldprt,.slddrw,.step,.stp"
        multiple
        onChange={addAttachments}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (modal.url?.startsWith("blob:")) URL.revokeObjectURL(modal.url);
            setModal(null);
          }}
        >
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="close icon-button"
              aria-label="Sluiten"
              onClick={() => {
                if (modal.url?.startsWith("blob:"))
                  URL.revokeObjectURL(modal.url);
                setModal(null);
              }}
            >
              <X />
            </button>
            {modal.kind === "central" && (
              <>
                <h2>Centrale zaaglijsten</h2>
                <div className="stack">
                  {modal.rows.map((row) => (
                    <Button key={row.id} onClick={() => checkUpdate(row.id)}>
                      {row.name} · v{row.version}
                    </Button>
                  ))}
                  {!modal.rows.length && (
                    <p>Nog geen centraal gepubliceerde lijsten.</p>
                  )}
                </div>
              </>
            )}
            {modal.kind === "calculator" && (
              <Calculator
                initial={modal.initial}
                onUse={(value) => {
                  updatePiece(modal.pieceId, modal.field, value);
                  setModal(null);
                }}
              />
            )}
            {modal.kind === "save" && (
              <>
                <h2>Opslaan & bewaren</h2>
                <p>Je huidige lijst: {doc.name}</p>
                <div className="stack">
                  <Button
                    icon={Save}
                    onClick={() => {
                      persist();
                      setModal(null);
                    }}
                  >
                    Opslaan op dit apparaat
                  </Button>
                  <Button
                    icon={Copy}
                    onClick={() => {
                      persist(true);
                      setModal(null);
                    }}
                  >
                    Opslaan als…
                  </Button>
                  <Button icon={Download} onClick={exportDoc}>
                    Download back-upbestand
                  </Button>
                  <Button
                    icon={Upload}
                    onClick={() => importRef.current.click()}
                  >
                    Zaaglijstbestand openen
                  </Button>
                  <Button icon={Cloud} disabled={busy} onClick={sync}>
                    Centraal publiceren
                  </Button>
                </div>
                <p className="footnote">
                  Bijlagen staan apart op dit apparaat. De JSON-back-up bevat de
                  zaaglijst, niet de bijlagebestanden.
                </p>
              </>
            )}
            {modal.kind === "angle" && (
              <>
                <h2>Van tekenhoek naar machinehoek</h2>
                <AngleSketch left={modal.left} right={modal.right} />
                <div className="angle-equation">
                  {modal.angle}° <ArrowRight /> {machineAngle(modal.angle)}°
                </div>
                <p>
                  Links staat de hoek van je tekening. Rechts staat de afwijking
                  uit de rechte stand op je machine. De richting moet apart
                  worden gecontroleerd.
                </p>
                <p>90° op de tekening is recht zagen: 0° op de machine.</p>
                <div className="notice">
                  Voorkeursrichting: draaipunt achter, bewegende voorkant naar
                  rechts. De aanslag staat rechts. Controleer dit bovenaanzicht
                  met de echte machine.
                </div>
              </>
            )}
            {modal.kind === "flip" && (
              <>
                <h2>Materiaal omkeren</h2>
                <p>
                  Keer het materiaal ondersteboven om het andere uiteinde te
                  zagen met dezelfde zaagstand. Zet dit uit bij een profielvorm
                  of zichtzijde waarvoor dat niet mag.
                </p>
                <div className="flip-diagram">
                  <span>Bovenzijde boven</span>
                  <RotateCcw size={35} />
                  <span>Onderzijde boven</span>
                </div>
              </>
            )}
            {modal.kind === "login" && (
              <>
                <h2>
                  {session ? "Je account" : "Kantoor & werkplaats verbinden"}
                </h2>
                <p>
                  {session
                    ? session.user.email
                    : "Log in via Cloudflare Access. Alleen toegelaten medewerkers hebben toegang."}
                </p>
                {session ? (
                  <Button
                    onClick={async () => {
                      logout();
                      setModal(null);
                    }}
                  >
                    Uitloggen
                  </Button>
                ) : (
                  <form onSubmit={login}>
                    <Button primary disabled={busy}>
                      Inloggen via Cloudflare
                    </Button>
                    {!session && (
                      <p className="notice">
                        Log in met een eenmalige e-mailcode via Cloudflare
                        Access. Lokaal werken blijft beschikbaar.
                      </p>
                    )}
                  </form>
                )}
              </>
            )}
            {modal.kind === "share" && (
              <>
                <h2>Open in de werkplaats</h2>
                <img
                  className="qr"
                  src={qr}
                  alt="QR-code naar deze zaaglijst"
                />
                <p>
                  Scan de code en log in om de centraal opgeslagen lijst te
                  openen.
                </p>
                <input readOnly value={modal.url} />
                <div className="share-links">
                  <a
                    className="button"
                    href={
                      "https://wa.me/?text=" +
                      encodeURIComponent(doc.name + " " + modal.url)
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <a
                    className="button"
                    href={
                      "mailto:?subject=" +
                      encodeURIComponent("Zaaglijst " + doc.name) +
                      "&body=" +
                      encodeURIComponent(modal.url)
                    }
                  >
                    E-mail
                  </a>
                  {navigator.share && (
                    <Button
                      onClick={() =>
                        navigator
                          .share({ title: doc.name, url: modal.url })
                          .catch(() => {})
                      }
                    >
                      Delen via telefoon
                    </Button>
                  )}
                </div>
                <Button
                  onClick={() =>
                    navigator.clipboard
                      .writeText(modal.url)
                      .then(() => notify("Link gekopieerd"))
                      .catch(() => notify("Selecteer en kopieer de link."))
                  }
                >
                  Kopieer link
                </Button>
              </>
            )}
            {modal.kind === "version" && pending && (
              <>
                <h2>Nieuwe kantoorversie beschikbaar</h2>
                <p>
                  {pending.document.name} · versie {pending.version}
                </p>
                <p>
                  De nieuwe invoer wordt pas actief na jouw akkoord. Reeds
                  gereed gemelde stukken worden gecontroleerd op gewijzigde
                  maten.
                </p>
                <Button
                  primary
                  onClick={() => {
                    const newer = pending.document;
                    const conflicts =
                      doc.id === newer.id &&
                      doc.events
                        .filter((e) => e.kind === "good")
                        .some((e) => {
                          const old = doc.pieces.find((p) =>
                              e.unit.startsWith(p.id + ":"),
                            ),
                            n = newer.pieces.find(
                              (p) => old && p.id === old.id,
                            );
                          return (
                            !n ||
                            [
                              "length",
                              "left",
                              "right",
                              "profileId",
                              "basis",
                            ].some((k) => String(n[k]) !== String(old[k])) ||
                            +e.unit.split(":").at(-1) >= +n.qty
                          );
                        });
                    if (conflicts)
                      return notify(
                        "Deze versie wijzigt gereed werk. Overleg eerst met kantoor; niets is overgenomen.",
                      );
                    const d = save({
                      ...newer,
                      events:
                        doc.id === newer.id ? doc.events : newer.events || [],
                      cloudVersion: pending.version,
                    });
                    setDoc({ ...d, execution: null, cutIds: [] });
                    setCloudVersion(pending.version);
                    setDirty(false);
                    setDoneCuts({});
                    setStep(0);
                    setModal(null);
                    notify("Nieuwe versie geaccepteerd");
                  }}
                >
                  Nieuwe versie accepteren
                </Button>
                <Button onClick={() => setModal(null)}>
                  Huidige versie behouden
                </Button>
              </>
            )}
            {modal.kind === "file" && (
              <>
                <h2>{modal.name}</h2>
                {modal.type.startsWith("image/") ? (
                  <img className="file-preview" src={modal.url} />
                ) : (
                  <iframe
                    title={modal.name}
                    src={modal.url}
                    className="pdf-preview"
                  />
                )}
              </>
            )}
            {modal.kind === "ai" && (
              <>
                <h2>Tekening laten uitlezen</h2>
                <p>{modal.attachment.name}</p>
                {modal.attachment.status === "Conversie nodig" ? (
                  <p className="notice">
                    Dit CAD-bestand is toegevoegd. Voor uitlezen is eerst
                    conversie naar een technische PDF nodig. Native
                    SolidWorks-herkenning is nog niet aangesloten.
                  </p>
                ) : (
                  <DrawingReader
                    attachment={modal.attachment}
                    attachments={doc.attachments}
                    projectId={doc.id}
                    profiles={doc.profiles}
                    session={session}
                    onApply={(pieces) => {
                      if (
                        doc.events.some((e) => e.kind === "good") ||
                        doc.cutIds?.length
                      ) {
                        notify(
                          "Er wordt al gezaagd. Maak eerst een kopie via Opslaan als om nieuwe stukken toe te voegen.",
                        );
                        return;
                      }
                      change((d) => ({
                        ...d,
                        execution: null,
                        cutIds: [],
                        pieces: [
                          ...d.pieces,
                          ...pieces.map((p, i) => ({
                            ...p,
                            id: uid(),
                            color:
                              pieceColors[
                                (d.pieces.length + i) % pieceColors.length
                              ],
                          })),
                        ],
                      }));
                      setModal(null);
                      notify("Gecontroleerde regels toegevoegd.");
                    }}
                  />
                )}
              </>
            )}
            {modal.kind === "deviate" && (
              <Deviation
                doc={doc}
                onGood={(unit) => {
                  change((d) => ({
                    ...recordGood(d, unit),
                    execution: null,
                    cutIds: [],
                  }));
                  setDoneCuts({});
                  setStep(0);
                  setModal(null);
                  notify(
                    "Werkelijk gezaagd stuk geregistreerd. Restant opnieuw gepland.",
                  );
                }}
                onWaste={(length, angle) => {
                  change((d) => ({
                    ...d,
                    events: [
                      ...d.events,
                      {
                        id: uid(),
                        kind: "waste",
                        length,
                        angle,
                        at: Date.now(),
                      },
                    ],
                  }));
                  notify(
                    "Uitval geregistreerd. Pas de resterende staaf aan voordat je verder gaat.",
                  );
                }}
                onReplan={(length, angle, profileId) => {
                  change((d) => ({
                    ...d,
                    execution: null,
                    cutIds: [],
                    startAngle: angle,
                    remnants: [
                      ...d.remnants.filter((r) => !r.active),
                      {
                        id: uid(),
                        profileId,
                        length,
                        endAngle: angle,
                        active: true,
                      },
                    ],
                  }));
                  setStep(0);
                  setDoneCuts({});
                  setModal(null);
                  notify(
                    "Resterend werk opnieuw gepland vanaf de opgegeven restlengte.",
                  );
                }}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Metric({ value, label }) {
  return (
    <div className="card metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Attachment({ a, onOpen, onRead }) {
  const [url, setUrl] = useState();
  useEffect(() => {
    let u;
    fileGet(a.id).then((f) => {
      if (f?.type.startsWith("image/")) {
        u = URL.createObjectURL(f);
        setUrl(u);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [a.id]);
  return (
    <div className="attachment">
      <button onClick={onOpen}>
        {url ? <img src={url} alt={a.name} /> : <FileText size={24} />}
        <span>
          <strong>{a.name}</strong>
          <small>
            {a.status} · {(a.size / 1e6).toFixed(1)} MB · lokaal
          </small>
        </span>
      </button>
      <button className="text-button" onClick={onRead}>
        Uitlezen <ArrowRight size={13} />
      </button>
    </div>
  );
}
function Deviation({ doc, onGood, onWaste, onReplan }) {
  const [unit, setUnit] = useState(""),
    [length, setLength] = useState(""),
    [angle, setAngle] = useState(45),
    [profileId, setProfile] = useState(doc.profiles[0].id);
  return (
    <>
      <h2>Afwijken van het plan</h2>
      <p>Bestelde aantallen en gereed werk blijven behouden.</p>
      <h3>Ander stuk gezaagd</h3>
      <Field label="Kies het werkelijk gezaagde stuk">
        <select value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="">Kies een openstaand stuk</option>
          {remaining(doc).map((p) => (
            <option key={p.unit} value={p.unit}>
              {p.code} · {p.length} mm · {p.left}° / {p.right}° ·{" "}
              {doc.profiles.find((x) => x.id === p.profileId)?.name}
            </option>
          ))}
        </select>
      </Field>
      <Button
        disabled={!unit}
        onClick={() => {
          if (
            confirm("Profiel, lengte en beide hoeken gecontroleerd en correct?")
          )
            onGood(unit);
        }}
      >
        Als gereed registreren
      </Button>
      <hr />
      <h3>Herplan vanuit de huidige staaf</h3>
      <Field label="Profiel">
        <select value={profileId} onChange={(e) => setProfile(e.target.value)}>
          {doc.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Werkelijk resterende lengte (mm)">
        <input
          type="number"
          min="1"
          value={length}
          onChange={(e) => setLength(e.target.value)}
        />
      </Field>
      <Field label="Huidige eindhoek volgens tekening">
        <input
          type="number"
          min="15"
          max="165"
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
        />
      </Field>
      <Button
        primary
        disabled={!(+length > 0 && +angle >= 15 && +angle <= 165)}
        onClick={() => onReplan(+length, +angle, profileId)}
      >
        Herplan resterend werk
      </Button>
      <Button
        onClick={() => {
          if (+length > 0) onWaste(+length, +angle);
        }}
      >
        Deze lengte als uitval registreren
      </Button>
      <p className="footnote">
        Meet de rest opnieuw. De app leidt een resterende lengte niet af uit
        alleen het gekozen stuk.
      </p>
    </>
  );
}
createRoot(document.getElementById("root")).render(
  location.pathname.startsWith("/review") ? <Review /> : <App />,
);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/service-worker.js").catch(() => {}),
  );
