/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * @module global-snap-engine
 * @description Module-level SnapEngine singleton (SSoT, GOL).
 *
 * RATIONALE:
 *   Prior architecture instantiated `new ProSnapEngineV2()` inside every
 *   `useSnapManager()` call — 3 active instances (drawing, overlay, cursor)
 *   each ran `initialize(allEntities)` (O(N) over 17 sub-engines) on every
 *   scene change. For a 3263-entity DXF that meant ~1500–4000ms of CPU per
 *   line completion (verified via PERF_LINE profiler, 2026-05-11).
 *
 * SOLUTION:
 *   One singleton. All consumers read from it. Scene initialize runs ONCE
 *   per genuine scene change, owned by `useGlobalSnapSceneSync()` invoked
 *   from CanvasSection (single lifecycle owner — ADR-040 micro-leaf rule).
 *
 * @since 2026-05-11
 */

import { ProSnapEngineV2 } from './ProSnapEngineV2';

let _instance: ProSnapEngineV2 | null = null;
let _lastEntityFingerprint = '';
let _snapSceneEpoch = 0;

export function getGlobalSnapEngine(): ProSnapEngineV2 {
  if (!_instance) {
    _instance = new ProSnapEngineV2();
  }
  return _instance;
}

/**
 * ADR-040 — snap-scene invalidation counter (Giorgio 2026-06-16).
 *
 * The fingerprint guard in `useGlobalSnapSceneSync` skips `initialize()` when the
 * cheap O(1) sample (length + first/last ids) is unchanged. That sample is BLIND
 * to in-place GEOMETRY edits — moving/resizing/rotating an entity keeps the same
 * count/ids, so the snap index froze at the OLD position after the first move
 * (no snap/label on the 2nd grip-move until a hard refresh). This monotonic epoch
 * is bumped on every CommandHistory change (execute/undo/redo → covers grip
 * move/resize/rotate, panel edits, undo/redo) and folded into the fingerprint, so
 * a genuine mutation forces exactly one re-`initialize()`. Benign re-renders
 * (Firestore echo, React rebuild) are NOT commands → epoch unchanged → the
 * fingerprint optimization is preserved (zero idle cost).
 */
export function invalidateSnapScene(): void {
  _snapSceneEpoch++;
}

/** Current snap-scene epoch — folded into the scene-sync fingerprint. */
export function getSnapSceneEpoch(): number {
  return _snapSceneEpoch;
}

/**
 * Shared fingerprint state for the singleton. Lives next to the instance so
 * the scene-sync hook (sole writer) can guard against redundant initialize().
 */
export function getLastSnapEntityFingerprint(): string {
  return _lastEntityFingerprint;
}

export function setLastSnapEntityFingerprint(fingerprint: string): void {
  _lastEntityFingerprint = fingerprint;
}

/**
 * Test-only reset. Do NOT call from product code.
 */
export function __resetGlobalSnapEngineForTests(): void {
  if (_instance) {
    _instance.dispose();
    _instance = null;
  }
  _lastEntityFingerprint = '';
  _snapSceneEpoch = 0;
}
