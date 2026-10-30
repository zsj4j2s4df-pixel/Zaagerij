export const drawingFields = ["length", "qty", "left", "right"];
export function completeDrawingRow(p, profiles) {
  return (
    p.length > 0 &&
    Number.isFinite(p.length) &&
    Number.isInteger(p.qty) &&
    p.qty > 0 &&
    p.qty <= 2000 &&
    [p.left, p.right].every((a) => Number.isFinite(a) && a >= 15 && a <= 165) &&
    ["long", "short", "center"].includes(p.basis) &&
    profiles.some((x) => x.id === p.profileId)
  );
}
const object = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const source = object({
  status: { type: "string", enum: ["stated", "inferred", "missing"] },
  file: { type: ["integer", "null"], enum: [1, 2, null] },
  page: { type: ["integer", "null"] },
  text: { type: ["string", "null"] },
  bbox: { type: ["array", "null"], items: { type: "number" } },
});
const joint = object({
  kind: {
    type: "string",
    enum: ["cut", "machine", "inside", "turn", "unknown"],
  },
  angle: { type: ["number", "null"] },
  symmetric: { type: "boolean" },
});
const lengthCalculation = object({
  root: { type: ["string", "null"] },
  nodes: {
    type: "array",
    items: object({
      id: { type: "string" },
      op: {
        type: "string",
        enum: [
          "input",
          "add",
          "subtract",
          "multiply",
          "divide",
          "hypot",
          "sin",
          "cos",
          "tan",
        ],
      },
      args: { type: "array", items: { type: "string" } },
      value: { type: ["number", "null"] },
      unit: { type: "string", enum: ["mm", "deg", "ratio"] },
      source,
    }),
  },
});
export const drawingSchema = object({
  complete: { type: "boolean" },
  warnings: { type: "array", items: { type: "string" } },
  pieces: {
    type: "array",
    items: object({
      code: { type: "string" },
      length: { type: ["number", "null"] },
      qty: { type: ["integer", "null"] },
      left: { type: ["number", "null"] },
      right: { type: ["number", "null"] },
      basis: { type: "string", enum: ["long", "short", "center", "unknown"] },
      profileName: { type: "string" },
      material: { type: "string" },
      note: { type: "string" },
      joints: object({ left: joint, right: joint }),
      location: source,
      lengthCalculation,
      sources: object(
        Object.fromEntries(drawingFields.map((k) => [k, source])),
      ),
    }),
  },
});
export function validateDrawingResult(result) {
  if (
    !Array.isArray(result?.pieces) ||
    result.pieces.length > 30 ||
    typeof result.complete !== "boolean" ||
    !Array.isArray(result.warnings) ||
    result.warnings.some((x) => typeof x !== "string")
  )
    return false;
  return result.pieces.every(
    (p) =>
      p &&
      (p.joints === undefined ||
        ["left", "right"].every((end) => {
          const j = p.joints?.[end];
          return (
            j &&
            ["cut", "machine", "inside", "turn", "unknown"].includes(j.kind) &&
            (j.angle === null ||
              (typeof j.angle === "number" && Number.isFinite(j.angle))) &&
            typeof j.symmetric === "boolean"
          );
        })) &&
      (p.location === undefined || validDrawingSource(p.location)) &&
      (p.lengthCalculation === undefined || validChain(p.lengthCalculation)) &&
      typeof p.code === "string" &&
      typeof p.note === "string" &&
      typeof p.profileName === "string" &&
      typeof p.material === "string" &&
      ["long", "short", "center", "unknown"].includes(p.basis) &&
      drawingFields.every((k) => {
        const s = p.sources?.[k];
        return (
          (p[k] === null ||
            (typeof p[k] === "number" && Number.isFinite(p[k]))) &&
          validDrawingSource(s) &&
          (s.status !== "missing" || p[k] === null)
        );
      }),
  );
}

export function validDrawingSource(s) {
  return (
    !!s &&
    ["stated", "inferred", "missing"].includes(s.status) &&
    [null, 1, 2].includes(s.file) &&
    (s.text === null || typeof s.text === "string") &&
    (s.page === null || (Number.isInteger(s.page) && s.page > 0)) &&
    (s.bbox === null ||
      (Array.isArray(s.bbox) &&
        s.bbox.length === 4 &&
        s.bbox.every(
          (n) =>
            typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1,
        ) &&
        s.bbox[2] >= s.bbox[0] &&
        s.bbox[3] >= s.bbox[1]))
  );
}
function validChain(c) {
  return (
    !!c &&
    (c.root === null || typeof c.root === "string") &&
    Array.isArray(c.nodes) &&
    c.nodes.length <= 40 &&
    c.nodes.every(
      (n) =>
        n &&
        typeof n.id === "string" &&
        [
          "input",
          "add",
          "subtract",
          "multiply",
          "divide",
          "hypot",
          "sin",
          "cos",
          "tan",
        ].includes(n.op) &&
        Array.isArray(n.args) &&
        n.args.length <= 2 &&
        n.args.every((a) => typeof a === "string") &&
        (n.value === null ||
          (typeof n.value === "number" && Number.isFinite(n.value))) &&
        ["mm", "deg", "ratio"].includes(n.unit) &&
        validDrawingSource(n.source),
    )
  );
}
export function drawingSources(piece) {
  return [
    ...Object.values(piece.sources),
    ...(piece.location ? [piece.location] : []),
    ...(piece.lengthCalculation?.nodes || []).map((n) => n.source),
  ];
}
