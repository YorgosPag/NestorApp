/**
 * Project Showcase Snapshot Builder — SSoT (ADR-316).
 *
 * Builds a `ProjectShowcaseSnapshot` from a Firestore project document.
 * Used by: PDF API route, public showcase API route.
 *
 * Tenant isolation enforced: throws if `project.companyId !== companyId`.
 *
 * @module services/project-showcase/snapshot-builder
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import type { ProjectShowcaseInfo, ProjectShowcaseSnapshot } from '@/types/project-showcase';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import { translateProjectType, translateProjectStatus } from './labels';

function pickString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return null;
}

function pickNumber(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  return null;
}

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`);
    this.name = 'ProjectNotFoundError';
  }
}

export class TenantMismatchError extends Error {
  constructor(projectId: string) {
    super(`Tenant isolation violation for project: ${projectId}`);
    this.name = 'TenantMismatchError';
  }
}

export async function buildProjectShowcaseSnapshot(
  projectId: string,
  locale: EnumLocale,
  adminDb: Firestore,
  companyId: string,
): Promise<ProjectShowcaseSnapshot> {
  const projectSnap = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();

  if (!projectSnap.exists) {
    throw new ProjectNotFoundError(projectId);
  }

  const raw = projectSnap.data() ?? {};

  if ((raw.companyId as string | undefined) !== companyId) {
    throw new TenantMismatchError(projectId);
  }

  const project: ProjectShowcaseInfo = {
    id: projectId,
    projectCode:        pickString(raw.projectCode),
    name:               pickString(raw.name) ?? pickString(raw.title) ?? projectId,
    description:        pickString(raw.description),
    typeLabel:          translateProjectType(pickString(raw.type) ?? undefined, locale) ?? null,
    statusLabel:        translateProjectStatus(pickString(raw.status) ?? undefined, locale) ?? null,
    progress:           pickNumber(raw.progress) ?? 0,
    totalValue:         pickNumber(raw.totalValue),
    totalArea:          pickNumber(raw.totalArea),
    startDate:          pickString(raw.startDate),
    completionDate:     pickString(raw.completionDate),
    address:            pickString(raw.address),
    city:               pickString(raw.city),
    location:           pickString(raw.location),
    client:             pickString(raw.client),
    linkedCompanyName:  pickString(raw.linkedCompanyName),
  };

  const company = await resolveShowcaseCompanyBranding({
    adminDb,
    propertyData: { projectId },
    companyId,
    brandingSource: 'tenant',
  });

  return { project, company };
}
