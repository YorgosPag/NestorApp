/**
 * SSOT — ghost-preview POLICY shared by the 2D canvas AND the 3D WebGL viewport.
 *
 * The 2D move/grip/transform ghosts (`GHOST_DEFAULTS.alpha`, Canvas2D) and the 3D
 * translucent overlays (`PlacementGhostOverlay`, `EditOriginalGhost`, WebGL) draw on
 * completely separate render backends — Canvas2D vs three.js — so they cannot share
 * render CODE. They CAN, and now DO, share the one piece of cross-backend truth that
 * defines the "ghost look": the opacity at which an original dims while its real
 * moving copy is shown elsewhere. Revit / Maxon Cinema 4D keep separate render
 * backends but a single ghost UX policy — this constant is that policy.
 *
 * Keep this file dependency-free (a bare constant) so BOTH the 2D `rendering/ghost`
 * barrel and the 3D `bim-3d/` overlays can import it with zero coupling.
 */

/** Ghost opacity: an original dims to this alpha while its real moving copy is shown. */
export const GHOST_ALPHA = 0.45;
