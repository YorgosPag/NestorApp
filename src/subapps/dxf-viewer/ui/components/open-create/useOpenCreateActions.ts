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
import { provisionLevelForBinding, type LevelProvisioner } from '../../../systems/levels/level-provision';
import { levelFromServerDocument } from '../../../systems/levels/utils';
import { listDxfLevelsWithPolicy } from '@/services/dxf-level-mutation-gateway';
import type { Level } from '../../../systems/levels/config';
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
}

export interface OpenCreateActions {
  readonly availability: OpenCreateAvailability;
  /** Το πρόχειρο που γεννήθηκε και άνοιξε· `null` όταν δεν γεννήθηκε (το σφάλμα έχει ήδη αναφερθεί). */
  readonly createDraft: () => Promise<CreatedLevelRef | null>;
  /** Πετά όταν η κάτοψη δεν δημιουργήθηκε — ο οδηγός το δείχνει και μένει ανοιχτός. */
  readonly createForSelection: (meta: WizardCompleteMeta) => Promise<void>;
  /** Πετά όταν το αρχείο δεν διαβάζεται — ο οδηγός το σημαδεύει ως κατεστραμμένο. */
  readonly loadFromStorage: (fileId: string) => Promise<void>;
}

/** Τα επίπεδα της εμβέλειας όπως τα ξέρει ο διακομιστής (ADR-914 §2.11). */
async function loadServerScopeLevels(buildingId: string | null): Promise<Level[]> {
  return (await listDxfLevelsWithPolicy(buildingId)).map(levelFromServerDocument);
}

export function useOpenCreateActions({
  canImportFloorplan,
}: UseOpenCreateActionsParams): OpenCreateActions {
  const { t } = useTranslation('dxf-viewer-panels');
  const {
    levels,
    currentLevelId,
    addLevel,
    adoptLevel,
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

  // Από εδώ γεννιούνται επίπεδα ΕΞΩ από το κτήριο της συνεδρίας (πρόχειρο, έργο, άλλο κτήριο):
  // ο provisioner ρωτά τον διακομιστή για την εμβέλεια της δέσμευσης, όχι τη στενεμένη λίστα.
  const provisioner = useMemo<LevelProvisioner>(
    () => ({ levels, addLevel, adoptLevel, loadScopeLevels: loadServerScopeLevels }),
    [levels, addLevel, adoptLevel],
  );

  const createDraft = useCallback(async () => {
    const { levelId, name } = await provisionLevelForBinding(
      provisioner,
      { kind: 'draft', label: t('panels.openCreate.draftName') },
    );
    if (!levelId || !name) return null;
    setCurrentLevel(levelId);
    return { id: levelId, name };
  }, [provisioner, setCurrentLevel, t]);

  const createForSelection = useCallback(
    async (meta: WizardCompleteMeta) => {
      const binding = wizardMetaToBinding(meta, t('panels.openCreate.fallbackLabel'));
      if (!binding) throw new Error('open-create: selection has no provisionable owner');
      const { levelId } = await provisionLevelForBinding(provisioner, binding);
      if (!levelId) throw new Error('open-create: level was not created');
      setCurrentLevel(levelId);
    },
    [provisioner, setCurrentLevel, t],
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
