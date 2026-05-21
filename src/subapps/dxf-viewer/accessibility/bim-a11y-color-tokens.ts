// ============================================================================
// ♿ BIM A11Y COLOR TOKENS — single source of truth for accessibility colors
// ADR-366 Phase 4.6 / A.7.Q1 — Item #5 focus outline color tokenization
// ============================================================================
//
// These constants are the authoritative source for BIM focus outline colors.
// Two formats are exported because the same color is consumed by:
//   - Canvas 2D API (ctx.strokeStyle): CSS hex string
//   - Three.js (LineDashedMaterial.color): numeric hex
//
// If the color changes, update ONLY this file.
// ============================================================================

/** Focus outline color as CSS hex string — for canvas-2d API and CSS consumers. */
export const BIM_FOCUS_OUTLINE_COLOR_CSS = '#00ffff' as const;

/** Focus outline color as Three.js numeric hex — for Three.js material consumers. */
export const BIM_FOCUS_OUTLINE_COLOR_THREE = 0x00ffff;
