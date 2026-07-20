'use client';

/**
 * ADR-683 Φ3β — Imported mesh Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_imported_meshes/{importedMeshId}` (companyId-scoped via field).
 * Καθρέφτης του `furniture-firestore-service.ts` — ίδιο scope, ίδιο enterprise-id συμβόλαιο
 * (SOS N.6: `setDoc` + `generateImportedMeshId()`, ποτέ auto-id).
 *
 * **Γιατί χρειάζεται καθόλου persistence** (και δεν είναι προαιρετικό): η Φ3α έκανε το
 * `imported-mesh` πλήρη BIM πολίτη, άρα το `isPerEntityPersistedEntity` το καλύπτει, άρα ο
 * `reconcileLoadedSceneBim` **πετά** το αντίγραφό του από το scene snapshot στο load και το
 * ξαναγεμίζει **μόνο** από per-entity έγγραφα. Χωρίς αυτό το service, κάθε εισαγωγή θα
 * εξαφανιζόταν στο πρώτο reload — και ο χρήστης δεν θα καταλάβαινε γιατί.
 *
 * @see ../../furniture/furniture-firestore-service — ο αδελφός που καθρεφτίζεται
 * @see ../../../systems/levels/scene-bim-load-policy — γιατί το per-entity doc είναι SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §5
 */

import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateImportedMeshId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../../persistence/bim-floor-scope';
import type { BimValidation } from '../../types/bim-base';
import type {
  ImportedMeshEntity,
  ImportedMeshGeometry,
  ImportedMeshParams,
} from './imported-mesh-types';

/**
 * Το έγγραφο ενός εισαγόμενου πλέγματος. Το `geometry` είναι προαιρετικό (επαναπαράγεται από
 * `computeImportedMeshGeometry(params)`), αλλά οι **μετρημένες διαστάσεις** ζουν μέσα στο `params`
 * και αποθηκεύονται πάντα: χωρίς αυτές, μετά το reload το ίχνος θα ήταν μηδενικό μέχρι να κατέβει
 * το `.glb` — δηλαδή το αντικείμενο θα ήταν προσωρινά **άκλικο**.
 */
export interface ImportedMeshDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: 'imported';
  readonly params: ImportedMeshParams;
  readonly validation: BimValidation;
  readonly geometry?: ImportedMeshGeometry;
  readonly name?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface ImportedMeshFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface ImportedMeshSaveInput {
  readonly id?: string;
  readonly params: ImportedMeshParams;
  readonly validation: BimValidation;
  readonly geometry?: ImportedMeshGeometry;
  readonly name?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface ImportedMeshUpdateInput {
  readonly params?: ImportedMeshParams;
  readonly validation?: BimValidation;
  readonly geometry?: ImportedMeshGeometry;
  readonly name?: string;
  readonly layerId?: string;
}

export class ImportedMeshFirestoreService {
  constructor(private readonly config: ImportedMeshFirestoreServiceConfig) {}

  private docRef(importedMeshId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_IMPORTED_MESHES, importedMeshId);
  }

  /** Real-time subscription scoped to `(projectId, floorId)`. Tenant `companyId` auto-applied. */
  subscribeImportedMeshes(
    onChange: (meshes: readonly ImportedMeshDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<ImportedMeshDoc>(
      'FLOORPLAN_IMPORTED_MESHES',
      (result) => onChange(result.documents),
      onError,
      { constraints: buildBimScopeConstraints(this.config) },
    );
  }

  /** Enterprise-id (SOS N.6): `generateImportedMeshId()` όταν δεν δίνεται `id`. */
  async saveImportedMesh(input: ImportedMeshSaveInput): Promise<ImportedMeshDoc> {
    const id = input.id ?? generateImportedMeshId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      ...bimScopeWriteFields(this.config),
      kind: 'imported',
      params: input.params,
      validation: input.validation,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };

    // Firestore απορρίπτει `undefined` — τα προαιρετικά μπαίνουν μόνο όταν έχουν τιμή.
    if (input.geometry !== undefined) base.geometry = input.geometry;
    if (input.name !== undefined) base.name = input.name;
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as ImportedMeshDoc;
  }

  async updateImportedMesh(importedMeshId: string, patch: ImportedMeshUpdateInput): Promise<void> {
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.params !== undefined) payload.params = patch.params;
    if (patch.validation !== undefined) payload.validation = patch.validation;
    if (patch.geometry !== undefined) payload.geometry = patch.geometry;
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;

    await updateDoc(this.docRef(importedMeshId), payload);
  }

  async deleteImportedMesh(importedMeshId: string): Promise<void> {
    await deleteDoc(this.docRef(importedMeshId));
  }
}

export function createImportedMeshFirestoreService(
  config: ImportedMeshFirestoreServiceConfig,
): ImportedMeshFirestoreService {
  return new ImportedMeshFirestoreService(config);
}

/**
 * Σκηνή → έγγραφο. Το `geometry` παραλείπεται σκόπιμα (επαναπαράγεται από τις παραμέτρους), το
 * `name` **όχι**: είναι το όνομα του κόμβου που είδε ο χρήστης στη λίστα εισαγωγής και η μόνη
 * γέφυρα ανάμεσα στο «Rail_01» του συνεργάτη και στο αντικείμενο της κάτοψης.
 */
export function importedMeshEntityToSaveInput(entity: ImportedMeshEntity): ImportedMeshSaveInput {
  return {
    id: entity.id,
    params: entity.params,
    validation: entity.validation,
    name: entity.name,
    layerId: entity.layerId,
    floorId: entity.floorId,
  };
}
