// A bounded dimensional expression graph. No JavaScript or document code is run.
const kinds = new Set([
  "input",
  "add",
  "subtract",
  "multiply",
  "divide",
  "hypot",
  "sin",
  "cos",
  "tan",
]);
export function solveDimensionChain(chain) {
  if (
    !chain ||
    !Array.isArray(chain.nodes) ||
    !chain.nodes.length ||
    chain.nodes.length > 40
  )
    return null;
  const nodes = new Map(),
    values = new Map(),
    visiting = new Set(),
    steps = [];
  for (const n of chain.nodes) {
    if (
      !n ||
      typeof n.id !== "string" ||
      !n.id ||
      nodes.has(n.id) ||
      !kinds.has(n.op) ||
      !Array.isArray(n.args) ||
      n.args.length > 2
    )
      return null;
    nodes.set(n.id, n);
  }
  function read(id) {
    if (values.has(id)) return values.get(id);
    const n = nodes.get(id);
    if (!n || visiting.has(id))
      throw Error("Maatketen ontbreekt of is cyclisch.");
    visiting.add(id);
    let value, unit;
    if (n.op === "input") {
      if (
        n.args.length ||
        !Number.isFinite(n.value) ||
        !["mm", "deg", "ratio"].includes(n.unit) ||
        n.source?.status !== "stated" ||
        ![1, 2].includes(n.source.file) ||
        !n.source.text?.trim()
      )
        throw Error("Geen expliciete bronmaat.");
      value = n.value;
      unit = n.unit;
    } else {
      const a = n.args.map(read);
      if (["sin", "cos", "tan"].includes(n.op)) {
        if (a.length !== 1 || a[0].unit !== "deg" || Math.abs(a[0].value) > 360)
          throw Error("Hoek nodig.");
        value = Math[n.op]((a[0].value * Math.PI) / 180);
        unit = "ratio";
      } else {
        if (a.length !== 2) throw Error("Twee maten nodig.");
        const [x, y] = a;
        if (["add", "subtract", "hypot"].includes(n.op)) {
          if (x.unit !== y.unit || (n.op === "hypot" && x.unit !== "mm"))
            throw Error("Ongelijke eenheden.");
          unit = x.unit;
          value =
            n.op === "add"
              ? x.value + y.value
              : n.op === "subtract"
                ? x.value - y.value
                : Math.hypot(x.value, y.value);
        } else if (n.op === "multiply") {
          if (x.unit !== "ratio" && y.unit !== "ratio")
            throw Error("Ongeldige vermenigvuldiging.");
          unit = x.unit === "ratio" ? y.unit : x.unit;
          value = x.value * y.value;
        } else {
          if (
            Math.abs(y.value) < 1e-9 ||
            (y.unit !== "ratio" && y.unit !== x.unit)
          )
            throw Error("Ongeldige deling.");
          unit = y.unit === "ratio" ? x.unit : "ratio";
          value = x.value / y.value;
        }
      }
    }
    if (!Number.isFinite(value) || Math.abs(value) > 1e9)
      throw Error("Ongeldige uitkomst.");
    const result = { value, unit };
    values.set(id, result);
    visiting.delete(id);
    steps.push({
      id,
      op: n.op,
      args: n.args,
      ...result,
      source: n.op === "input" ? n.source : null,
    });
    return result;
  }
  try {
    const result = read(chain.root);
    if (result.unit !== "mm" || result.value <= 0 || result.value > 1000000)
      return null;
    return { length: Math.round(result.value * 1000000) / 1000000, steps };
  } catch {
    return null;
  }
}

export function resolveDrawingLengths(result) {
  return {
    ...result,
    pieces: result.pieces.map((p) => {
      if (p.lengthCalculation === undefined) return p;
      const calculated = solveDimensionChain(p.lengthCalculation);
      return {
        ...p,
        length: calculated?.length ?? null,
        lengthSteps: calculated?.steps ?? [],
        sources: {
          ...p.sources,
          length: {
            ...p.sources.length,
            status: calculated
              ? calculated.steps.length === 1
                ? "stated"
                : "inferred"
              : "missing",
          },
        },
        calculationError: calculated
          ? ""
          : "De lengte kan nog niet worden berekend uit een sluitende maatketen. Controleer de benodigde maten en de aansluiting.",
      };
    }),
  };
}
