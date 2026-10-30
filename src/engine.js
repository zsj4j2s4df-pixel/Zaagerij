import { append, polygon, kerfX } from "./geometry.js";
// Angles follow the drawing: 90 = square. Length is the bounding long-point dimension.
export const uid = () => crypto.randomUUID();
export const machineAngle = (a) => Math.abs(90 - Number(a));
export function validate(doc) {
  const errors = [];
  if (!Array.isArray(doc.profiles) || !doc.profiles.length)
    errors.push("Voeg een profiel toe.");
  if (!Array.isArray(doc.pieces) || doc.pieces.length > 500)
    errors.push("Maximaal 500 stukregels toegestaan.");
  let total = 0;
  for (const p of doc.pieces || []) {
    const profile = doc.profiles?.find((x) => x.id === p.profileId);
    if (!profile) errors.push(`${p.code}: profiel ontbreekt.`);
    if (!Number.isFinite(+p.length) || +p.length <= 0)
      errors.push(`${p.code}: lengte moet positief zijn.`);
    if (!Number.isInteger(+p.qty) || +p.qty < 1)
      errors.push(`${p.code}: aantal moet een positief geheel getal zijn.`);
    total += +p.qty || 0;
    for (const a of [p.left, p.right])
      if (!Number.isFinite(+a) || +a < 15 || +a > 165)
        errors.push(`${p.code}: hoek moet tussen 15° en 165° liggen.`);
    if (
      profile &&
      Number.isFinite(+p.length) &&
      !polygon({ ...p, long: longLength(p, profile) }, profile).valid
    )
      errors.push(`${p.code}: te kort voor deze hoeken en profielbreedte.`);
    if (
      doc.combine &&
      (+p.left !== 90 || +p.right !== 90) &&
      !(+profile?.width > 0)
    )
      errors.push(
        `${p.code}: vul de profielbreedte in om schuine sneden te combineren.`,
      );
    if (p.basis !== "long" && !(+profile?.width > 0))
      errors.push(`${p.code}: vul breedte in voor deze maatbasis.`);
  }
  if (total > 2000) errors.push("Maximaal 2000 stukken per lijst.");
  for (const p of doc.profiles || []) {
    if (!Number.isFinite(+p.width) || +p.width < 0)
      errors.push("Profielbreedte moet nul of positief zijn.");
    if (!Number.isFinite(+p.kerf) || +p.kerf < 0 || +p.kerf > 20)
      errors.push("Zaagdikte moet tussen 0 en 20 mm liggen.");
    if (
      !p.stocks?.length ||
      p.stocks.some((n) => !Number.isFinite(+n) || +n <= 0)
    )
      errors.push("Vul positieve handelslengtes in.");
  }
  for (const r of doc.remnants || [])
    if (
      !Number.isFinite(+r.length) ||
      +r.length <= 0 ||
      !doc.profiles.some((p) => p.id === r.profileId)
    )
      errors.push("Controleer lengte en profiel van reststukken.");
  return errors;
}
export function longLength(p, profile) {
  const offset = (a) =>
    (+profile.width || 0) / Math.abs(Math.tan((+a * Math.PI) / 180));
  const extension = offset(p.left) + offset(p.right);
  return (
    +p.length +
    (p.basis === "short" ? extension : p.basis === "center" ? extension / 2 : 0)
  );
}
export function demands(doc) {
  return doc.pieces.flatMap((p) =>
    Array.from({ length: +p.qty }, (_, i) => ({
      ...p,
      unit: `${p.id}:${i}`,
      long: longLength(
        p,
        doc.profiles.find((x) => x.id === p.profileId),
      ),
    })),
  );
}
export function remaining(doc) {
  const done = new Set(
    doc.events.filter((e) => e.kind === "good").map((e) => e.unit),
  );
  return demands(doc).filter((p) => !done.has(p.unit));
}
// Independent projected cuts by default; optional shared planes require explicit geometry and orientation checks.
export function plan(doc) {
  const errors = validate(doc);
  if (errors.length) return { errors, bars: [], steps: [] };
  const bars = [],
    unplaced = [],
    steps = [];
  const open = remaining(doc);
  for (const profile of doc.profiles) {
    let pieces = open.filter((p) => p.profileId === profile.id);
    const initial = +doc.startAngle || 90;
    pieces.sort((a, b) => {
      if (doc.priority === "time") {
        let x = Math.min(
            Math.abs(+a.left - initial),
            Math.abs(+a.right - initial),
          ),
          y = Math.min(
            Math.abs(+b.left - initial),
            Math.abs(+b.right - initial),
          );
        if (x !== y) return x - y;
      }
      return b.long - a.long;
    });
    const bins = (doc.remnants || [])
      .filter(
        (r) =>
          doc.useRemnants !== false && r.profileId === profile.id && !r.used,
      )
      .map((r) => ({
        id: r.id,
        profileId: profile.id,
        source: "rest",
        capacity: +r.length,
        used: 0,
        items: [],
        endAngle: +r.endAngle || 90,
      }));
    for (const piece of pieces) {
      const choices = [];
      const orientations =
        doc.combine && profile.allowFlip ? [false, true] : [false];
      for (const bar of bins)
        for (const flip of orientations) {
          const item = append(bar, piece, profile, doc.combine, flip);
          if (item && item.end + item.kerfRight <= bar.capacity + 1e-6)
            choices.push({ bar, item, used: item.end + item.kerfRight });
        }
      choices.sort(
        (a, b) =>
          (doc.useRemnants
            ? (a.bar.source === "rest" ? 0 : 1) -
              (b.bar.source === "rest" ? 0 : 1)
            : 0) ||
          (doc.priority === "time"
            ? Number(b.item.shared) - Number(a.item.shared)
            : 0) ||
          a.bar.capacity - a.used - (b.bar.capacity - b.used),
      );
      let selected = choices[0];
      if (!selected) {
        for (const capacity of [...profile.stocks]
          .map(Number)
          .sort((a, b) => a - b)) {
          const bar = {
            id: uid(),
            profileId: profile.id,
            source: "new",
            capacity,
            used: 0,
            items: [],
            endAngle: 90,
          };
          const item = append(bar, piece, profile, false, false);
          if (item && item.end + item.kerfRight <= capacity + 1e-6) {
            selected = { bar, item, used: item.end + item.kerfRight };
            bins.push(bar);
            break;
          }
        }
      }
      if (!selected) {
        unplaced.push(piece);
        continue;
      }
      selected.bar.items.push(selected.item);
      selected.bar.used = selected.used;
    }
    bars.push(...bins.filter((b) => b.items.length));
  }
  for (const bar of bars) {
    const profile = doc.profiles.find((p) => p.id === bar.profileId);
    for (let i = 0; i < bar.items.length; i++) {
      const piece = bar.items[i],
        next = bar.items[i + 1];
      for (const [end, angle] of [
        ["links", +piece.left],
        ["rechts", +piece.right],
      ]) {
        if (end === "links" && piece.shared) continue;
        const slope =
          end === "links"
            ? piece.shape.lt - piece.shape.lb
            : piece.shape.rt - piece.shape.rb;
        const roll = profile.allowFlip && slope > 1e-6;
        const ends = [{ unit: piece.unit, end }];
        if (end === "rechts" && next?.shared)
          ends.push({ unit: next.unit, end: "links" });
        steps.push({
          id: `${piece.unit}:${end}`,
          unit: piece.unit,
          piece,
          barId: bar.id,
          profileId: profile.id,
          end,
          angle,
          machine: machineAngle(angle),
          flip: roll,
          reverseRequired: !profile.allowFlip && slope > 1e-6,
          shared: ends.length === 2,
          ends,
          nextCode: ends.length === 2 ? next.code : null,
        });
      }
    }
  }
  // Only the next physically reachable cut of each bar can be scheduled.
  if (doc.priority === "time") {
    const queues = bars.map((b) => steps.filter((s) => s.barId === b.id));
    const ordered = [];
    let at = machineAngle(doc.startAngle || 90),
      lastRoll = false;
    while (queues.some((q) => q.length)) {
      const candidates = queues
        .filter((q) => q.length)
        .sort(
          (a, b) =>
            Math.abs(a[0].machine - at) - Math.abs(b[0].machine - at) ||
            Number(a[0].flip !== lastRoll) - Number(b[0].flip !== lastRoll),
        );
      const next = candidates[0].shift();
      ordered.push(next);
      at = next.machine;
      lastRoll = next.flip;
    }
    steps.splice(0, steps.length, ...ordered);
  }
  const changes = steps.reduce(
    (s, x, i) => s + (i > 0 && x.machine !== steps[i - 1].machine ? 1 : 0),
    0,
  );
  const check = verify(doc, bars, unplaced);
  return {
    errors: [],
    model: "planar-v2",
    bars,
    steps,
    unplaced,
    changes,
    check,
    total: open.length,
    saved: bars.reduce(
      (n, b) => n + b.items.reduce((m, p) => m + p.required, 0) - b.used,
      0,
    ),
    sharedCuts: steps.filter((s) => s.shared).length,
  };
}
export function verify(doc, bars, unplaced = []) {
  const expected = new Set(remaining(doc).map((p) => p.unit)),
    seen = new Set();
  const errors = [];
  for (const bar of bars) {
    let consumed = 0,
      previous = null;
    for (const p of bar.items) {
      if (seen.has(p.unit) || !expected.has(p.unit))
        errors.push("Dubbel of onbekend stuk.");
      seen.add(p.unit);
      const source = doc.pieces.find((x) => x.id === p.id),
        profile = doc.profiles.find((x) => x.id === bar.profileId);
      if (!source || !profile || source.profileId !== bar.profileId) {
        errors.push("Profiel komt niet overeen.");
        continue;
      }
      if (p.flipped && !profile.allowFlip)
        errors.push("Omkeren is niet toegestaan.");
      const L = longLength(source, profile),
        shape = polygon({ ...source, long: L }, profile, p.flipped),
        kL = kerfX(source.left, profile.kerf),
        kR = kerfX(source.right, profile.kerf);
      if (
        !p.shape ||
        ["lt", "lb", "rt", "rb"].some(
          (k) => Math.abs(p.shape[k] - shape[k]) > 1e-6,
        )
      )
        errors.push("Getekende hoeken komen niet overeen met de invoer.");
      if (!shape.valid || Math.abs(p.long - L) > 1e-6)
        errors.push("Stukgeometrie klopt niet.");
      if (p.shared) {
        if (!previous || !doc.combine) errors.push("Ongeldige gedeelde snede.");
        else {
          const old = previous.shape;
          const top = p.start + shape.lt - (previous.start + old.rt),
            bottom = p.start + shape.lb - (previous.start + old.rb);
          if (Math.abs(top - kL) > 1e-6 || Math.abs(bottom - kL) > 1e-6)
            errors.push("Schuine vlakken sluiten niet aan.");
        }
      } else if (p.start + 1e-6 < consumed + kL)
        errors.push("Stukken overlappen zonder gedeelde snede.");
      consumed = p.start + L + kR;
      previous = { start: p.start, shape };
    }
    if (consumed > bar.capacity + 1e-6 || Math.abs(consumed - bar.used) > 1e-6)
      errors.push("Materiaalbalans klopt niet.");
  }
  for (const p of unplaced) {
    if (seen.has(p.unit)) errors.push("Dubbel stuk.");
    seen.add(p.unit);
  }
  if (seen.size !== expected.size) errors.push("Aantal stukken klopt niet.");
  return { ok: errors.length === 0, errors };
}
export function recordGood(doc, unit) {
  if (!remaining(doc).some((p) => p.unit === unit))
    throw Error("Dit stuk is al gereed of bestaat niet.");
  return {
    ...doc,
    events: [...doc.events, { id: uid(), kind: "good", unit, at: Date.now() }],
  };
}

// Ignore display-only metadata when comparing recorded work across app versions.
export function pieceSignature(p) {
  return JSON.stringify([
    p.id,
    p.profileId,
    +p.length,
    +p.qty,
    +p.left,
    +p.right,
    p.basis,
  ]);
}
export function signatureMatches(signature, piece) {
  if (!piece) return false;
  try {
    const source = JSON.parse(signature);
    return Array.isArray(source)
      ? signature === pieceSignature(piece)
      : pieceSignature(source) === pieceSignature(piece);
  } catch {
    return false;
  }
}
