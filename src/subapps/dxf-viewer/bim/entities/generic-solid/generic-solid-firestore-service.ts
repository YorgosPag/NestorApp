'use client';

/**
 * ADR-684 Φ2 — Generic solid Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_generic_solids/{genericSolidId}` (companyId-scoped via field).
 * Καθρέφτης του `imported-mesh-firestore-service.ts` — ίδιο scope, ίδιο enterprise-id συμβόλαιο
 * (SOS N.6: `setDoc` + `generateGenericSolidId()`, ποτέ auto-id).
 *
 * **Γιατί χρειάζεται persistence** (και δεν είναι προαιρετικό): το `generic-solid` είναι πλήρης BIM
 * πολίτης, άρα το `isPerEntityPersistedEntity` το καλύπτει, άρα ο `reconcileLoadedSceneBim` **πετά**
 * το αντίγραφό του από το scene snapshot στο load και το ξαναγεμίζει **μόνο** από per-entity έγγραφα.
 * Χωρίς αυτό το service, κάθε στερεό θα εξαφανιζόταν στο πρώτο reload.
 *
 * @see ../imported-mesh/imported-mesh-firestore-service — ο αδελφός που καθρεφτίζεται
 * @see ../../../systems/levels/scene-bim-load-policy — γιατί το per-entity doc είναι SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
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
import { generateGenericSolidId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../../persistence/bim-floor-scope';
import type { BimValidation } from '../../types/bim-base';
import type {
  GenericSolidEntity,
  GenericSolidGeometry,
  GenericSolidKind,
  GenericSolidParams,
} from './generic-solid-types';

/**
 * Το έγγραφο ενός παραμετρικού στερεού. Το `geometry` είναι προαιρετικό (επαναπαράγεται από
 * `computeGenericSolidGeometry(params)`), οι διαστάσεις ζουν στο `params.shape`.
 */
export interface GenericSolidDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: GenericSolidKind;
  readonly params: GenericSolidParams;
  readonly validation: BimValidation;
  readonly geometry?: GenericSolidGeometry;
  readonly name?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface GenericSolidFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface GenericSolidSaveInput {
  readonly id?: string;
  readonly params: GenericSolidParams;
  readonly validation: BimValidation;
  readonly geometry?: GenericSolidGeometry;
  readonly name?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface GenericSolidUpdateInput {
  readonly params?: GenericSolidParams;
  readonly validation?: BimValidation;
  readonly geometry?: GenericSolidGeometry;
  readonly name?: string;
  readonly layerId?: string;
}

export class GenericSolidFirestoreService {
  constructor(private readonly config: GenericSolidFirestoreServiceConfig) {}

  private docRef(genericSolidId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_GENERIC_SOLIDS, genericSolidId);
  }

  /** Real-time subscription scoped to `(projectId, floorId)`. Tenant `companyId` auto-applied. */
  subscribeGenericSolids(
    onChange: (solids: readonly GenericSolidDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<GenericSolidDoc>(
      'FLOORPLAN_GENERIC_SOLIDS',
      (result) => onChange(result.documents),
      onError,
      { constraints: buildBimScopeConstraints(this.config) },
    );
  }

  /** Enterprise-id (SOS N.6): `generateGenericSolidId()` όταν δεν δίνεται `id`. */
  async saveGenericSolid(input: GenericSolidSaveInput): Promise<GenericSolidDoc> {
    const id = input.id ?? generateGenericSolidId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      ...bimScopeWriteFields(this.config),
      kind: 'generic',
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
    return base as unknown as GenericSolidDoc;
  }

  async updateGenericSolid(genericSolidId: string, patch: GenericSolidUpdateInput): Promise<void> {
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.params !== undefined) payload.params = patch.params;
    if (patch.validation !== undefined) payload.validation = patch.validation;
    if (patch.geometry !== undefined) payload.geometry = patch.geometry;
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;

    await updateDoc(this.docRef(genericSolidId), payload);
  }

  async deleteGenericSolid(genericSolidId: string): Promise<void> {
    await deleteDoc(this.docRef(genericSolidId));
  }
}

export function createGenericSolidFirestoreService(
  config: GenericSolidFirestoreServiceConfig,
): GenericSolidFirestoreService {
  return new GenericSolidFirestoreService(config);
}

/** Σκηνή → έγγραφο. Το `geometry` παραλείπεται σκόπιμα (επαναπαράγεται από τις παραμέτρους). */
export function genericSolidEntityToSaveInput(entity: GenericSolidEntity): GenericSolidSaveInput {
  return {
    id: entity.id,
    params: entity.params,
    validation: entity.validation,
    name: entity.name,
    layerId: entity.layerId,
    floorId: entity.floorId,
  };
}
