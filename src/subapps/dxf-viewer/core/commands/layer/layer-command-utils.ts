/**
 * Layer-command shared helpers (ADR-358 §5.6.bis — Phase 10).
 *
 * Centralises the snapshot-capture and snapshot-restore logic shared across
 * the 9 layer commands. Commands stay thin — orchestrate via these utilities
 * + IsolateEffectsStore + LayerStore mutations.
 *
 * Pre-commit ratchet `layer-isolate-system` allowlists `core/commands/layer/**`
 * for direct `unisolateSnapshot` reads/writes — all other call sites are
 * forbidden.
 */

import {
  getAllLayers,
  getLayer,
  upsertLayer,
  setUnisolateSnapshot,
  clearUnisolateSnapshot,
  getUnisolateSnapshot
} from '../../../stores/LayerStore';
import type {
  UnisolateSnapshot,
  UnisolateSnapshotEntry
} from '../../../stores/LayerStore';
import type { SceneLayer } from '../../../types/entities';

export type { UnisolateSnapshot, UnisolateSnapshotEntry };

let layerCommandCounter = 0;
const COMMAND_TIME_BASE = Date.now();

/** Stable key for CommandHistory — `lyr-cmd-<n>` (in-memory only, not a Firestore ID). */
export function makeLayerCommandKey(prefix: string): string {
  layerCommandCounter += 1;
  return `${prefix}-${COMMAND_TIME_BASE}-${layerCommandCounter}`;
}

/** Snapshot ALL current layers into the unisolate-restore shape. */
export function captureAllLayersSnapshot(): ReadonlyArray<UnisolateSnapshotEntry> {
  return getAllLayers().map((layer) => ({
    layerId: layer.id ?? layer.name,
    visible: layer.visible,
    frozen: layer.frozen ?? false,
    locked: layer.locked,
    transparency: layer.transparency ?? 0
  }));
}

/** Snapshot a single layer (Off/Freeze/Lock pre-state). Returns null if missing. */
export function captureLayerSnapshot(layerId: string): UnisolateSnapshotEntry | null {
  const layer = getLayer(layerId);
  if (!layer) return null;
  return {
    layerId: layer.id ?? layer.name,
    visible: layer.visible,
    frozen: layer.frozen ?? false,
    locked: layer.locked,
    transparency: layer.transparency ?? 0
  };
}

/** Restore a single layer to its snapshot state. No-op if layer no longer exists. */
export function restoreLayerEntry(entry: UnisolateSnapshotEntry): void {
  const layer = getLayer(entry.layerId);
  if (!layer) return;
  upsertLayer({
    ...layer,
    visible: entry.visible,
    frozen: entry.frozen,
    locked: entry.locked,
    transparency: entry.transparency
  });
}

/** Restore every entry of a snapshot to LayerStore. Safe on partial deletion. */
export function restoreLayersSnapshot(snapshot: ReadonlyArray<UnisolateSnapshotEntry>): void {
  for (const entry of snapshot) {
    restoreLayerEntry(entry);
  }
}

/** Save an isolate snapshot to LayerStore (single-level, overwrites previous). */
export function persistUnisolateSnapshot(snapshot: ReadonlyArray<UnisolateSnapshotEntry>): void {
  setUnisolateSnapshot(snapshot);
}

/** Current isolate snapshot. Null when no isolate session is active. */
export function readUnisolateSnapshot(): UnisolateSnapshot {
  return getUnisolateSnapshot();
}

/** Drop the in-store isolate snapshot. */
export function dropUnisolateSnapshot(): void {
  clearUnisolateSnapshot();
}

/**
 * Apply `frozen: true` to every layer NOT in `keepIds`. Used by freeze-mode
 * isolate to enable the AutoCAD render skip-path.
 */
export function freezeNonIsolatedLayers(layers: ReadonlyArray<SceneLayer>, keepIds: ReadonlySet<string>): void {
  for (const layer of layers) {
    const key = layer.id ?? layer.name;
    if (keepIds.has(key)) continue;
    if (layer.frozen) continue;
    upsertLayer({ ...layer, frozen: true });
  }
}

/** Mutate every layer flag matching the predicate. Used by ThawAll / OnAll. */
export function mutateAllLayersFlag(
  flag: 'frozen' | 'visible',
  targetValue: boolean
): ReadonlyArray<UnisolateSnapshotEntry> {
  const captured: UnisolateSnapshotEntry[] = [];
  for (const layer of getAllLayers()) {
    const current = flag === 'frozen' ? (layer.frozen ?? false) : layer.visible;
    if (current === targetValue) continue;
    captured.push({
      layerId: layer.id ?? layer.name,
      visible: layer.visible,
      frozen: layer.frozen ?? false,
      locked: layer.locked,
      transparency: layer.transparency ?? 0
    });
    upsertLayer({ ...layer, [flag]: targetValue });
  }
  return captured;
}
