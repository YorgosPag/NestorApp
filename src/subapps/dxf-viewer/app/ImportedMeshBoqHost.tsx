'use client';

/**
 * ImportedMeshBoqHost — ADR-683 Φ3.1β: ο μεσάζων ανάμεσα στο store ορατότητας, τη σκηνή και το
 * undoable command.
 *
 * Καθρέφτης του `PsetEditorHost`: το dialog μένει καθαρό (props in, callbacks out), ενώ εδώ ζουν οι
 * τρεις εξαρτήσεις που δεν του ανήκουν — η ανάγνωση της οντότητας από τον ενεργό όροφο, η
 * βιβλιοθήκη υλικών (για την πρόταση **και** τον προαιρετικό δείκτη τιμής), και η εκτέλεση του
 * `AssignImportedMeshIdentityCommand`.
 *
 * Η αποθήκευση **δεν** γίνεται εδώ: το command σηματοδοτεί τη σκηνή, ο `useImportedMeshPersistence`
 * βλέπει τη μεταβολή των params και τρέχει τον κοινό lifecycle (audit + γραμμή BOQ **ή** διαγραφή
 * της). Ένας ιδιοκτήτης του κύκλου ζωής, όχι δύο.
 *
 * @see ./PsetEditorHost — το πρότυπο (event-gated dialog + undoable command)
 * @see ../ui/components/imported-mesh/ImportedMeshBoqDialog — η διεπαφή
 */

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import { useCommandHistory } from '../core/commands';
import { AssignImportedMeshIdentityCommand } from '../core/commands/entity-commands/AssignImportedMeshIdentityCommand';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { ImportedMeshBoqDialogStore } from '../stores/ImportedMeshBoqDialogStore';
import { useMaterialLibrary } from '../ui/panels/materials/hooks/useMaterialLibrary';
import { buildKnownMaterialResolver } from '../io/mesh3d-material-import/known-import-materials';
import { suggestImportedMeshIdentity } from '../bim/entities/imported-mesh/imported-mesh-identity-suggest';
import { countUnassignedImportedMeshes } from '../bim/entities/imported-mesh/imported-mesh-boq';
import type {
  ImportedMeshBoqIdentity,
  ImportedMeshParams,
} from '../bim/entities/imported-mesh/imported-mesh-types';
import type { AnySceneEntity } from '../types/entities';
import { ImportedMeshBoqDialog } from '../ui/components/imported-mesh/ImportedMeshBoqDialog';

export interface ImportedMeshBoqHostProps {
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string | null;
}

/** Τα params του πλέγματος στον ενεργό όροφο, ή `null` όταν έφυγε (π.χ. διαγράφηκε αλλού). */
function readMeshParams(
  levelManager: LevelSceneWriter,
  entityId: string | null,
): ImportedMeshParams | null {
  const levelId = levelManager.currentLevelId;
  if (!entityId || !levelId) return null;
  const scene = levelManager.getLevelScene(levelId);
  const entity = scene?.entities.find((e: AnySceneEntity) => e.id === entityId);
  if (!entity || entity.type !== 'imported-mesh') return null;
  return (entity as AnySceneEntity & { params: ImportedMeshParams }).params;
}

export function ImportedMeshBoqHost({
  levelManager, projectId = null,
}: ImportedMeshBoqHostProps): React.ReactElement | null {
  const { entityId } = useSyncExternalStore(
    ImportedMeshBoqDialogStore.subscribe,
    ImportedMeshBoqDialogStore.getSnapshot,
    ImportedMeshBoqDialogStore.getSnapshot,
  );
  const { execute: executeCommand } = useCommandHistory();
  const { user } = useAuth();

  const { materials } = useMaterialLibrary({
    companyId: user?.companyId ?? undefined,
    userId: user?.uid ?? undefined,
    projectId: projectId ?? undefined,
  });

  const params = readMeshParams(levelManager, entityId);

  // Τα **υπόλοιπα** ανανάθετα: το τρέχον αφαιρείται, γιατί ο χρήστης το κρατά ήδη ανοιχτό — ένα
  // «μένουν 7» που περιλαμβάνει αυτό που μόλις κοιτάς είναι λάθος αριθμός.
  const remainingUnassigned = useMemo(() => {
    const levelId = levelManager.currentLevelId;
    if (entityId === null || !levelId) return 0;
    const entities = levelManager.getLevelScene(levelId)?.entities ?? [];
    const total = countUnassignedImportedMeshes(entities);
    return params && params.importedMeshIdentity === undefined ? Math.max(0, total - 1) : total;
  }, [entityId, levelManager, params]);

  /**
   * Η αρχική τιμή του εντύπου. **Η υπάρχουσα ταυτότητα υπερισχύει πάντα** της πρότασης: όταν το
   * πλέγμα είναι ήδη ανατεθειμένο, ο χρήστης το ανοίγει για να δει/διορθώσει ό,τι δήλωσε — μια
   * πρόταση θα του έσβηνε σιωπηλά τη δουλειά του με μια μαντεψιά από όνομα αρχείου.
   */
  const { initial, suggestionSource } = useMemo(() => {
    if (!params) return { initial: null, suggestionSource: null };
    if (params.importedMeshIdentity) {
      return { initial: params.importedMeshIdentity, suggestionSource: null };
    }
    const suggestion = suggestImportedMeshIdentity({
      params,
      resolveMaterialId: buildKnownMaterialResolver(materials),
      materials,
    });
    return { initial: suggestion, suggestionSource: suggestion?.source ?? null };
  }, [params, materials]);

  const applyIdentity = useCallback(
    (identity: ImportedMeshBoqIdentity | undefined): void => {
      const levelId = levelManager.currentLevelId;
      if (!entityId || !levelId) {
        ImportedMeshBoqDialogStore.close();
        return;
      }
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      executeCommand(new AssignImportedMeshIdentityCommand(entityId, identity, sm));
      ImportedMeshBoqDialogStore.close();
    },
    [entityId, levelManager, executeCommand],
  );

  const handleSave = useCallback(
    (identity: ImportedMeshBoqIdentity) => applyIdentity(identity),
    [applyIdentity],
  );
  const handleClear = useCallback(() => applyIdentity(undefined), [applyIdentity]);
  const handleCancel = useCallback(() => ImportedMeshBoqDialogStore.close(), []);

  return (
    <ImportedMeshBoqDialog
      open={entityId !== null && params !== null}
      params={params}
      initial={initial}
      suggestionSource={suggestionSource}
      materials={materials}
      remainingUnassigned={remainingUnassigned}
      onSave={handleSave}
      onClear={handleClear}
      onCancel={handleCancel}
    />
  );
}
