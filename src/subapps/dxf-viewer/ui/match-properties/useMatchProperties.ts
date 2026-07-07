'use client';

/**
 * ADR-581 — «Αντιγραφή Ιδιοτήτων» dialog controller hook.
 *
 * Δένει το UI με τον deterministic πυρήνα: διαβάζει source (primary) + targets από
 * την επιλογή, χτίζει checklist (habit default) + preview, και στο Apply:
 *   execute(CompoundCommand)  →  emit ανά BIM target  →  recordApply (habit)  →  close.
 *
 * Το snapshot της επιλογής παγώνει στο mount (modal): ο host mount-άρει το dialog
 * μόνο όταν ανοίγει, άρα το hook τρέχει με σταθερή πηγή/στόχους.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntityType } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  getDefaultChecklist,
  type SemanticRole,
  type MatchCategory,
} from '../../systems/match-properties';
import { applyMatchTransfer } from '../../hooks/canvas/apply-match-transfer';
import {
  buildOfferedGroups,
  buildPreviews,
  type MatchGroup,
  type MatchTargetPreview,
} from './match-dialog-model';

export interface UseMatchPropertiesArgs {
  readonly levelManager: LevelsHookReturn;
  readonly onClose: () => void;
}

export interface UseMatchPropertiesResult {
  readonly ready: boolean;
  readonly sourceType: EntityType | null;
  readonly targetCount: number;
  readonly isCrossType: boolean;
  readonly groups: readonly MatchGroup[];
  readonly previews: readonly MatchTargetPreview[];
  readonly selectedRoles: ReadonlySet<SemanticRole>;
  readonly toggleRole: (role: SemanticRole) => void;
  readonly setCategoryRoles: (roles: readonly SemanticRole[], on: boolean) => void;
  readonly apply: () => void;
  readonly cancel: () => void;
}

export function useMatchProperties(args: UseMatchPropertiesArgs): UseMatchPropertiesResult {
  const { levelManager, onClose } = args;
  const levelId = levelManager.currentLevelId ?? '';

  const sceneManager = useMemo(
    () => createLevelSceneManagerAdapter(levelManager.getLevelScene, levelManager.setLevelScene, levelId),
    [levelManager.getLevelScene, levelManager.setLevelScene, levelId],
  );

  // Πάγωμα επιλογής στο mount (modal → η επιλογή δεν αλλάζει όσο είναι ανοιχτό).
  const [selection] = useState(() => {
    const primaryId = SelectedEntitiesStore.getPrimaryId();
    const targetIds = SelectedEntitiesStore.getSelectedEntityIds().filter((id) => id !== primaryId);
    return { primaryId, targetIds };
  });

  const model = useMemo(() => {
    const source = selection.primaryId ? sceneManager.getEntity(selection.primaryId) : null;
    const targetsByType = new Map<EntityType, SceneEntity[]>();
    for (const id of selection.targetIds) {
      const entity = sceneManager.getEntity(id);
      if (!entity) continue;
      const type = entity.type as EntityType;
      const bucket = targetsByType.get(type) ?? [];
      bucket.push(entity);
      targetsByType.set(type, bucket);
    }
    const targetTypes = [...targetsByType.keys()];
    const sourceType = source ? (source.type as EntityType) : null;
    const offered = sourceType ? buildOfferedGroups(sourceType, targetTypes) : null;
    const targetCount = selection.targetIds.length;
    return { source, sourceType, targetsByType, targetTypes, offered, targetCount };
  }, [sceneManager, selection]);

  const [selectedRoles, setSelectedRoles] = useState<ReadonlySet<SemanticRole>>(() => new Set());
  const initedRef = useRef(false);
  useEffect(() => {
    if (initedRef.current || !model.offered || !model.sourceType) return;
    initedRef.current = true;
    const firstTarget = model.targetTypes[0] ?? model.sourceType;
    setSelectedRoles(getDefaultChecklist(model.sourceType, firstTarget, model.offered.offeredRoles));
  }, [model]);

  const toggleRole = useCallback((role: SemanticRole) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }, []);

  const setCategoryRoles = useCallback((roles: readonly SemanticRole[], on: boolean) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      for (const role of roles) {
        if (on) next.add(role);
        else next.delete(role);
      }
      return next;
    });
  }, []);

  const previews = useMemo(
    () => (model.source && model.sourceType
      ? buildPreviews(model.source, model.sourceType, model.targetsByType, selectedRoles)
      : []),
    [model, selectedRoles],
  );

  const apply = useCallback(() => {
    if (!selection.primaryId || !model.sourceType) return;
    // Κοινός writer SSoT (execute → emit → habit) — ο ίδιος που τρέχει και η σύριγγα.
    applyMatchTransfer({
      levelManager,
      sourceId: selection.primaryId,
      targetIds: selection.targetIds,
      selectedRoles,
    });
    onClose();
  }, [selection, model.sourceType, selectedRoles, levelManager, onClose]);

  return {
    ready: !!model.source && model.targetCount > 0 && levelId !== '',
    sourceType: model.sourceType,
    targetCount: model.targetCount,
    isCrossType: model.offered?.isCrossType ?? false,
    groups: model.offered?.groups ?? [],
    previews,
    selectedRoles,
    toggleRole,
    setCategoryRoles,
    apply,
    cancel: onClose,
  };
}

export type { MatchCategory };
