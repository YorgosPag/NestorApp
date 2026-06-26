/**
 * hover-add-badge.ts — PURE SSOT for the AutoCAD-style "+"/"−" hover badge.
 *
 * The badge shown just NE of the cursor when a DXF/BIM entity is hovered: green "+"
 * (plain hover = add to selection) or red "−" (Shift held = remove). Extracted from
 * `CrosshairOverlay.applyBadge` so BOTH the 2D crosshair AND the 3D viewport badge
 * (`HoverAddBadge3D`) decide the text/colours from ONE place (ADR-538).
 *
 * Pure — no DOM, no React. Jest-friendly.
 */

/** Badge visual SSOT (was inline in CrosshairOverlay.applyBadge). */
export const HOVER_BADGE_STYLE = {
  add: { text: '+', color: '#44FF88', backgroundColor: '#0d2b0d' },
  remove: { text: '−', color: '#FF5555', backgroundColor: '#2b0d0d' },
} as const;

export interface HoverBadgeView {
  readonly visible: boolean;
  readonly text: string;
  readonly color: string;
  readonly backgroundColor: string;
}

/** Hidden state (shared frozen object — reference-stable). */
const HIDDEN: HoverBadgeView = { visible: false, text: '', color: '', backgroundColor: '' };

/**
 * Resolve the hover badge view: visible only when something is hovered; "+" (add) unless
 * Shift is held → "−" (remove). One decision SSoT for 2D crosshair + 3D badge.
 */
export function resolveHoverBadge(hoveredId: string | null, shiftHeld: boolean): HoverBadgeView {
  if (!hoveredId) return HIDDEN;
  const s = shiftHeld ? HOVER_BADGE_STYLE.remove : HOVER_BADGE_STYLE.add;
  return { visible: true, text: s.text, color: s.color, backgroundColor: s.backgroundColor };
}
