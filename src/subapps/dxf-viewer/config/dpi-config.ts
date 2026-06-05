/**
 * Screen-DPI SSoT — physical-pixel ↔ millimetre conversion constants.
 *
 * The CSS reference pixel is defined as 1/96 inch, so a logical (CSS) pixel
 * maps to a fixed physical size regardless of `devicePixelRatio` (the browser
 * scales device pixels under the hood). Every place that needs to convert a
 * real-world millimetre value to/from on-screen CSS pixels — the view-scale
 * 1:N indicator (ADR-418) and the BIM line-weight renderers — must share these
 * constants instead of re-hardcoding `96` / `25.4`.
 *
 * ⚠️ Migration target: ~9 BIM renderers still pass `dpi = 96` inline to
 * `lineweightToPx()` (see `config/lineweight-iso-catalog.ts`). They should be
 * migrated to import `SCREEN_DPI` from here (tracked in pending-ratchet-work;
 * NOT done as part of ADR-418 to keep scope controlled).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-418-view-scale-ssot.md
 */

/** CSS reference DPI: a CSS pixel is 1/96 inch by definition. */
export const SCREEN_DPI = 96;

/** Millimetres per inch (exact). */
export const MM_PER_INCH = 25.4;

/**
 * CSS pixels per real-world millimetre on screen.
 * `valueMm * pxPerMmCss()` → CSS pixels at true physical size.
 */
export function pxPerMmCss(): number {
  return SCREEN_DPI / MM_PER_INCH;
}
