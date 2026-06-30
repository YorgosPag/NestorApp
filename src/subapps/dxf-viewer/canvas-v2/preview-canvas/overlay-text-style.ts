/**
 * overlay-text-style — SINGLE SOURCE OF TRUTH for every TEXT/NUMBER label drawn on the
 * drawing-overlay layer: the Object-Snap-Tracking distance tooltip, the polar-tracking-line
 * tooltip, and the wall-ghost listening-dimension numbers. Giorgio (2026-06-21): «πλήρη
 * κεντρικοποίηση των κειμένων και των αριθμών».
 *
 * One font + size + chip-background draw routine. Colour stays per-caller (semantic). The
 * NUMERIC VALUE itself is formatted by the `formatLengthForDisplay` SSoT at the call site —
 * this module owns only the on-canvas TEXT rendering. Adopt `drawOverlayLabel` in ANY new
 * overlay label so the look never diverges.
 *
 * (Markers `+` and intersection halos carry no text → nothing to centralise there.)
 */

/** Font size (CSS px) for ALL overlay labels — screen-constant (zoom-independent). */
export const OVERLAY_TEXT_PX = 11;

/** Canonical overlay label font string. */
/** Clean sans-serif stack (native UI fonts → always resolves crisp). Change here only. */
export const OVERLAY_TEXT_FONT = `${OVERLAY_TEXT_PX}px Verdana, Tahoma, "Segoe UI", sans-serif`;

/**
 * Anti-collision SLOTS για overlay labels αγκυρωμένα δίπλα στον ΚΕΡΣΟΡΑ. Δύο cursor-adjacent
 * tooltips μπορεί να είναι ζωντανά ταυτόχρονα — το polar-tracking-line tooltip (πορτοκαλί) ΚΑΙ το
 * object-snap-tracking distance tooltip (γκρι). Όταν αγκυρώνονταν στο ΙΔΙΟ offset έπεφταν το ένα
 * πάνω στο άλλο (Giorgio 2026-06-30). Κάθε καταναλωτής διαλέγει ΔΙΑΦΟΡΕΤΙΚΟ slot εδώ ώστε να
 * ΣΤΟΙΒΑΖΟΝΤΑΙ (ένα πάνω, ένα κάτω από τον κέρσορα) αντί να συγκρούονται — η μη-επικάλυψη είναι
 * τεκμηριωμένο ΣΥΜΒΟΛΑΙΟ, όχι σύμπτωση. Screen px offsets από τον κέρσορα (`dx` δεξιά, `dy` κάτω).
 */
export const CURSOR_LABEL_SLOTS = {
  /** Slot ΠΑΝΩ-δεξιά του κέρσορα — polar-tracking-line tooltip (πορτοκαλί). */
  above: { dx: 14, dy: -10 },
  /** Slot ΚΑΤΩ-δεξιά του κέρσορα — object-snap-tracking distance tooltip (γκρι). */
  below: { dx: 14, dy: 16 },
  /** Slot ΠΙΟ-ΚΑΤΩ — opening-conflict 🔴 tooltip (ADR-508)· στοιβάζεται κάτω από το `below`. */
  belowFar: { dx: 14, dy: 42 },
} as const;

export interface OverlayLabelStyle {
  /** Glyph colour. */
  readonly textColor: string;
  /** 'left' = text starts at the anchor (tooltip beside cursor); 'center' = centred on the
   *  anchor (dimension number, placed clear of its dim line). Default 'left'. */
  readonly align?: 'left' | 'center';
}

/**
 * Draw `label` at screen-space `(anchorX, anchorY)` with the canonical overlay font. NO
 * background (Giorgio: «δεν θέλω φόντο κάτω από τα κείμενα») — callers anchor the label clear
 * of any guide line. No-op for an empty label. Self-contained ctx save/restore.
 */
export function drawOverlayLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  anchorX: number,
  anchorY: number,
  style: OverlayLabelStyle,
): void {
  if (!label) return;
  ctx.save();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.font = OVERLAY_TEXT_FONT;
  ctx.textAlign = style.align === 'center' ? 'center' : 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.textColor;
  ctx.fillText(label, anchorX, anchorY);
  ctx.restore();
}
