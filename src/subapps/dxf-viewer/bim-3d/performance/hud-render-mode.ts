/**
 * hud-render-mode — ADR-366 §B.5.U (unified 2D + 3D Performance HUD)
 *
 * Canonical render-mode for the unified Performance HUD. This is a semantic
 * ALIAS of `ViewMode3D` (the SSoT of the viewport-mode union, owned by
 * ViewMode3DStore) — NOT a second copy of the union. The import is type-only,
 * so it is erased at compile time: zero runtime coupling, no store→performance
 * cycle, and adding a new viewport mode changes ONE place (ViewMode3DStore).
 *
 * The mode bridge (`usePerformanceModeBridge`) keeps the HUD store's renderMode
 * in sync with `ViewMode3DStore.mode`. In '2d' the WebGL-only metrics are
 * reported as null by the 2D collector.
 */

import type { ViewMode3D } from '../stores/ViewMode3DStore';

export type HudRenderMode = ViewMode3D;
