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
} from "lucide-react";
import QRCode from "qrcode";
import {
  uid,
  plan,
  remaining,
  recordGood,
  machineAngle,
  validate,
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
} from "./storage";
import { cloud, publish, fetchVersion, syncProgress } from "./cloud";
import "./style.css";
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
        return JSON.parse(localStorage.getItem("zaagerij:working")) || demo();
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
    [qr, setQr] = useState("");
  const importRef = useRef(),
    cameraRef = useRef(),
    attachmentRef = useRef();
  const calculated = useMemo(() => plan(doc), [doc]);
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
      doc.events.some((e) => e.kind === "good" && e.unit.startsWith(id + ":"))
    ) {
      notify(
        "Dit stuk heeft gereed werk. Maak een nieuwe lijstversie via Opslaan als.",
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
    if (doc.events.some((e) => e.kind === "good")) {
      notify(
        "Er is al gereed werk. Maak een nieuwe lijstversie via Opslaan als.",
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
    setDoc(d);
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
          e.signature === JSON.stringify(piece) &&
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
      d = { ...doc, id: uid(), name, events: [], revision: 1, cloudVersion: 0 };
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
    const f = await fileGet(a.id);
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
  async function login(e) {
    e.preventDefault();
    if (!cloud)
      return notify(
        "Supabase is nog niet gekoppeld. Lokaal werken blijft beschikbaar.",
      );
    setBusy(true);
    const { error } = await cloud.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin, shouldCreateUser: false },
    });
    setBusy(false);
    if (error) notify(error.message);
    else notify("Controleer je e-mail voor de inloglink.");
  }
  function cut() {
    if (!current) return;
    const ids = [...(doc.cutIds || []), current.id];
    const next = Object.fromEntries(ids.map((id) => [id, true]));
    if (next[`${current.unit}:links`] && next[`${current.unit}:rechts`]) {
      change((d) => ({ ...recordGood(d, current.unit), cutIds: ids }));
      setStep(0);
      notify(current.piece.code + " gereed gemeld");
    } else {
      change((d) => ({ ...d, cutIds: ids }));
      setStep(0);
      notify("Snede afgevinkt. Bewaar het stuk bij het juiste stuknummer.");
    }
  }
  useEffect(() => {
    localStorage.setItem("zaagerij:working", JSON.stringify(doc));
  }, [doc]);
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => setOnline(false);
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    if (cloud) {
      cloud.auth.getSession().then(({ data }) => setSession(data.session));
      const { data } = cloud.auth.onAuthStateChange((_, s) => setSession(s));
      return () => {
        data.subscription.unsubscribe();
        window.removeEventListener("online", yes);
        window.removeEventListener("offline", no);
      };
    }
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
          code: "S" + String(d.pieces.length + 1).padStart(2, "0"),
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
    <div className="app-shell">
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
            <Scissors size={21} />
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
          {tab === "projects" && (
            <>
              <div className="project-toolbar">
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
                        <Field label="Profiel / materiaal">
                          <input
                            value={p.name}
                            onChange={(e) =>
                              updateProfile(p.id, "name", e.target.value)
                            }
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
                    <Button icon={Plus} onClick={newPiece}>
                      Stuk toevoegen
                    </Button>
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
                              <td>
                                <input
                                  aria-label="Stuknummer"
                                  value={p.code}
                                  onChange={(e) =>
                                    updatePiece(p.id, "code", e.target.value)
                                  }
                                />
                              </td>
                              <td>
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
                              <td>
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
                                <td key={k}>
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
                                </td>
                              ))}
                              <td>
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
                    <Field label="Ordernummer">
                      <input
                        value={doc.order}
                        onChange={(e) => change({ order: e.target.value })}
                        placeholder="Bijv. VDV-2026-014"
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
              <div className="metrics">
                <Metric
                  value={result.bars.filter((b) => b.source === "new").length}
                  label="Nieuwe lengtes"
                />
                <Metric value={result.changes ?? 0} label="Hoekwisselingen" />
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
                  <div className="plan-heading">
                    <div>
                      <h2>Lengte-indeling</h2>
                      <p>
                        Volledige losse sneden · geen onbewezen verstekoverlap
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
                  </div>
                  {result.unplaced?.length > 0 && (
                    <div className="notice error">
                      {result.unplaced.length} stukken passen niet in de
                      beschikbare lengtes. Pas de voorraad aan.
                    </div>
                  )}
                  {result.bars.map((bar, i) => (
                    <section className="card bar-card" key={bar.id}>
                      <div className="section-heading">
                        <div>
                          <h2>
                            Lengte {i + 1}{" "}
                            <span className="badge">
                              {bar.source === "rest"
                                ? "Reststuk"
                                : "Nieuwe staaf"}
                            </span>
                          </h2>
                          <p>
                            {
                              doc.profiles.find((p) => p.id === bar.profileId)
                                ?.name
                            }
                          </p>
                        </div>
                        <strong>{bar.capacity} mm</strong>
                      </div>
                      <div className="bar-visual">
                        {bar.items.map((p, j) => (
                          <div
                            key={p.unit}
                            style={{
                              flex: p.required,
                              background: ["#dbe9ff", "#e9e0fb", "#d7eee9"][
                                j % 3
                              ],
                            }}
                            title={`${p.code}: ${p.long} mm`}
                          >
                            <strong>{p.code}</strong>
                            <span>{Math.round(p.long)}</span>
                          </div>
                        ))}
                        <div
                          className="bar-rest"
                          style={{ flex: Math.max(0, bar.capacity - bar.used) }}
                        >
                          <span>
                            Rest {Math.round(bar.capacity - bar.used)}
                          </span>
                        </div>
                      </div>
                      <div className="bar-caption">
                        <span>
                          {bar.items.length} stukken · {Math.round(bar.used)} mm
                          verbruikt inclusief zaagsneden
                        </span>
                        <span>
                          {Math.round(bar.capacity - bar.used)} mm rest
                        </span>
                      </div>
                    </section>
                  ))}
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
                  <section className="card current-cut">
                    <div className="section-heading">
                      <span className="badge blue">HUIDIGE SNEDE</span>
                      <span>
                        Stap {step + 1} / {result.steps.length}
                      </span>
                    </div>
                    <div className="piece-code">{current.piece.code}</div>
                    <div className="cut-length">
                      {current.piece.length}
                      <small>mm</small>
                    </div>
                    <p>
                      {
                        doc.profiles.find((p) => p.id === current.profileId)
                          ?.name
                      }
                    </p>
                    <AngleSketch
                      left={current.piece.left}
                      right={current.piece.right}
                    />
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
                        <strong>Materiaal omkeren — onderzijde boven</strong>
                      </div>
                    )}
                    {!doc.profiles.find((p) => p.id === current.profileId)
                      ?.allowFlip &&
                      current.end === "rechts" &&
                      current.angle !== 90 && (
                        <div className="notice error">
                          Omkeren niet toegestaan: controleer de vereiste
                          zaagrichting vóór deze snede.
                        </div>
                      )}
                    <div className="cut-context">
                      Staaf{" "}
                      {result.bars.findIndex((b) => b.id === current.barId) + 1}{" "}
                      ·{" "}
                      {current.piece.basis === "long"
                        ? "Buitenste lange punten"
                        : current.piece.basis === "short"
                          ? "Korte punten"
                          : "Hartmaat"}
                    </div>
                    <Button primary icon={Check} onClick={cut}>
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
                      <span className="piece-tag">{p.code}</span>
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
                    : "Log in via een veilige link in je e-mail. Alleen uitgenodigde medewerkers hebben toegang."}
                </p>
                {session ? (
                  <Button
                    onClick={async () => {
                      await cloud.auth.signOut();
                      setModal(null);
                    }}
                  >
                    Uitloggen
                  </Button>
                ) : (
                  <form onSubmit={login}>
                    <Field label="E-mailadres">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </Field>
                    <Button primary disabled={busy || !cloud}>
                      Stuur inloglink
                    </Button>
                    {!cloud && (
                      <p className="notice">
                        Centrale opslag is nog niet gekoppeld. Je kunt lokaal
                        blijven werken en back-ups downloaden.
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
                    const conflicts = doc.events
                      .filter((e) => e.kind === "good")
                      .some((e) => {
                        const old = doc.pieces.find((p) =>
                            e.unit.startsWith(p.id + ":"),
                          ),
                          n = newer.pieces.find((p) => old && p.id === old.id);
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
                  <AIReader
                    attachment={modal.attachment}
                    session={session}
                    onApply={(pieces) => {
                      change((d) => ({
                        ...d,
                        pieces: [
                          ...d.pieces,
                          ...pieces.map((p) => ({
                            ...p,
                            id: uid(),
                            profileId: d.profiles[0].id,
                            basis: "long",
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
function AIReader({ attachment, session, onApply }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pieces, setPieces] = useState(null),
    [checked, setChecked] = useState(false);
  async function read() {
    setBusy(true);
    setError("");
    try {
      if (!session)
        throw Error("Log eerst in om de beveiligde herkenning te gebruiken.");
      const f = await fileGet(attachment.id);
      if (!f) throw Error("Bijlage ontbreekt op dit apparaat.");
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      const response = await fetch("/api/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({ name: f.name, type: f.type, data }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Uitlezen mislukt.");
      setPieces(result.pieces);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p>
        Herkenning stelt stuknummers, maten, aantallen en hoeken voor.
        Controleer iedere regel tegen de tekening.
      </p>
      <Button primary disabled={busy} onClick={read}>
        {busy ? "Tekening wordt uitgelezen…" : "Lees tekening uit"}
      </Button>
      {error && <div className="notice error">{error}</div>}
      {pieces && (
        <>
          <div className="notice">
            Controleer ook het profiel, de maatbasis en alle onzekere waarden.
            Regels zonder volledige maten worden niet toegevoegd.
          </div>
          {pieces.map((p, i) => (
            <div className="ai-row" key={i}>
              <strong>{p.code}</strong>
              {["length", "qty", "left", "right"].map((k) => (
                <input
                  key={k}
                  aria-label={k}
                  type="number"
                  value={p[k] ?? ""}
                  onChange={(e) =>
                    setPieces((a) =>
                      a.map((x, j) =>
                        i === j ? { ...x, [k]: +e.target.value } : x,
                      ),
                    )
                  }
                />
              ))}
              <small>{p.note}</small>
            </div>
          ))}
          <label className="toggle-line">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            Ik heb alle regels met de tekening gecontroleerd.
          </label>
          <Button
            disabled={
              !checked ||
              pieces.some(
                (p) =>
                  !p.length ||
                  !Number.isInteger(p.qty) ||
                  p.qty < 1 ||
                  !Number.isFinite(p.left) ||
                  !Number.isFinite(p.right) ||
                  p.left < 15 ||
                  p.right < 15 ||
                  p.left > 165 ||
                  p.right > 165,
              )
            }
            onClick={() => onApply(pieces)}
          >
            Gecontroleerde regels toevoegen
          </Button>
        </>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/service-worker.js").catch(() => {}),
  );
