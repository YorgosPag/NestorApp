/**
 * =============================================================================
 * SHOWCASE CORE — Snapshot Builder Factory (ADR-321)
 * =============================================================================
 *
 * Config-driven generic lifted from `property-showcase/snapshot-builder.ts`
 * (canonical baseline per ADR-321). Produces a showcase snapshot of shape
 * `{ [payloadKey]: TInfo, company }` for any entity type (property / project /
 * building / future surfaces) via a single orchestration.
 *
 * Responsibilities:
 *   1. Load the Firestore doc by id from the configured collection.
 *   2. Enforce tenant isolation (throw ShowcaseTenantMismatchError if
 *      `raw.companyId !== companyId`) — belt-and-suspenders alongside
 *      route-level withAuth.
 *   3. Optionally load entity-specific relations (property: linkedSpaces,
 *      storages, parking, floors; project/building: project-name lookup).
 *   4. Delegate per-field mapping to the config's `buildInfo` hook.
 *   5. Resolve company branding via `resolveShowcaseCompanyBranding` with the
 *      configured branding source (defaults to `'tenant'` — the developer
 *      brand, never the linked client's brand).
 *   6. Wrap output with the config's `wrapSnapshot` factory so the caller's
 *      snapshot shape stays byte-identical to its legacy payload.
 *
 * @module services/showcase-core/snapshot-builder-factory
 */

import type { Firestore } from 'firebase-admin/firestore';
import {
  resolveShowcaseCompanyBranding,
  type ShowcaseCompanyBranding,
} from '@/services/company/company-branding-resolver';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';

// =============================================================================
// Errors — exported at module level so consumers can subclass for legacy aliases
// =============================================================================

export class ShowcaseEntityNotFoundError extends Error {
  constructor(
    public readonly entityLabel: string,
    public readonly entityId: string,
  ) {
    super(`${entityLabel} not found: ${entityId}`);
    this.name = `${entityLabel}NotFoundError`;
  }
}

export class ShowcaseTenantMismatchError extends Error {
  constructor(
    public readonly entityLabel: string,
    public readonly entityId: string,
  ) {
    super(
      `Tenant isolation violation for ${entityLabel.toLowerCase()}: ${entityId}`,
    );
    this.name = 'TenantMismatchError';
  }
}

// =============================================================================
// Config + factory signatures
// =============================================================================

export interface BuildInfoParams<TRelations> {
  entityId: string;
  raw: Record<string, unknown>;
  relations: TRelations;
  locale: EnumLocale;
}

export interface BrandingResolutionParams {
  adminDb: Firestore;
  raw: Record<string, unknown>;
  companyId: string;
}

export interface ShowcaseSnapshotBuilderConfig<
  TInfo,
  TRelations,
  TSnapshot,
> {
  /** Firestore collection under `COLLECTIONS.*`. */
  collection: string;
  /** Human entity label for error messages (e.g. "Property", "Project", "Building"). */
  entityLabel: string;
  /**
   * Optional relation loader — property uses this for linkedSpaces +
   * storages/parking/floors; project/building use it for project-name lookup.
   * Must return a value of the closed shape `TRelations` (use `void` when
   * no relations are needed).
   */
  loadRelations?: (
    adminDb: Firestore,
    entityId: string,
    raw: Record<string, unknown>,
  ) => Promise<TRelations>;
  /** Pure per-field mapper — no I/O, no side effects. */
  buildInfo: (params: BuildInfoParams<TRelations>) => TInfo;
  /**
   * Optional branding resolution override. Defaults to
   * `resolveShowcaseCompanyBranding({ brandingSource: 'tenant' })` with
   * `propertyData: { projectId }` when the raw doc carries a projectId.
   */
  resolveBranding?: (
    params: BrandingResolutionParams,
  ) => Promise<ShowcaseCompanyBranding>;
  /**
   * Wraps the final snapshot. Different surfaces want different payload keys:
   * property → `{ property: info, company }`, project → `{ project: info,
   * company }`, building → `{ building: info, company }`. The factory stays
   * shape-agnostic; the wrapper owns the exact legacy payload contract.
   */
  wrapSnapshot: (info: TInfo, company: ShowcaseCompanyBranding) => TSnapshot;
}

export interface ShowcaseSnapshotBuilder<TSnapshot> {
  (
    entityId: string,
    locale: EnumLocale,
    adminDb: Firestore,
    companyId: string,
  ): Promise<TSnapshot>;
}

// =============================================================================
// Default branding resolver — matches project + building current behaviour
// =============================================================================

async function defaultBrandingResolver(
  params: BrandingResolutionParams,
): Promise<ShowcaseCompanyBranding> {
  const { adminDb, raw, companyId } = params;
  const projectId = typeof raw.projectId === 'string' ? raw.projectId : undefined;
  return resolveShowcaseCompanyBranding({
    adminDb,
    propertyData: projectId ? { projectId } : {},
    companyId,
    brandingSource: 'tenant',
  });
}

// =============================================================================
// Factory
// =============================================================================

export function createShowcaseSnapshotBuilder<TInfo, TRelations, TSnapshot>(
  config: ShowcaseSnapshotBuilderConfig<TInfo, TRelations, TSnapshot>,
): ShowcaseSnapshotBuilder<TSnapshot> {
  const resolveBranding = config.resolveBranding ?? defaultBrandingResolver;

  return async function buildShowcaseSnapshot(
    entityId: string,
    locale: EnumLocale,
    adminDb: Firestore,
    companyId: string,
  ): Promise<TSnapshot> {
    const entitySnap = await adminDb
      .collection(config.collection)
      .doc(entityId)
      .get();

    if (!entitySnap.exists) {
      throw new ShowcaseEntityNotFoundError(config.entityLabel, entityId);
    }

    const raw = entitySnap.data() ?? {};

    if ((raw.companyId as string | undefined) !== companyId) {
      throw new ShowcaseTenantMismatchError(config.entityLabel, entityId);
    }

    const relations = config.loadRelations
      ? await config.loadRelations(adminDb, entityId, raw)
      : (undefined as unknown as TRelations);

    const info = config.buildInfo({ entityId, raw, relations, locale });

    const company = await resolveBranding({ adminDb, raw, companyId });

    return config.wrapSnapshot(info, company);
  };
}
