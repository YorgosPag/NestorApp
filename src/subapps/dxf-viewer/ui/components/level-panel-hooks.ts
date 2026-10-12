'use client';

/**
 * LevelPanel hooks — extracted to keep `LevelPanel.tsx` under the 500-line
 * Google file-size limit (N.7.1). Pure state/effect logic, zero JSX.
 *
 * @module ui/components/level-panel-hooks
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { ENTITY_TYPES, type EntityType } from '@/config/domain-constants';
import type { Level, FloorplanType } from '../../systems/levels/config';
import type { LevelContextUpdate } from '../../systems/levels/hooks/useLevelOperations';
import type { LevelFloorResolver } from '../../systems/levels/level-floor-resolution';
import { findOrCreateLevelForFloor } from '../../systems/levels/level-floor-resolution';
// 🛡️ ADR-845 Ο-18/Ο-19 — η ΑΔΙΑΙΡΕΤΗ εμβέλεια: όροφος και κτήριο ταξιδεύουν μαζί ή
// καθόλου. Ο ίδιος pure τύπος που ρωτά ο φρουρός.
import { resolveLevelScopeAssignment, levelScopeFields } from '../../systems/levels/level-building-scope';
import { ensureLevelsForBuilding, resolveAllFloorsBackfillBuilding } from '../../systems/levels/ensure-levels-for-building';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { FileRecordService } from '@/services/file-record.service';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';
import { buildDxfImportSaveContext } from '../../app/dxf-import-save-context';
import type { WizardCompleteMeta } from '@/features/floorplan-import';
import i18next from 'i18next';
import { provisionLevelForBinding } from '../../systems/levels/level-provision';
import { wizardMetaToBinding } from './open-create/wizard-meta-binding';

/** Όνομα κάτοψης ακινήτου όταν ο οδηγός δεν έδωσε ετικέτα — κλειδί, όχι κείμενο (N.11). */
const PROPERTY_PLAN_FALLBACK_KEY = 'dxf-viewer-panels:panels.openCreate.fallbackLabel';

/** Fire-and-forget trigger: pass the building id to backfill all its storeys. */
export type TriggerAllFloorsBackfill = (buildingId: string) => void;

/**
 * ADR-448 Phase 3 — «Φόρτωσε ΟΛΟΥΣ τους ορόφους».
 *
 * Decouples the all-floors Level backfill from the wizard's synchronous
 * selected-floor switch. The caller fires the returned trigger from the wizard
 * `onComplete`; the hook then loads the building's full storey list off the
 * shared FLOORS subscription and opens one Level per floor via the idempotent
 * `ensureLevelsForBuilding` loop. Decoupling avoids racing the active-level
 * switch (the selected floor is already linked → skipped).
 *
 * @see systems/levels/ensure-levels-for-building.ts
 */
export function useAllFloorsBackfill(resolver: LevelFloorResolver): TriggerAllFloorsBackfill {
  const { levels, addLevel } = resolver;
  const [allFloorsBuildingId, setAllFloorsBuildingId] = useState<string | null>(null);
  const { floors: buildingFloors, loading: buildingFloorsLoading } = useFloorsByBuilding(allFloorsBuildingId);
  const allFloorsRunningRef = useRef(false);

  useEffect(() => {
    if (!allFloorsBuildingId || buildingFloorsLoading || buildingFloors.length === 0) return;
    if (allFloorsRunningRef.current) return;
    allFloorsRunningRef.current = true;
    const targetBuildingId = allFloorsBuildingId;
    void (async () => {
      try {
        await ensureLevelsForBuilding(
          { levels, addLevel },
          buildingFloors.map((f) => ({ id: f.id, number: f.number, label: f.longName ?? f.name })),
          targetBuildingId,
        );
      } finally {
        allFloorsRunningRef.current = false;
        setAllFloorsBuildingId(null);
      }
    })();
  }, [allFloorsBuildingId, buildingFloors, buildingFloorsLoading, levels, addLevel]);

  return useCallback((buildingId: string) => setAllFloorsBuildingId(buildingId), []);
}

/** Scene-import callback shape (matches `LevelPanelProps.onSceneImported`). */
export type OnSceneImported = (
  file: File,
  encoding?: string,
  saveContext?: DxfSaveContext,
  targetLevelId?: string,
) => void;

