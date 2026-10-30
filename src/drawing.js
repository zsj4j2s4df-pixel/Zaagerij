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
          s &&
          ["stated", "inferred", "missing"].includes(s.status) &&
          [null, 1, 2].includes(s.file) &&
          (s.text === null || typeof s.text === "string") &&
          (s.page === null || (Number.isInteger(s.page) && s.page > 0)) &&
          (s.status !== "missing" || p[k] === null) &&
          (s.bbox === null ||
            (Array.isArray(s.bbox) &&
              s.bbox.length === 4 &&
              s.bbox.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
              s.bbox[2] >= s.bbox[0] &&
              s.bbox[3] >= s.bbox[1]))
        );
      }),
  );
}
