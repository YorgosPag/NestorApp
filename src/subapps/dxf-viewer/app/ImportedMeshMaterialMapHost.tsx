'use client';

/**
 * ImportedMeshMaterialMapHost — ADR-686 Φ5: ο μεσάζων ανάμεσα στο store ορατότητας, τη σκηνή, τη
 * βιβλιοθήκη υλικών και το batch undoable command «Αντιστοίχιση Υλικών».
 *
 * Καθρέφτης του `ImportedMeshBoqHost`: το dialog μένει καθαρό (props in, callbacks out), ενώ εδώ
 * ζουν οι εξαρτήσεις — η άγκυρα-οντότητα από το store, όλα τα **αδέλφια κομμάτια** του ίδιου
 * `uploadId` (ένα `.glb` = δεκάδες κόμβοι), η βιβλιοθήκη υλικών, και η εκτέλεση του batch.
 *
 * Η αποθήκευση **δεν** γίνεται εδώ: το batch command σηματοδοτεί τη σκηνή, ο
 * `useImportedMeshPersistence` βλέπει τη μεταβολή του `faceAppearance` και persist-άρει. Ένας
 * ιδιοκτήτης του κύκλου ζωής (SSoT `faceAppearance`, ADR-539), όχι δεύτερος μηχανισμός.
 *
 * @see ./ImportedMeshBoqHost — το πρότυπο (store-gated dialog + undoable command)
 * @see ../bim-3d/ui/apply-imported-mesh-material-map — το batch write (ένα undo βήμα)
 * @see docs/centralized-systems/reference/adrs/ADR-686-imported-mesh-appearance-override.md
 */

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import { ImportedMeshMaterialMapDialogStore } from '../stores/ImportedMeshMaterialMapDialogStore';
import { useMaterialLibrary } from '../ui/panels/materials/hooks/useMaterialLibrary';
import {
  applyImportedMeshMaterialMap,
  type ImportedMeshMaterialAssignment,
} from '../bim-3d/ui/apply-imported-mesh-material-map';
import {
  IMPORTED_MESH_ENTITY_TYPE,
  type ImportedMeshParams,
} from '../bim/entities/imported-mesh/imported-mesh-types';
import { BASE_FACE_KEY, type FaceAppearanceMap } from '../bim/types/face-appearance-types';
import type { AnySceneEntity } from '../types/entities';
import {
  ImportedMeshMaterialMapDialog,
  type ImportedMeshMaterialMapRow,
  type ImportedMeshMaterialAssignmentInput,
} from '../ui/components/imported-mesh/ImportedMeshMaterialMapDialog';

export interface ImportedMeshMaterialMapHostProps {
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string | null;
}

interface MeshSiblings {
  readonly rows: readonly ImportedMeshMaterialMapRow[];
  readonly sourceFileName: string | null;
}

const EMPTY_SIBLINGS: MeshSiblings = { rows: [], sourceFileName: null };

/** Το τρέχον override υλικού ενός κομματιού — το base `'*'` materialId, ή `null` (auto/embedded). */
function currentMaterialId(entity: AnySceneEntity): string | null {
  const map = (entity as { faceAppearance?: FaceAppearanceMap }).faceAppearance;
  return map?.[BASE_FACE_KEY]?.materialId ?? null;
}

function importedParams(entity: AnySceneEntity): ImportedMeshParams | null {
  if (entity.type !== IMPORTED_MESH_ENTITY_TYPE) return null;
  return (entity as AnySceneEntity & { params?: ImportedMeshParams }).params ?? null;
}

/** Όλα τα κομμάτια του ΙΔΙΟΥ μοντέλου (κοινό `uploadId` με την άγκυρα), ως γραμμές πίνακα. */
function collectSiblings(
  levelManager: LevelSceneWriter,
  anchorId: string | null,
): MeshSiblings {
  const levelId = levelManager.currentLevelId;
  if (!anchorId || !levelId) return EMPTY_SIBLINGS;
  const entities = levelManager.getLevelScene(levelId)?.entities ?? [];
  const anchor = entities.find((e: AnySceneEntity) => e.id === anchorId);
  const anchorParams = anchor ? importedParams(anchor) : null;
  if (!anchorParams) return EMPTY_SIBLINGS;

  const rows: ImportedMeshMaterialMapRow[] = [];
  for (const entity of entities) {
    const params = importedParams(entity);
    if (!params || params.uploadId !== anchorParams.uploadId) continue;
    rows.push({
      entityId: entity.id,
      nodeName: params.nodeName,
      currentMaterialId: currentMaterialId(entity),
    });
  }
  rows.sort((a, b) => a.nodeName.localeCompare(b.nodeName, 'el'));
  return { rows, sourceFileName: anchorParams.sourceFileName };
}

export function ImportedMeshMaterialMapHost({
  levelManager, projectId = null,
}: ImportedMeshMaterialMapHostProps): React.ReactElement | null {
  const { entityId } = useSyncExternalStore(
    ImportedMeshMaterialMapDialogStore.subscribe,
    ImportedMeshMaterialMapDialogStore.getSnapshot,
    ImportedMeshMaterialMapDialogStore.getSnapshot,
  );
  const { user } = useAuth();

  const { materials } = useMaterialLibrary({
    companyId: user?.companyId ?? undefined,
    userId: user?.uid ?? undefined,
    projectId: projectId ?? undefined,
  });

  const { rows, sourceFileName } = useMemo(
    () => collectSiblings(levelManager, entityId),
    [levelManager, entityId],
  );

  const handleSave = useCallback(
    (assignments: readonly ImportedMeshMaterialAssignmentInput[]) => {
      const batch: ImportedMeshMaterialAssignment[] = assignments.map((a) => ({
        entityId: a.entityId,
        value: a.materialId ? { materialId: a.materialId } : null,
      }));
      applyImportedMeshMaterialMap(levelManager, batch);
      ImportedMeshMaterialMapDialogStore.close();
    },
    [levelManager],
  );

  const handleCancel = useCallback(() => ImportedMeshMaterialMapDialogStore.close(), []);

  return (
    <ImportedMeshMaterialMapDialog
      open={entityId !== null && rows.length > 0}
      sourceFileName={sourceFileName}
      rows={rows}
      materials={materials}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
