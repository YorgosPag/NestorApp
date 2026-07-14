'use client';

/**
 * ADR-650 — Topographic surface-definition Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_topo_surfaces/{topo_*}` (companyId-scoped via field,
 * 1 doc/floor). Mirror of `GridGuideFirestoreService` (ADR-441) — **single-doc**,
 * not a per-entity collection.
 *
 * Scale (big-player split): a small survey embeds inline; a point cloud over
 * {@link TOPO_INLINE_MAX_BYTES} would blow the 1MB Firestore doc limit, so its
 * survey definition is offloaded to a Storage blob (`pointsStoragePath`), exactly
 * as the DXF scene blob lives in Storage, not Firestore.
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_TOPO_SURFACES', …)` with
 * a SITE-level `projectId`-only constraint (ADR-650): the terrain is one
 * `IfcSite` object per project, visible on every storey — NOT per-floor. Tenant
 * `companyId` auto-applied (CHECK 3.10). Returns 0 or 1 doc per project.
 * `floorId`/`floorplanId` are written as provenance only (which storey/file the
 * survey was captured on), never the scope key.
 *
 * @see ./topo-persistence-types.ts
 * @see ../../guides/guide-firestore-service.ts
 * @see ../../../bim/persistence/bim-floor-scope.ts — buildProjectScopeConstraints
 */

import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { getBytes, ref, uploadString } from 'firebase/storage';

import { db, storage } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateTopoSurfaceId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import { buildProjectScopeConstraints } from '../../../bim/persistence/bim-floor-scope';
import type { TopoPersistedState, TopoSurfaceDoc, TopoSurfacesDefinition } from './topo-persistence-types';
import { TOPO_INLINE_MAX_BYTES, topoDefinitionByteSize, topoSettingsDocFields } from './topo-persistence-types';

/** ADR-650 — SITE-level scope (one terrain per project). See buildProjectScopeConstraints. */
export interface TopoSurfaceServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly userId: string;
}

/**
 * ADR-650 — provenance stamped on the topo doc at CREATE (which storey/file the
 * survey was captured on). Immutable afterwards; never the scope key. The rules
 * require `floorplanId` on create, so it is always present (the hook mirrors the
 * durable `floorId` into it when the storey has no DXF file yet).
 */
export interface TopoProvenance {
  readonly floorplanId: string;
  readonly floorId?: string;
}

export interface TopoSaveInput {
  /** Existing doc id (update) or undefined (first write → generate). */
  readonly id?: string;
  readonly state: TopoPersistedState;
  readonly version: number;
  /** CREATE-only provenance (see {@link TopoProvenance}). Ignored on update. */
  readonly provenance?: TopoProvenance;
}

export class TopoSurfaceFirestoreService {
  constructor(private readonly config: TopoSurfaceServiceConfig) {}

  private docRef(docId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_TOPO_SURFACES, docId);
  }

  /** Storage path of the offloaded survey blob — company + project-scope keyed (tenant-isolated). */
  private blobPath(docId: string): string {
    return `topo-surfaces/${this.config.companyId}/${this.config.projectId}/${docId}.json`;
  }

  /** Real-time subscription scoped to `projectId` (SITE-level, ADR-650). 0 or 1 doc. */
  subscribeTopo(
    onChange: (docs: readonly TopoSurfaceDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<TopoSurfaceDoc>(
      'FLOORPLAN_TOPO_SURFACES',
      (result) => onChange(result.documents),
      onError,
      { constraints: buildProjectScopeConstraints(this.config.projectId) },
    );
  }

  /** Read an offloaded survey blob back into memory (hydrate path for large clouds). */
  async readSurfacesBlob(path: string): Promise<TopoSurfacesDefinition> {
    const bytes = await getBytes(ref(storage, path));
    return JSON.parse(new TextDecoder().decode(bytes)) as TopoSurfacesDefinition;
  }

  /**
   * Build the survey-definition half of the write: inline when small, else upload the
   * blob and return only its `pointsStoragePath`. `stripUndefinedDeep` clears the
   * optional `sourceEntityId`/`code` nested `undefined` (Firestore rejects undefined).
   */
  private async buildDefinitionFields(docId: string, surfaces: TopoSurfacesDefinition): Promise<
    { surfaces: TopoSurfacesDefinition } | { pointsStoragePath: string }
  > {
    if (topoDefinitionByteSize(surfaces) <= TOPO_INLINE_MAX_BYTES) {
      return { surfaces: stripUndefinedDeep(surfaces) };
    }
    const path = this.blobPath(docId);
    await uploadString(ref(storage, path), JSON.stringify(stripUndefinedDeep(surfaces)), 'raw', {
      contentType: 'application/json',
    });
    return { pointsStoragePath: path };
  }

  /** First write — stamps createdAt (immutable). Enterprise-id when no id is supplied. */
  async createTopo(input: TopoSaveInput): Promise<string> {
    const id = input.id ?? generateTopoSurfaceId();
    const definition = await this.buildDefinitionFields(id, input.state.surfaces);
    // Provenance (immutable): the storey/file the survey was captured on. Rules
    // require `floorplanId`; fall back to projectId so the doc stays creatable
    // even for a file-less storey (should not happen — the hook mirrors floorId).
    const provenance = {
      floorplanId: input.provenance?.floorplanId ?? this.config.projectId,
      ...(input.provenance?.floorId ? { floorId: input.provenance.floorId } : {}),
    };
    await setDoc(this.docRef(id), stripUndefinedDeep({
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      ...provenance,
      ...definition,
      ...topoSettingsDocFields(input.state),
      version: input.version,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    }));
    return id;
  }

  /** Subsequent writes — overwrite definition + settings (createdAt left intact). */
  async updateTopo(docId: string, input: TopoSaveInput): Promise<void> {
    const definition = await this.buildDefinitionFields(docId, input.state.surfaces);
    // When switching inline↔offloaded, clear the field no longer used (Firestore has no
    // "unset" via undefined → deleteField would, but a plain overwrite with the alternate
    // shape + null on the stale key keeps the doc coherent).
    const staleClear =
      'surfaces' in definition ? { pointsStoragePath: null } : { surfaces: null };
    await updateDoc(this.docRef(docId), stripUndefinedDeep({
      ...definition,
      ...staleClear,
      ...topoSettingsDocFields(input.state),
      version: input.version,
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    }));
  }

  async deleteTopo(docId: string): Promise<void> {
    await deleteDoc(this.docRef(docId));
  }
}

export function createTopoSurfaceFirestoreService(
  config: TopoSurfaceServiceConfig,
): TopoSurfaceFirestoreService {
  return new TopoSurfaceFirestoreService(config);
}
