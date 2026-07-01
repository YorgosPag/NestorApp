'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * SnapSceneSyncLeaf — sole mount point of the SnapEngine scene-initialize
 * lifecycle (ADR-547 regression fix, 2026-07-01).
 *
 * WHY a leaf (root cause it fixes):
 * `useGlobalSnapSceneSync` re-initialises the snap engine ONLY when its `scene`
 * argument changes. It used to live in the `CanvasSection` orchestrator, fed by
 * the `currentScene` PROP. ADR-547 then moved live-scene rendering to a
 * store-subscribed leaf (`DxfCanvasSubscriber` → `useLevelScene`), so the
 * orchestrator NO LONGER re-renders when an entity is committed — a wall added via
 * `addWallToScene` writes to `SceneStore`, not React state. The prop went stale →
 * the snap engine never indexed in-session entities: a freshly drawn wall did not
 * snap (no face slide, no cyan OSNAP markers) until a hard reload re-seeded
 * `currentScene` from persistence. In-place grip edits (rotate/move) broke the
 * same way — the CommandHistory epoch bump inside the hook still waited on a scene
 * ref change that never arrived.
 *
 * Fix (mirror the render leaf): subscribe to the SAME live scene SSoT
 * (`useLevelScene`) + overlays here, so a committed entity re-inits the snap engine
 * on the next idle tick — for exactly the scene the canvas paints. `?? fallbackScene`
 * mirrors `DxfCanvasSubscriber`'s `liveScene ?? scene`, keeping snapping correct
 * before `SceneStore` hydrates on first load. Renders null; the orchestrator stays
 * inert (ADR-040 — no scene subscription in CanvasSection.tsx, CHECK 6C).
 *
 * Sole owner: mounted exactly once by `CanvasSection` (replaces its direct hook call).
 */

import { useGlobalSnapSceneSync } from '../../snapping/hooks/useGlobalSnapSceneSync';
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import { useLiveOverlaysForLevel } from '../../hooks/useLiveOverlaysForLevel';
import type { SceneModel } from '../../types/scene';

interface SnapSceneSyncLeafProps {
  /** Active level id — the scene/overlay slice this leaf subscribes to reactively. */
  levelId: string | null;
  /** First-paint fallback before `SceneStore` hydrates (mirror of the render leaf). */
  fallbackScene: SceneModel | null;
}

/**
 * Drives `useGlobalSnapSceneSync` off the live `SceneStore` + overlay SSoT so the
 * snap engine re-initialises on every in-session commit. Renders nothing.
 */
export function SnapSceneSyncLeaf({ levelId, fallbackScene }: SnapSceneSyncLeafProps): null {
  const liveScene = useLevelScene(levelId);
  const overlays = useLiveOverlaysForLevel(levelId);
  useGlobalSnapSceneSync({ scene: liveScene ?? fallbackScene, overlays });
  return null;
}
