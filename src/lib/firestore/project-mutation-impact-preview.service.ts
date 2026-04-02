import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { Project } from '@/types/project';
import type { ProjectUpdatePayload } from '@/services/projects-client.service';
import type {
  ProjectMutationChange,
  ProjectMutationDependency,
  ProjectMutationImpactPreview,
  ProjectCompanyLinkChangeType,
} from '@/types/project-mutation-impact';
import {
  PROJECT_MUTATION_FIELD_KIND_MAP,
  type ProjectMutationDependencyId,
  type ProjectMutationField,
  type ProjectMutationKind,
} from '@/config/project-mutation-impact';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectMutationImpactPreview');

const BLOCKING_COMPANY_CHANGE_DEPENDENCIES: ReadonlySet<ProjectMutationDependencyId> = new Set([
  'buildings',
  'properties',
  'propertyPaymentPlans',
  'contactLinks',
  'obligations',
  'legalContracts',
  'ownershipTables',
  'attendanceEvents',
  'employmentRecords',
  'accountingInvoices',
  'purchaseOrders',
  'boqItems',
  'files',
]);

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparable(field: ProjectMutationField, value: unknown): string | null {
  if (field === 'linkedCompanyId') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  if (field === 'status') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  return normalizeString(value);
}

function buildChanges(project: Project, updates: ProjectUpdatePayload): ProjectMutationChange[] {
  const fields = Object.keys(PROJECT_MUTATION_FIELD_KIND_MAP) as ProjectMutationField[];
  const changes: ProjectMutationChange[] = [];

  for (const field of fields) {
    if (!(field in updates)) continue;

    const previousValue = normalizeComparable(field, project[field as keyof Project]);
    const nextValue = normalizeComparable(field, updates[field]);

    if (previousValue === nextValue) continue;

    changes.push({
      field,
      kind: PROJECT_MUTATION_FIELD_KIND_MAP[field],
      previousValue,
      nextValue,
    });
  }

  return changes;
}

function getCompanyLinkChangeType(changes: ReadonlyArray<ProjectMutationChange>): ProjectCompanyLinkChangeType {
  const linkChange = changes.find((change) => change.field === 'linkedCompanyId');
  if (!linkChange) return 'none';
  if (!linkChange.previousValue && linkChange.nextValue) return 'link';
  if (linkChange.previousValue && !linkChange.nextValue) return 'unlink';
  return 'reassign';
}

function toDependency(id: ProjectMutationDependencyId, count: number, mode: 'warn' | 'block'): ProjectMutationDependency | null {
  if (count <= 0) return null;
  return { id, count, mode };
}

async function countProjectPaymentPlans(projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const propertiesSnap = await db
    .collection(COLLECTIONS.PROPERTIES)
    .where('projectId', '==', projectId)
    .select()
    .get();

  if (propertiesSnap.empty) return 0;

  const planSnapshots = await Promise.all(
    propertiesSnap.docs.map((propertyDoc) =>
      db.collection(COLLECTIONS.PROPERTIES)
        .doc(propertyDoc.id)
        .collection(SUBCOLLECTIONS.PROPERTY_PAYMENT_PLANS)
        .select()
        .get()
    )
  );

  return planSnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0);
}

async function countDirectCollection(collection: string, field: string, projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(collection).where(field, '==', projectId).select().get();
  return snapshot.size;
}

async function countContactLinks(projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(COLLECTIONS.CONTACT_LINKS)
    .where('targetEntityType', '==', 'project')
    .where('targetEntityId', '==', projectId)
    .where('status', '==', 'active')
    .select()
    .get();
  return snapshot.size;
}