/** Subset of `useLevels` context writers needed by the import-complete flow. */
export interface FloorplanImportCompleteDeps {
  readonly resolver: LevelFloorResolver;
  readonly currentLevelId: string | null;
  readonly setCurrentLevel: (levelId: string) => void;
  readonly updateLevelContext: (
    levelId: string,
    context: LevelContextUpdate,
  ) => Promise<void> | void;
  readonly entityTypeToFloorplanType: (entityType: EntityType) => FloorplanType | undefined;
  readonly triggerAllFloorsBackfill: TriggerAllFloorsBackfill;
  readonly onSceneImported?: OnSceneImported;
}

/**
 * ADR-420/465 — SSoT import-complete handler. Returns the SAME callback the
 * Floorplan Import Wizard fires AND the cross-floor duplicate dialog reuses, so
 * scene rendering + level wiring live in ONE place (no copy-paste, N.0.2). The
 * duplicate dialog hands the SAME `WizardCompleteMeta` shape after re-feeding the
 * source DXF through `uploadSmart`.
 */
export function useFloorplanImportComplete(deps: FloorplanImportCompleteDeps) {
  const {
    resolver, currentLevelId, setCurrentLevel, updateLevelContext,
    entityTypeToFloorplanType, triggerAllFloorsBackfill, onSceneImported,
  } = deps;
  const { levels, addLevel } = resolver;

  return useCallback(
    async (file: File, meta: WizardCompleteMeta) => {
      if (!onSceneImported) return;
      // ADR-716 Φ5 / N.18 — ΕΝΑΣ builder για το `DxfSaveContext` του wizard. Εδώ ζούσε ένα
      // sibling clone του `buildDxfImportSaveContext` που παρέλειπε το `userDrawingUnits`:
      // ο ίδιος wizard, δύο μονοπάτια, το ένα έχανε σιωπηλά τη ρητή επιλογή του μηχανικού.
      const saveContext: DxfSaveContext = buildDxfImportSaveContext(meta);
      // 🛡️ ADR-845 Ο-19 — Η ΕΜΒΕΛΕΙΑ ΚΡΙΝΕΤΑΙ **ΜΙΑ ΦΟΡΑ**, ΩΣ ΕΝΑ ΠΡΑΓΜΑ.
      // Πριν, ο όροφος και το κτήριο περνούσαν ως δύο ανεξάρτητα πεδία σε δύο κλήσεις,
      // και όταν ο πρώτος έλειπε (επιλογή **μονάδας**: `entityId = prop_*`) το δεύτερο
      // γραφόταν **μόνο του** — το επίπεδο αποκτούσε το ΝΕΟ κτήριο κρατώντας τον ΠΑΛΙΟ
      // όροφο. Ο τύπος `LevelScopeAssignment` κάνει αυτή τη γραφή αδύνατη.
      const scope = resolveLevelScopeAssignment({
        floorId: saveContext.floorId,
        // ADR-399: building comes from the selection (saveContext only carries
        // buildingId for 'building' imports, not for 'floor').
        buildingId: meta.buildingId ?? saveContext.buildingId,
      });
      const scopeFields = levelScopeFields(scope);
      // ADR-420 — resolve the Level that OWNS the selected floor (find-or-create
      // + switch), so the import targets that floor's own level rather than the
      // active level. Falls back to the active level for project/building imports.
      // ADR-914 §2.13 — κάτοψη ΑΚΙΝΗΤΟΥ = δική της όψη, όχι η κάτοψη του ορόφου (Revit: πολλές
      // όψεις κάτοψης ανά Level). Πριν, η εισαγωγή έγραφε ΠΑΝΩ στο επίπεδο του ορόφου και το
      // σημάδευε ως ακίνητο: ο όροφος έχανε την κάτοψή του και, από το ADR-914, έπαυε να μετρά ως
      // «επίπεδο ορόφου». Ο ίδιος provisioner με το «Κάτοψη για… ακίνητο»: find-or-create ανά
      // (ακίνητο, όροφος), όλη η δέσμευση στη γέννηση.
      const propertyBinding = meta.entityType === ENTITY_TYPES.PROPERTY
        ? wizardMetaToBinding(meta, i18next.t(PROPERTY_PLAN_FALLBACK_KEY) || PROPERTY_PLAN_FALLBACK_KEY)
        : null;
      const targetLevelId = propertyBinding
        ? (await provisionLevelForBinding({ levels, addLevel }, propertyBinding)).levelId
        : await findOrCreateLevelForFloor(
            { levels, addLevel },
            {
              floorId: scope.kind === 'storey' ? scope.floorId : undefined,
              buildingId: scopeFields.buildingId ?? undefined,
              entityLabel: meta.entityLabel,
              currentLevelId,
            },
          );
      if (targetLevelId) {
        setCurrentLevel(targetLevelId);
        const floorplanType = entityTypeToFloorplanType(meta.entityType);
        // Το επίπεδο ακινήτου γεννήθηκε ήδη δεμένο· δεύτερη εγγραφή θα ξανάγραφε τον όροφό του
        // με τον όροφο του βήματος 4 (για πολυεπίπεδη μονάδα: λάθος όροφος).
        if (floorplanType && !propertyBinding) {
          void updateLevelContext(targetLevelId, {
            floorplanType,
            entityLabel: meta.entityLabel,
            projectId: meta.projectId,
            // ADR-914 — το επίπεδο μαθαίνει το ακίνητό του· για κάθε άλλη επιλογή καθαρίζεται ρητά
            // (`null`), αλλιώς θα κρατούσε το ακίνητο της προηγούμενης εισαγωγής.
            propertyId: meta.entityType === ENTITY_TYPES.PROPERTY ? meta.entityId : null,
            ...scopeFields,
          });
        }
      }
      // ADR-448 Phase 3 — open a Level for every storey of the building when
      // requested (idempotent backfill). ADR-914 §2.15: το ΑΝ το αποφασίζει ένα σημείο —
      // ποτέ για κάτοψη ακινήτου.
      const allFloorsBuilding = resolveAllFloorsBackfillBuilding(meta, scopeFields.buildingId);
      if (allFloorsBuilding) triggerAllFloorsBackfill(allFloorsBuilding);
      // Raster (PDF / image) is already persisted via /api/floorplan-backgrounds.
      // The DXF scene importer must NOT run for raster. ADR-526 Φ4: `'tek'` DOES
      // need the scene importer — `handleFileImport` branches on `isTekFileName`
      // → `importTekFile` — so let it through alongside `'dxf'`.
      if (meta.format && meta.format !== 'dxf' && meta.format !== 'tek') return;
      onSceneImported(file, undefined, saveContext, targetLevelId ?? undefined);
    },
    [
      onSceneImported, levels, addLevel, currentLevelId,
      setCurrentLevel, entityTypeToFloorplanType, updateLevelContext,
      triggerAllFloorsBackfill,
    ],
  );
}

