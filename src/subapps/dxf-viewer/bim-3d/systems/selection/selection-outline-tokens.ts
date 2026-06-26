// ============================================================================
// 🎯 BIM SELECTION OUTLINE COLOR TOKENS — single source of truth
// ADR-536 — Cinema 4D / Revit-style silhouette selection outline
// ============================================================================
//
// Authoritative source for the 3D selection silhouette color (the yellow/gold
// outline drawn around selected BIM entities by `SelectionOutlinePass`).
//
// Mirrors `accessibility/bim-a11y-color-tokens.ts` (focus ring = cyan): two
// formats are exported because the same color may be consumed by:
//   - Three.js (OutlinePass.visibleEdgeColor): numeric hex
//   - Canvas 2D / CSS (future legend / status indicators): CSS hex string
//
// Distinct concept from the a11y FOCUS ring (keyboard focus = cyan). Selection
// = gold. If the selection color changes, update ONLY this file.
// ============================================================================

/** Selection outline color as Three.js numeric hex — for OutlinePass / material consumers. */
export const BIM_SELECTION_OUTLINE_COLOR_THREE = 0xffaa16; // RGB(255, 170, 22)

/** Selection outline color as CSS hex string — for canvas-2d / CSS consumers. */
export const BIM_SELECTION_OUTLINE_COLOR_CSS = '#ffaa16' as const;

/**
 * ADR-538 — HOVER outline color (distinct from selection): the SAME yellow the 2D canvas
 * uses for the entity hover glow (`HOVER_HIGHLIGHT.ENTITY.glowColor = '#FFFF00'`), so a
 * hovered BIM mesh lights up in 3D exactly like a hovered entity in the 2D plan. Numeric
 * hex for the OutlinePass shader. Selection = gold (above), hover = yellow.
 */
export const BIM_HOVER_OUTLINE_COLOR_THREE = 0xffff00; // RGB(255, 255, 0) — mirrors #FFFF00
