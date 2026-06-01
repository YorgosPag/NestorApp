/**
 * Cut-plane tilt projection drawing (ADR-404 Phase 3 — Revit slanted-in-plan).
 *
 * Κοινός 2Δ render helper για κολώνα + τοίχο: η γερμένη οντότητα προβάλλεται στην
 * κάτοψη ως **δύο περιγράμματα** — το **footprint στο cut plane** (όπου κόβεται
 * πραγματικά → παχύ/cut στυλ, ζωγραφισμένο από τον renderer με το σώμα μεταφερμένο
 * κατά `shift`) και η **βάση** (πραγματική θέση → **λεπτό projection** outline, εδώ)
 * — ενωμένα με **connecting lines** στις αντίστοιχες γωνίες. Ακριβώς η Revit
 * αναπαράσταση slanted column / battered wall σε floor plan (cut = βαρύ, base = ελαφρύ).
 *
 * Pure ctx draw — μηδέν store subscriptions (ADR-040 micro-leaf compliant). Δέχεται
 * το ring της **βάσης** (closed polygon vertices, canvas-world units) + τη μετατόπιση
 * προς το cut plane (canvas units) + το affine `worldToScreen` του renderer.
 *
 * @see ../geometry/cut-plane-tilt.ts — SSoT μετατόπισης (columnCutPlaneShiftCanvas/…)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md
 */

interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Λεπτή γραμμή projection (px) — δευτερεύον σύμβολο, διακριτό από το cut outline. */
const TILT_PROJECTION_LINE_WIDTH_PX = 0.75;

/**
 * Screen delta (px) μιας canvas-world μετατόπισης, μέσω του affine `worldToScreen`
 * (linear part → delta ανεξάρτητο από base point). Ο renderer το χρησιμοποιεί για
 * `ctx.translate` ώστε το πλήρες σώμα (cut στυλ) να ζωγραφιστεί στο cut plane.
 */
export function cutPlaneShiftScreenDelta(
  shift: { readonly dx: number; readonly dy: number },
  worldToScreen: (p: Vec2) => Vec2,
): Vec2 {
  const o = worldToScreen({ x: 0, y: 0 });
  const p = worldToScreen({ x: shift.dx, y: shift.dy });
  return { x: p.x - o.x, y: p.y - o.y };
}

/**
 * Σχεδιάζει το **λεπτό** outline της **βάσης** (στο πραγματικό `ring`) + τις
 * connecting lines από κάθε γωνία της βάσης στην αντίστοιχη γωνία του cut plane
 * (`ring + shift`). Το **cut-plane footprint** (παχύ/cut στυλ) ζωγραφίζεται χωριστά
 * από τον renderer με το σώμα μεταφερμένο κατά `shift` — εδώ μόνο η ελαφριά βάση + οι ακμές.
 */
export function drawCutPlaneTiltProjection(
  ctx: CanvasRenderingContext2D,
  ring: ReadonlyArray<Vec2>,
  shift: { readonly dx: number; readonly dy: number },
  worldToScreen: (p: Vec2) => Vec2,
  strokeStyle: string,
): void {
  if (ring.length < 3) return;

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = TILT_PROJECTION_LINE_WIDTH_PX;
  ctx.setLineDash([]);

  // Connecting lines: βάση-γωνία → cut-plane-γωνία (οι ακμές της γερμένης οντότητας).
  ctx.beginPath();
  for (const v of ring) {
    const a = worldToScreen(v);
    const b = worldToScreen({ x: v.x + shift.dx, y: v.y + shift.dy });
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  // Base footprint outline (πραγματική θέση, λεπτό).
  ctx.beginPath();
  const first = worldToScreen(ring[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < ring.length; i++) {
    const s = worldToScreen(ring[i]);
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}
