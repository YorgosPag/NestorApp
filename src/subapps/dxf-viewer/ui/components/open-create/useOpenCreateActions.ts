'use client';

/**
 * useOpenCreateActions — η εκτέλεση πίσω από το παράθυρο «Άνοιγμα / Δημιουργία» (ADR-914).
 *
 * Τρεις πράξεις, καμία νέα διαδρομή αποθήκευσης:
 *  - **πρόχειρο** και **κάτοψη για…** → ο ένας provisioner (`provisionLevelForBinding`)· ο στόχος
 *    αποθήκευσης ανοίγει μόνος του από τον loader του ADR-913, από τη δέσμευση του επιπέδου·
 *  - **φόρτωση από την αποθήκη** → η ίδια πόρτα εισαγωγής με πριν (`commitImportedScene`).
 *
 * @module subapps/dxf-viewer/ui/components/open-create/useOpenCreateActions
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import type { WizardCompleteMeta } from '@/features/floorplan-import';
import { DxfFirestoreService } from '../../../services/dxf-firestore.service';
import { useLevels } from '../../../systems/levels';
import { commitImportedScene } from '../../../systems/levels/commit-imported-scene';
import { provisionLevelForBinding } from '../../../systems/levels/level-provision';
import type { OpenCreateAvailability } from './open-create-cards';
import { wizardMetaToBinding } from './wizard-meta-binding';

/** Το επίπεδο που μόλις γεννήθηκε — ό,τι χρειάζεται ο host για να ανοίξει τη μετονομασία. */
export interface CreatedLevelRef {
  readonly id: string;
  readonly name: string;
}

interface UseOpenCreateActionsParams {
  /** `true` όταν ο host μπορεί να παραλάβει εισαγόμενη σκηνή (`onSceneImported`). */
  readonly canImportFloorplan: boolean;
  /** Καλείται μόλις γεννηθεί πρόχειρο — ο host ανοίγει άμεση μετονομασία. */
  readonly onDraftCreated?: (level: CreatedLevelRef) => void;
}

export interface OpenCreateActions {
  readonly availability: OpenCreateAvailability;
  readonly createDraft: () => Promise<void>;
  /** Πετά όταν η κάτοψη δεν δημιουργήθηκε — ο οδηγός το δείχνει και μένει ανοιχτός. */
  readonly createForSelection: (meta: WizardCompleteMeta) => Promise<void>;
  /** Πετά όταν το αρχείο δεν διαβάζεται — ο οδηγός το σημαδεύει ως κατεστραμμένο. */
  readonly loadFromStorage: (fileId: string) => Promise<void>;
}

export function useOpenCreateActions({
  canImportFloorplan,
  onDraftCreated,
}: UseOpenCreateActionsParams): OpenCreateActions {
  const { t } = useTranslation('dxf-viewer-panels');
  const {
    levels,
    currentLevelId,
    addLevel,
    setCurrentLevel,
    getLevelScene,
    setLevelScene,
    linkSceneToLevel,
  } = useLevels();

  const currentLevel = useMemo(
    () => (currentLevelId ? levels.find((l) => l.id === currentLevelId) : undefined),
    [levels, currentLevelId],
  );

  const availability = useMemo<OpenCreateAvailability>(
    () => ({
      hasOpenLevel: !!currentLevelId,
      openLevelIsBound: !!(currentLevel?.floorId || currentLevel?.buildingId || currentLevel?.projectId),
      canImportFloorplan,
    }),
    [currentLevelId, currentLevel, canImportFloorplan],
  );

  const createDraft = useCallback(async () => {
    const { levelId, name } = await provisionLevelForBinding(
      { levels, addLevel },
      { kind: 'draft', label: t('panels.openCreate.draftName') },
    );
    if (!levelId || !name) return;
    setCurrentLevel(levelId);
    onDraftCreated?.({ id: levelId, name });
  }, [levels, addLevel, setCurrentLevel, onDraftCreated, t]);

  const createForSelection = useCallback(
    async (meta: WizardCompleteMeta) => {
      const binding = wizardMetaToBinding(meta, t('panels.openCreate.fallbackLabel'));
      if (!binding) throw new Error('open-create: selection has no provisionable owner');
      const { levelId } = await provisionLevelForBinding({ levels, addLevel }, binding);
      if (!levelId) throw new Error('open-create: level was not created');
      setCurrentLevel(levelId);
    },
    [levels, addLevel, setCurrentLevel, t],
  );

  const loadFromStorage = useCallback(
    async (fileId: string) => {
      if (!currentLevelId) return;
      const record = await DxfFirestoreService.loadFromStorage(fileId);
      if (!record?.scene) throw new Error(t('panels.levels.storagePicker.error'));
      // 🛡️ ADR-635 Φ C.18 — route the load-wizard through the SSoT import door
      // (N.18, reuse) instead of a raw `setLevelScene`: the raw write was
      // session-only (no per-entity first-save → hatches vanished on reload, no
      // file-link → scene lost on hard refresh). `commitImportedScene` first-saves
      // the per-entity docs and links the file to the level.
      commitImportedScene(record.scene, {
        targetLevelId: currentLevelId,
        scope: {
          levelId: currentLevelId,
          floorId: currentLevel?.floorId ?? null,
          floorplanId: fileId,
        },
        getLevelScene,
        setLevelScene,
        linkSceneFileToLevel: () => {
          void linkSceneToLevel(currentLevelId, fileId, record.fileName ?? fileId);
        },
      });
    },
    [currentLevelId, currentLevel, getLevelScene, setLevelScene, linkSceneToLevel, t],
  );

  return { availability, createDraft, createForSelection, loadFromStorage };
}