export interface LevelDeletionDeps {
  readonly levels: Level[];
  readonly deleteLevel: (levelId: string) => Promise<void>;
  readonly userUid: string | undefined;
}

export interface LevelDeletionApi {
  readonly showDeleteConfirm: boolean;
  readonly setShowDeleteConfirm: (open: boolean) => void;
  readonly requestDeleteLevel: (levelId: string) => void;
  readonly handleConfirmDelete: () => Promise<void>;
  readonly handleCloseLevel: (levelId: string) => Promise<void>;
}

/**
 * Level delete/close lifecycle. `requestDeleteLevel` opens the confirm dialog;
 * `handleConfirmDelete` removes the level and best-effort trashes its linked
 * FileRecord; `handleCloseLevel` removes a level without the confirm prompt.
 */
export function useLevelDeletion({ levels, deleteLevel, userUid }: LevelDeletionDeps): LevelDeletionApi {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const pendingDeleteLevelRef = useRef<string | null>(null);

  const requestDeleteLevel = useCallback((levelId: string) => {
    pendingDeleteLevelRef.current = levelId;
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    const levelId = pendingDeleteLevelRef.current;
    if (!levelId) return;
    try {
      const level = levels.find(l => l.id === levelId);
      await deleteLevel(levelId);
      // Trash underlying FileRecord if linked
      if (level?.sceneFileId && userUid) {
        try {
          await FileRecordService.moveToTrash(level.sceneFileId, 'company', userUid);
        } catch {
          // Non-blocking — level removed, file trash best-effort
        }
      }
    } catch (error) {
      console.error('Failed to delete level:', error);
    } finally {
      setShowDeleteConfirm(false);
      pendingDeleteLevelRef.current = null;
    }
  }, [levels, deleteLevel, userUid]);

  const handleCloseLevel = useCallback(async (levelId: string) => {
    try {
      await deleteLevel(levelId);
    } catch (error) {
      console.error('Failed to close level:', error);
    }
  }, [deleteLevel]);

  return { showDeleteConfirm, setShowDeleteConfirm, requestDeleteLevel, handleConfirmDelete, handleCloseLevel };
}
