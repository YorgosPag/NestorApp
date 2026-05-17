/**
 * LayerState — type SSoT (ADR-358 §5.9 Q12, Phase 12).
 *
 * A user-saved snapshot of every layer's display state at a moment in time.
 * Restored atomically via `RestoreLayerStateCommand` (undo-able). Phase 12
 * scope: Save/Restore + persistence. `.las` I/O + cross-project templates
 * deferred to Phase 13.
 *
 * Persistence (Phase 12): localStorage per-project (`dxf:layerStates:{projectId}`),
 * Firestore-shaped pub/sub API (`services/layer-state-persistence.ts`) so the
 * future Firestore swap to `projects/{projectId}/dxfSettings.layerStates` is
 * a one-file change. See ADR-358 §5.9 + §10 v2.16-pre0 changelog.
 *
 * Pre-commit ratchet `layer-state-system` forbids construction outside the
 * factory + writes outside the persistence layer.
 */

import { generateLayerStateId } from '@/services/enterprise-id-convenience';
import { nowISO } from '@/lib/date-local';
import type { LineweightMm } from './entities';

/**
 * Provenance of a saved state. Phase 12 emits only `user-created`. Phase 13
 * adds `las-import` and `template-shared`; the union is declared now so the
 * persistence + UI surface stays stable across phases.
 */
export type LayerStateSource = 'user-created' | 'las-import' | 'template-shared';

/**
 * Frozen per-layer snapshot. Color carries both ACI and TrueColor for a
 * lossless round-trip — restore prefers TrueColor when defined.
 */
export interface LayerStateEntry {
  /** Stable layer id at snapshot time. Primary match key on restore. */
  readonly layerId: string;
  /** Snapshotted name. Secondary match (case-insensitive) for cross-project `.las` restore. */
  readonly layerName: string;
  readonly visible: boolean;
  readonly frozen: boolean;
  readonly locked: boolean;
  readonly color: string;
  readonly colorAci?: number;
  readonly colorTrueColor?: number | null;
  readonly linetype: string;
  readonly lineweight: LineweightMm;
  readonly transparency: number;
  readonly plottable: boolean;
}

export interface LayerState {
  /** `lst_<UUID-v4>` from enterprise-id.service. */
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  /** Always FULL snapshot — Phase 12 has no partial state semantics. */
  readonly snapshot: ReadonlyArray<LayerStateEntry>;
  readonly source: LayerStateSource;
  /** Template origin id when `source === 'template-shared'`. Reserved for Phase 13. */
  readonly sourceTemplateId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdByUserId: string;
}

/**
 * Pure factory — keep the entry shape pinned to the SceneLayer fields the
 * restore command must reproduce. Construction sites outside this file are
 * blocked by ratchet `layer-state-system`.
 */
export function createLayerStateEntry(input: {
  layerId: string;
  layerName: string;
  visible: boolean;
  frozen?: boolean;
  locked: boolean;
  color: string;
  colorAci?: number;
  colorTrueColor?: number | null;
  linetype?: string;
  lineweight?: LineweightMm;
  transparency?: number;
  plottable?: boolean;
}): LayerStateEntry {
  return {
    layerId: input.layerId,
    layerName: input.layerName,
    visible: input.visible,
    frozen: input.frozen ?? false,
    locked: input.locked,
    color: input.color,
    colorAci: input.colorAci,
    colorTrueColor: input.colorTrueColor ?? null,
    linetype: input.linetype ?? 'Continuous',
    lineweight: input.lineweight ?? -3,
    transparency: input.transparency ?? 0,
    plottable: input.plottable ?? true,
  };
}

/**
 * SSoT factory for `LayerState`. Boundary I/O sites (UI save, persistence
 * hydrate, future `.las` import) MUST go through here so `id`/`createdAt`/
 * `updatedAt` are always populated and `source` is validated.
 */
export function createLayerState(input: {
  name: string;
  snapshot: ReadonlyArray<LayerStateEntry>;
  createdByUserId: string;
  id?: string;
  description?: string;
  icon?: string;
  source?: LayerStateSource;
  sourceTemplateId?: string;
  createdAt?: string;
  updatedAt?: string;
}): LayerState {
  const now = nowISO();
  return {
    id: input.id ?? generateLayerStateId(),
    name: input.name,
    description: input.description,
    icon: input.icon,
    snapshot: Object.freeze(input.snapshot.slice()) as ReadonlyArray<LayerStateEntry>,
    source: input.source ?? 'user-created',
    sourceTemplateId: input.sourceTemplateId,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    createdByUserId: input.createdByUserId,
  };
}

