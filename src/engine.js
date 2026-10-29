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
    if (p.basis !== "long" && !(+profile?.width > 0))
      errors.push(`${p.code}: vul breedte in voor deze maatbasis.`);
  }
  if (total > 2000) errors.push("Maximaal 2000 stukken per lijst.");
  for (const p of doc.profiles || []) {
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
// Conservative: two independent cuts per piece, projected kerf; no inferred nesting/shared cuts.
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
      .filter((r) => r.profileId === profile.id && !r.used)
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
      const required =
        piece.long +
        +profile.kerf / Math.sin((+piece.left * Math.PI) / 180) +
        +profile.kerf / Math.sin((+piece.right * Math.PI) / 180);
      let fits = bins.filter((b) => b.capacity - b.used >= required);
      fits.sort(
        (a, b) =>
          (doc.useRemnants
            ? (a.source === "rest" ? 0 : 1) - (b.source === "rest" ? 0 : 1)
            : 0) || a.capacity - a.used - (b.capacity - b.used),
      );
      let bar = fits[0];
      if (!bar) {
        const capacity = [...profile.stocks]
          .map(Number)
          .sort((a, b) => a - b)
          .find((n) => n >= required);
        if (!capacity) {
          unplaced.push(piece);
          continue;
        }
        bar = {
          id: uid(),
          profileId: profile.id,
          source: "new",
          capacity,
          used: 0,
          items: [],
          endAngle: 90,
        };
        bins.push(bar);
      }
      const trim = 0; // Both independent saw cuts are already included in required.
      bar.used += required + trim;
      bar.items.push({ ...piece, required, trim });
    }
    bars.push(...bins.filter((b) => b.items.length));
  }
  for (const bar of bars) {
    const profile = doc.profiles.find((p) => p.id === bar.profileId);
    for (const piece of bar.items) {
      for (const [end, angle] of [
        ["links", +piece.left],
        ["rechts", +piece.right],
      ])
        steps.push({
          id: `${piece.unit}:${end}`,
          unit: piece.unit,
          piece,
          barId: bar.id,
          profileId: profile.id,
          end,
          angle,
          machine: machineAngle(angle),
          flip: profile.allowFlip && end === "rechts" && angle !== 90,
        });
    }
  }
  // Only the next physically reachable cut of each bar can be scheduled.
  if (doc.priority === "time") {
    const queues = bars.map((b) => steps.filter((s) => s.barId === b.id));
    const ordered = [];
    let at = machineAngle(doc.startAngle || 90);
    while (queues.some((q) => q.length)) {
      const candidates = queues
        .filter((q) => q.length)
        .sort(
          (a, b) => Math.abs(a[0].machine - at) - Math.abs(b[0].machine - at),
        );
      const next = candidates[0].shift();
      ordered.push(next);
      at = next.machine;
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
    bars,
    steps,
    unplaced,
    changes,
    check,
    total: open.length,
  };
}
export function verify(doc, bars, unplaced = []) {
  const expected = new Set(remaining(doc).map((p) => p.unit)),
    seen = new Set();
  const errors = [];
  for (const bar of bars) {
    let consumed = 0;
    for (const p of bar.items) {
      if (seen.has(p.unit) || !expected.has(p.unit))
        errors.push("Dubbel of onbekend stuk.");
      seen.add(p.unit);
      const source = doc.pieces.find((x) => x.id === p.id),
        profile = doc.profiles.find((x) => x.id === bar.profileId);
      if (source.profileId !== bar.profileId)
        errors.push("Profiel komt niet overeen.");
      consumed +=
        longLength(source, profile) +
        Number(profile.kerf) / Math.sin((Number(source.left) * Math.PI) / 180) +
        Number(profile.kerf) /
          Math.sin((Number(source.right) * Math.PI) / 180) +
        Number(p.trim || 0);
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
