'use client';

/**
 * ADR-628 — `createBimBoqAuditLifecycle`: ONE builder for the audit + Η-Μ/ΑΤΟΕ BOQ
 * auto-feed lifecycle callbacks (`onPersisted` / `onDeleted` / `onRestored`) spread
 * into a `createBimEntityPersistenceHook` config (ADR-594).
 *
 * The five MEP entity persistence hooks (boiler / manifold / radiator / water-heater /
 * underfloor, ADR-408) each hand-rolled a byte-identical lifecycle triplet: audit via
 * `recordMep<X>Change`, a BOQ upsert guarded on `company+project+building`, a BOQ
 * delete guarded on `company`, and a restore audit. The ONLY per-entity variance is
 * the BOQ discriminant, the audit client, the delete-snapshot fallback `kind`, and
 * (underfloor only) the BOQ payload shape. Those become config; the invariant triplet
 * lives HERE once.
 *
 * Behaviour is preserved 1:1 — same audit records, same BOQ rows, same guards, same
 * order. NOT adopted by the finish/scene-aware structural feeds (beam/column/slab use
 * `beamBoqEntity`/`column-boq-feed` + `bim:*-persisted` emits) — deliberately kept
 * bespoke (N.1: don't force divergent behaviour into a shared shape).
 *
 * @see ./create-bim-entity-persistence-hook.ts — the persistence factory
 * @see docs/centralized-systems/reference/adrs/ADR-628-wall-boolean-op-persistence-ssot.md
 */

import { bimToBoqBridge, type BimEntityForBoq } from '../../bim/services/BimToBoqBridge';
import type { BimEntityType } from '../../bim/config/bim-to-atoe-mapping';
import type {
  OnDeletedInfo,
  OnPersistedInfo,
  OnRestoredInfo,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// TYPES
// ============================================================================

export type BimBoqAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

/** Minimal scene-entity shape the lifecycle reads. */
export interface BimBoqAuditEntity {
  readonly id: string;
  readonly kind: string;
  readonly layerId: string;
  readonly params: unknown;
}

/**
 * A per-entity `record<X>Change` audit client. Accepts either the full scene entity
 * (create / update / restore) or a minimal delete snapshot (delete path). Every
 * `recordMep<X>Change` (ADR-408) is structurally assignable to this.
 */
export type BimEntityAuditRecorder<TEntity extends BimBoqAuditEntity> = (
  action: BimBoqAuditAction,
  snapshot:
    | TEntity
    | (Pick<TEntity, 'id' | 'kind'> & {
        readonly layerId?: string;
        readonly params?: Partial<TEntity['params']>;
      }),
  options?: { readonly prevParams?: Partial<TEntity['params']> | null },
) => void;

export interface BimBoqAuditLifecycleConfig<TEntity extends BimBoqAuditEntity> {
  /** BOQ entity discriminant (ΑΤΟΕ/ΑΤΗΕ mapping key). */
  readonly boqType: BimEntityType;
  /** Per-entity audit client (`recordMep<X>Change`). */
  readonly recordChange: BimEntityAuditRecorder<TEntity>;
  /** `kind` used in the delete audit snapshot when the entity is already gone. */
  readonly deletedFallbackKind: TEntity['kind'];
  /** BOQ payload builder. Default: `{ id, kind }` (1-piece MEP items). Underfloor
   *  overrides with the developed serpentine pipe length (`geometry.lengthM`). */
  readonly boqPayload?: (entity: TEntity) => BimEntityForBoq;
}

/** The lifecycle triplet — spread into a `createBimEntityPersistenceHook` config. */
export interface BimBoqAuditLifecycle<TEntity extends BimBoqAuditEntity> {
  readonly onPersisted: (entity: TEntity, info: OnPersistedInfo<TEntity['params'], undefined>) => void;
  readonly onDeleted: (
    id: string,
    deleted: TEntity | null,
    info: OnDeletedInfo<TEntity['params'], undefined>,
  ) => void;
  readonly onRestored: (entity: TEntity, info: OnRestoredInfo<undefined>) => void;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createBimBoqAuditLifecycle<TEntity extends BimBoqAuditEntity>(
  config: BimBoqAuditLifecycleConfig<TEntity>,
): BimBoqAuditLifecycle<TEntity> {
  const buildBoqPayload =
    config.boqPayload ?? ((entity: TEntity): BimEntityForBoq => ({ id: entity.id, kind: entity.kind }));

  return {
    onPersisted: (entity, { isNew, prevComparable, scope }) => {
      config.recordChange(isNew ? 'created' : 'updated', entity, {
        prevParams: prevComparable ?? undefined,
      });
      // ADR-408 — Η-Μ BOQ auto-feed (guarded; bridge also no-ops on incomplete scope).
      if (scope.companyId && scope.projectId && scope.buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          config.boqType,
          buildBoqPayload(entity),
          {
            companyId: scope.companyId,
            projectId: scope.projectId,
            buildingId: scope.buildingId,
            floorId: scope.floorId ?? undefined,
          },
          isNew ? 'created' : 'updated',
        );
      }
    },
    onDeleted: (id, deleted, { scope }) => {
      // The four fields are listed deliberately: this PRUNES the entity down to the
      // audit-relevant subset (`geometry` must not enter the snapshot — pinned by
      // create-bim-boq-audit-lifecycle.test.ts), so it cannot be `deleted` passed through.
      // The assertion restores what the projection loses: reading a property off a type
      // parameter yields the CONSTRAINT's type (`kind: string`, `params: unknown`), not
      // `TEntity['kind']` / `TEntity['params']` — so the rebuilt literal no longer matched
      // the recorder's snapshot alternative. Every field below is copied straight off
      // `deleted`, so the asserted type is the one the values already have.
      const snapshot = deleted
        ? ({
            id: deleted.id,
            kind: deleted.kind,
            layerId: deleted.layerId,
            params: deleted.params,
          } as Pick<TEntity, 'id' | 'kind'> & {
            readonly layerId: string;
            readonly params: TEntity['params'];
          })
        : { id, kind: config.deletedFallbackKind };
      config.recordChange('deleted', snapshot);
      // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
      if (scope.companyId) void bimToBoqBridge.deleteBoqItemForBim(id, scope.companyId);
    },
    onRestored: (entity) => {
      config.recordChange('restored', entity);
    },
  };
}
