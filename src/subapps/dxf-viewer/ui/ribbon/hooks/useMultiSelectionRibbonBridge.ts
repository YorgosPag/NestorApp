'use client';

/**
 * ADR-363 Phase 7.1 Step 6.3 — Bridge για το Multi-Selection contextual tab.
 *
 * Pure read+write hook (όχι store με `useSyncExternalStore` — universalSelection
 * είναι React Context state, ήδη reactive). Καταναλώνεται μέσα στα ribbon panel
 * leaves (`MultiSelectionCommonPropertiesPanel`, `MultiSelectionFilterPanel`) —
 * δεν εγκαθίσταται στο `CanvasSection` orchestrator (ADR-040 Rule 1).
 *
 * Bridge mode rules:
 *   - 0 BIM-eligible entities → mode='none'
 *   - 1 BIM entity              → mode='single' (per-kind contextual tab παίρνει σκυτάλη)
 *   - 2+ BIM entities           → mode='multi'  (αυτό το tab ενεργοποιείται)
 *
 * `executeBulkPatch` δομεί CompoundCommand μέσω `buildBulkUpdateCommand` και το
 * dispatch-άρει στο `useCommandHistory` — single undo step.
 *
 * `narrowToKind` αντικαθιστά την επιλογή με entries του δεδομένου kind μόνο,
 * διατηρώντας το αρχικό `SelectableEntityType` (`'dxf-entity'` για BIM).
 *
 * @see bim-common-properties.ts SSoT registry
 * @see bim-bulk-update-builder.ts CompoundCommand factory
 */

import { useCallback, useMemo } from 'react';
import { useCommandHistory } from '../../../core/commands';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';
import type { EntityType } from '../../../types/entities';
import type { SelectionEntry } from '../../../systems/selection/types';
import {
  COMMON_PROPERTIES_BY_KIND,
  SUPPORTED_BIM_KINDS,
  countByKind,
  getCommonProperties,
  isHomogeneous,
  type BimEditableProperty,
  type BimEditablePropertyKey,
} from '../../../bim/types/bim-common-properties';
import {
  buildBulkUpdateCommand,
  type BimBulkEditPatch,
} from '../../../bim/cascade/bim-bulk-update-builder';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getAll' | 'selectMultiple'
>;

export type MultiSelectionMode = 'none' | 'single' | 'multi';
export type MultiSelectionValue = number | 'mixed';

export interface BimSelectionEntry {
  readonly id: string;
  readonly kind: EntityType;
  /** Original SelectableEntityType — preserved for narrowToKind() re-emit. */
  readonly selectableType: SelectionEntry['type'];
}

export interface UseMultiSelectionRibbonBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface MultiSelectionRibbonBridge {
  readonly mode: MultiSelectionMode;
  /** BIM-only entries (slab-opening + 6 architectural kinds), filtered από selection. */
  readonly bimEntries: readonly BimSelectionEntry[];
  /** Count per BIM kind για Filter panel buttons. */
  readonly kindsCount: ReadonlyMap<EntityType, number>;
  /** Common editable properties για το CommonPropertiesPanel. */
  readonly commonProperties: readonly BimEditableProperty[];
  readonly isHomogeneous: boolean;
  /** Initial value per common property — αριθμός όταν όλες οι τιμές ίδιες, αλλιώς 'mixed'. */
  readonly currentValues: ReadonlyMap<BimEditablePropertyKey, MultiSelectionValue>;
  readonly executeBulkPatch: (patch: BimBulkEditPatch) => void;
  readonly narrowToKind: (kind: EntityType) => void;
}

const SUPPORTED_KINDS_SET = new Set<EntityType>(SUPPORTED_BIM_KINDS);

