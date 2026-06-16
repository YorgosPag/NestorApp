/**
 * =============================================================================
 * 🏢 ENTERPRISE: Entity Clipboard Store (ADR-466)
 * =============================================================================
 *
 * In-memory SSoT for the Revit/AutoCAD-style entity clipboard (COPYCLIP /
 * PASTECLIP). Holds FROZEN deep-copy snapshots of the entities selected at
 * Ctrl+C time, so paste survives a floor switch (the source entities are no
 * longer in the active scene by the time the user pastes on another floor).
 *
 * Zero React, zero IO — a module singleton, mirroring the other high-frequency
 * stores (HoverStore / ImmediatePositionStore). Paste reads the snapshots and
 * clones them with fresh IDs via the clone SSoT.
 *
 * @module systems/clipboard/EntityClipboardStore
 * @enterprise ADR-466 - Cross-Floor Entity Clipboard
 */

import type { SceneEntity } from '../../core/commands/interfaces';

interface ClipboardPayload {
  /** Frozen deep copies — immune to later edits / floor switches of the source. */
  readonly entities: readonly SceneEntity[];
  /** Floor the entities were copied from (for telemetry / future cross-checks). */
  readonly sourceFloorId: string | null;
  /** Epoch ms of the copy (for debugging / stale-clipboard heuristics). */
  readonly copiedAt: number;
}

function deepCloneEntity(entity: SceneEntity): SceneEntity {
  // structuredClone preserves nested params/geometry faithfully (all browsers).
  // JSON round-trip fallback covers non-DOM test runners where the global is
  // absent — scene entities are plain JSON-serializable data, so it is lossless
  // for our purposes.
  if (typeof structuredClone === 'function') return structuredClone(entity);
  return JSON.parse(JSON.stringify(entity)) as SceneEntity;
}

let payload: ClipboardPayload | null = null;

export const EntityClipboardStore = {
  /** Replace the clipboard with frozen snapshots of `entities`. Empty = no-op clear. */
  copy(entities: readonly SceneEntity[], sourceFloorId: string | null): void {
    if (entities.length === 0) {
      payload = null;
      return;
    }
    payload = {
      entities: entities.map(deepCloneEntity),
      sourceFloorId,
      copiedAt: Date.now(),
    };
  },

  /** Fresh deep copies of the clipboard entities (safe to mutate downstream). */
  read(): SceneEntity[] {
    return payload ? payload.entities.map(deepCloneEntity) : [];
  },

  /** True when there is at least one entity available to paste. */
  hasContent(): boolean {
    return payload !== null && payload.entities.length > 0;
  },

  /** Floor the current clipboard payload was copied from (null if empty). */
  sourceFloorId(): string | null {
    return payload?.sourceFloorId ?? null;
  },

  /** Empty the clipboard. */
  clear(): void {
    payload = null;
  },
};
