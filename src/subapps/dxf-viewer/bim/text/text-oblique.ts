/**
 * ADR-557 — OBLIQUE (AutoCAD slant) SHEAR: the single source of truth for mapping a text's
 * oblique angle to a shear factor. Consumed by BOTH text paths so they can NEVER diverge:
 *   - `rendering/entities/TextRenderer.ts` — shears the drawn glyphs (screen frame).
 *   - `bim/text/text-box.ts` — shears the grip / hover / hitTest box (world frame).
 *
 * WHY a shared module (Giorgio 2026-07-08): before this, each path computed `Math.tan(θ)`
 * on its own — the renderer as `-tan` (screen y-DOWN), the box as `+tan` (world y-UP) — two
 * independent conventions that had to be kept in sync by hand. They drifted: the box +
 * handles no longer coincided with the sheared glyphs. Collapsing the angle→shear map into
 * ONE function (this) + shearing BOTH around the SAME anchor (the text insertion point)
 * makes the box provably follow the renderer.
 *
 * CONVENTION (WORLD, y-up): a point at height `y` ABOVE the text anchor is displaced by
 * `+shear · y` along local +X — a positive oblique angle leans the TOP forward («/», like
 * italic). The renderer works in SCREEN space (y-DOWN); it negates this factor ONCE at its
 * call site (`-obliqueShearFromAngle(...)`), the only place the y-flip lives.
 *
 * Import-time pure: zero React / DOM / THREE / Firestore deps.
 *
 * @module bim/text/text-oblique
 */

/**
 * The oblique SHEAR factor `tan(θ)` for an AutoCAD oblique angle in DEGREES (world y-up
 * convention — see the module note). `0`, `undefined`, `null`, or a non-finite angle → `0`
 * (upright text, plain rectangle, byte-identical to the pre-oblique path).
 */
export function obliqueShearFromAngle(angleDeg: number | undefined | null): number {
  return typeof angleDeg === 'number' && Number.isFinite(angleDeg) && angleDeg !== 0
    ? Math.tan((angleDeg * Math.PI) / 180)
    : 0;
}
