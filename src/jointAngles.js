// Drawing angles are measured against the piece axis; machine zero is square.
export function jointAngles({ kind, angle, symmetric = false }) {
  if (!Number.isFinite(angle)) return null;
  let machine;
  if (kind === "cut" && angle > 0 && angle < 180)
    return { drawing: angle, machine: Math.abs(90 - angle) };
  if (kind === "machine" && angle >= 0 && angle < 90)
    return { drawing: 90 - angle, machine: angle };
  if (!symmetric) return null;
  if (kind === "inside" && angle > 0 && angle < 180)
    machine = (180 - angle) / 2;
  else if (kind === "turn" && angle >= 0 && angle < 180) machine = angle / 2;
  else return null;
  return { drawing: 90 - machine, machine };
}

export function resolveDrawingAngles(result) {
  return {
    ...result,
    pieces: result.pieces.map((piece) => {
      const p = {
        ...piece,
        sources: { ...piece.sources },
        angleCalculations: {},
      };
      for (const end of ["left", "right"]) {
        const input = p.joints?.[end];
        if (!input) continue; // Older saved recognition results remain readable.
        const calculated = jointAngles(input);
        p[end] = calculated?.drawing ?? null;
        p.angleCalculations[end] = calculated
          ? { ...input, ...calculated }
          : null;
        p.sources[end] = {
          ...p.sources[end],
          status: calculated
            ? ["inside", "turn", "machine"].includes(input.kind)
              ? "inferred"
              : p.sources[end].status
            : "missing",
        };
      }
      return p;
    }),
  };
}
