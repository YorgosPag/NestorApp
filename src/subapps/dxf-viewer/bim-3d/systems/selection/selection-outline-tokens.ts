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
export const BIM_SELECTION_OUTLINE_COLOR_THREE = 0xffd700;

/** Selection outline color as CSS hex string — for canvas-2d / CSS consumers. */
export const BIM_SELECTION_OUTLINE_COLOR_CSS = '#ffd700' as const;