async function collectDependencyCounts(projectId: string): Promise<Record<ProjectMutationDependencyId, number>> {
  const [
    buildings,
    properties,
    propertyPaymentPlans,
    contactLinks,
    communications,
    obligations,
    legalContracts,
    ownershipTables,
    purchaseOrders,
    attendanceEvents,
    employmentRecords,
    accountingInvoices,
    files,
    boqItems,
  ] = await Promise.all([
    countDirectCollection(COLLECTIONS.BUILDINGS, 'projectId', projectId),
    countDirectCollection(COLLECTIONS.PROPERTIES, 'projectId', projectId),
    countProjectPaymentPlans(projectId),
    countContactLinks(projectId),
    countDirectCollection(COLLECTIONS.COMMUNICATIONS, 'projectId', projectId),
    countDirectCollection(COLLECTIONS.OBLIGATIONS, 'projectId', projectId),
    countDirectCollection(COLLECTIONS.LEGAL_CONTRACTS, 'projectId', projectId),
    countDirectCollection(COLLECTIONS.OWNERSHIP_TABLES, 'projectId', projectId),
    countDirectCollection(COLLECTIONS.PURCHASE_ORDERS, 'projectId', projectId),
    countDirectCollection(COLLECTIONS.ATTENDANCE_EVENTS, 'projectId', projectId),
    countDirectCollection(COLLECTIONS.EMPLOYMENT_RECORDS, 'projectId', projectId),
    countDirectCollection(COLLECTIONS.ACCOUNTING_INVOICES, 'projectId', projectId),
    countDirectCollection(COLLECTIONS.FILES, 'projectId', projectId),
    countDirectCollection(COLLECTIONS.BOQ_ITEMS, 'projectId', projectId),
  ]);

  return {
    buildings,
    properties,
    propertyPaymentPlans,
    contactLinks,
    communications,
    obligations,
    legalContracts,
    ownershipTables,
    purchaseOrders,
    attendanceEvents,
    employmentRecords,
    accountingInvoices,
    files,
    boqItems,
  };
}

function buildDependencies(
  dependencyCounts: Record<ProjectMutationDependencyId, number>,
  companyLinkChange: ProjectCompanyLinkChangeType,
  mutationKinds: ReadonlyArray<ProjectMutationKind>,
): ProjectMutationDependency[] {
  const dependencies: ProjectMutationDependency[] = [];
  const companyChangeIsHighRisk = companyLinkChange === 'unlink' || companyLinkChange === 'reassign';

  for (const [dependencyId, count] of Object.entries(dependencyCounts) as Array<[ProjectMutationDependencyId, number]>) {
    if (count <= 0) continue;

    let mode: 'warn' | 'block' = 'warn';
    if (mutationKinds.includes('companyLink') && companyChangeIsHighRisk && BLOCKING_COMPANY_CHANGE_DEPENDENCIES.has(dependencyId)) {
      mode = 'block';
    }

    const dependency = toDependency(dependencyId, count, mode);
    if (dependency) dependencies.push(dependency);
  }

  return dependencies;
}

export async function previewProjectMutationImpact(
  project: Project,
  updates: ProjectUpdatePayload,
): Promise<ProjectMutationImpactPreview> {
  try {
    const changes = buildChanges(project, updates);
    if (changes.length === 0) {
      return {
        mode: 'allow',
        mutationKinds: [],
        changes: [],
        dependencies: [],
        companyLinkChange: 'none',
        messageKey: 'impactGuard.messages.allow',
        blockingCount: 0,
        warningCount: 0,
      };
    }

    const mutationKinds = Array.from(new Set(changes.map((change) => change.kind)));
    const companyLinkChange = getCompanyLinkChangeType(changes);
    const dependencyCounts = await collectDependencyCounts(project.id);
    const dependencies = buildDependencies(dependencyCounts, companyLinkChange, mutationKinds);
    const blockingCount = dependencies.filter((dependency) => dependency.mode === 'block').length;
    const warningCount = dependencies.filter((dependency) => dependency.mode === 'warn').length;

    const mode = blockingCount > 0
      ? 'block'
      : warningCount > 0
        ? 'warn'
        : 'allow';

    const messageKey = mode === 'block'
      ? 'impactGuard.messages.block'
      : mode === 'warn'
        ? 'impactGuard.messages.warn'
        : 'impactGuard.messages.allow';

    return {
      mode,
      mutationKinds,
      changes,
      dependencies,
      companyLinkChange,
      messageKey,
      blockingCount,
      warningCount,
    };
  } catch (error) {
    logger.warn('Project mutation impact preview failed', { projectId: project.id, error });
    return {
      mode: 'block',
      mutationKinds: [],
      changes: [],
      dependencies: [],
      companyLinkChange: 'none',
      messageKey: 'impactGuard.messages.unavailable',
      blockingCount: 0,
      warningCount: 0,
    };
  }
}
