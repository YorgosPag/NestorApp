/**
 * Project Showcase Snapshot Builder — SSoT (ADR-316, migrated to the core
 * factory in ADR-700).
 *
 * Builds a `ProjectShowcaseSnapshot` from a Firestore project document.
 * Used by: PDF API route, email route, public showcase API route.
 *
 * Until ADR-700 this file re-implemented the whole orchestration by hand —
 * doc fetch, not-found, tenant check, mapping, branding, wrap — and declared
 * its own `Error` subclasses that did **not** descend from the core ones, so
 * `instanceof ShowcaseEntityNotFoundError` was false for exactly one of the
 * five surfaces. It now delegates like its siblings.
 *
 * Tenant isolation is still enforced (the factory throws
 * `ShowcaseTenantMismatchError` when `raw.companyId !== companyId`).
 *
 * @module services/project-showcase/snapshot-builder
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import {
  createShowcaseSnapshotBuilder,
  ShowcaseEntityNotFoundError,
  ShowcaseTenantMismatchError,
} from '@/services/showcase-core/snapshot-builder-factory';
import {
  pickShowcaseNumber,
  pickShowcaseString,
} from '@/services/showcase-core/snapshot-field-primitives';
import type { ProjectShowcaseInfo, ProjectShowcaseSnapshot } from '@/types/project-showcase';
import { translateProjectType, translateProjectStatus } from './labels';

// Legacy error aliases kept so downstream catches keep working unchanged.
export class ProjectNotFoundError extends ShowcaseEntityNotFoundError {
  constructor(projectId: string) {
    super('Project', projectId);
  }
}

export class TenantMismatchError extends ShowcaseTenantMismatchError {
  constructor(projectId: string) {
    super('Project', projectId);
  }
}

export const buildProjectShowcaseSnapshot = createShowcaseSnapshotBuilder<
  ProjectShowcaseInfo,
  void,
  ProjectShowcaseSnapshot
>({
  collection: COLLECTIONS.PROJECTS,
  entityLabel: 'Project',
  /**
   * The project showcase brands itself: its entity *is* the branding project,
   * so the id comes from `entityId`. The factory default reads a
   * `raw.projectId` foreign key, which a project document does not carry —
   * inheriting it would silently drop project-level branding.
   */
  resolveBranding: ({ adminDb, companyId, entityId }) =>
    resolveShowcaseCompanyBranding({
      adminDb,
      propertyData: { projectId: entityId },
      companyId,
      brandingSource: 'tenant',
    }),
  buildInfo: ({ entityId, raw, locale }) => ({
    id: entityId,
    projectCode:        pickShowcaseString(raw.projectCode),
    name:               pickShowcaseString(raw.name) ?? pickShowcaseString(raw.title) ?? entityId,
    description:        pickShowcaseString(raw.description),
    typeLabel:          translateProjectType(pickShowcaseString(raw.type) ?? undefined, locale) ?? null,
    statusLabel:        translateProjectStatus(pickShowcaseString(raw.status) ?? undefined, locale) ?? null,
    progress:           pickShowcaseNumber(raw.progress) ?? 0,
    totalValue:         pickShowcaseNumber(raw.totalValue),
    totalArea:          pickShowcaseNumber(raw.totalArea),
    startDate:          pickShowcaseString(raw.startDate),
    completionDate:     pickShowcaseString(raw.completionDate),
    address:            pickShowcaseString(raw.address),
    city:               pickShowcaseString(raw.city),
    location:           pickShowcaseString(raw.location),
    client:             pickShowcaseString(raw.client),
    linkedCompanyName:  pickShowcaseString(raw.linkedCompanyName),
  }),
  wrapSnapshot: (project, company) => ({ project, company }),
});