export function useMultiSelectionRibbonBridge(
  props: UseMultiSelectionRibbonBridgeProps,
): MultiSelectionRibbonBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();

  // ─── Resolve BIM entries from current selection + active level scene ───────
  const bimEntries = useMemo<readonly BimSelectionEntry[]>(() => {
    const lid = levelManager.currentLevelId;
    if (!lid) return [];
    const scene = levelManager.getLevelScene(lid);
    if (!scene) return [];
    const selectionEntries = universalSelection.getAll();
    const result: BimSelectionEntry[] = [];
    for (const entry of selectionEntries) {
      const ent = scene.entities.find((e) => e.id === entry.id);
      if (!ent) continue;
      const kind = ent.type as EntityType;
      if (!SUPPORTED_KINDS_SET.has(kind)) continue;
      result.push({ id: entry.id, kind, selectableType: entry.type });
    }
    return result;
  }, [levelManager, universalSelection]);

  // ─── Derived state ─────────────────────────────────────────────────────────
  const kinds = useMemo<readonly EntityType[]>(
    () => bimEntries.map((e) => e.kind),
    [bimEntries],
  );

  const kindsCount = useMemo(() => countByKind(kinds), [kinds]);

  const commonProperties = useMemo(() => {
    if (bimEntries.length === 0) return [];
    // Dedupe kinds for cheaper intersection (Set preserves insertion order).
    const uniqueKinds = Array.from(new Set(kinds));
    return getCommonProperties(uniqueKinds);
  }, [bimEntries, kinds]);

  const homogeneous = useMemo(() => isHomogeneous(kinds), [kinds]);

  const mode = useMemo<MultiSelectionMode>(() => {
    if (bimEntries.length === 0) return 'none';
    if (bimEntries.length === 1) return 'single';
    return 'multi';
  }, [bimEntries.length]);

  // ─── Initial value computation per common property ─────────────────────────
  const currentValues = useMemo(() => {
    const out = new Map<BimEditablePropertyKey, MultiSelectionValue>();
    if (bimEntries.length === 0 || commonProperties.length === 0) return out;
    const lid = levelManager.currentLevelId;
    if (!lid) return out;
    const scene = levelManager.getLevelScene(lid);
    if (!scene) return out;
    const entitiesById = new Map(scene.entities.map((e) => [e.id, e]));

    for (const prop of commonProperties) {
      let firstValue: number | null = null;
      let mixed = false;
      for (const entry of bimEntries) {
        const editableForKind = COMMON_PROPERTIES_BY_KIND[entry.kind];
        if (!editableForKind?.some((p) => p.key === prop.key)) continue;
        const ent = entitiesById.get(entry.id);
        const params = (ent as unknown as { params?: Record<string, unknown> })?.params;
        const raw = params?.[prop.key];
        if (typeof raw !== 'number') continue;
        if (firstValue === null) {
          firstValue = raw;
        } else if (raw !== firstValue) {
          mixed = true;
          break;
        }
      }
      out.set(prop.key, mixed ? 'mixed' : (firstValue ?? 'mixed'));
    }
    return out;
  }, [bimEntries, commonProperties, levelManager]);

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const executeBulkPatch = useCallback(
    (patch: BimBulkEditPatch): void => {
      if (bimEntries.length === 0) return;
      const lid = levelManager.currentLevelId;
      if (!lid) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        lid,
      );
      const ids = bimEntries.map((e) => e.id);
      const cmd = buildBulkUpdateCommand(ids, patch, sm);
      if (cmd.size() === 0) return;
      executeCommand(cmd);
    },
    [bimEntries, levelManager, executeCommand],
  );

  const narrowToKind = useCallback(
    (kind: EntityType): void => {
      const filtered = bimEntries.filter((e) => e.kind === kind);
      if (filtered.length === 0) return;
      universalSelection.selectMultiple(
        filtered.map((e) => ({ id: e.id, type: e.selectableType })),
      );
    },
    [bimEntries, universalSelection],
  );

  return {
    mode,
    bimEntries,
    kindsCount,
    commonProperties,
    isHomogeneous: homogeneous,
    currentValues,
    executeBulkPatch,
    narrowToKind,
  };
}
