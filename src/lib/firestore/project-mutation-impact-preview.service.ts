import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { Project, ProjectStatus } from '@/types/project';
import type { ProjectUpdatePayload } from '@/services/projects-client.service';
import type {
  ProjectMutationChange,
  ProjectMutationDependency,
  ProjectMutationDependencyMode,
  ProjectMutationImpactPreview,
  ProjectCompanyLinkChangeType,
} from '@/types/project-mutation-impact';
import {
  PROJECT_MUTATION_FIELD_KIND_MAP,
  PROJECT_STATUS_TRANSITION_REGISTRY,
  type DirectionalTransitionRule,
  type ProjectMutationDependencyId,
  type ProjectMutationField,
  type ProjectMutationKind,
  type StatusTransitionTarget,
  type TransitionDependencyMode,
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

const MODE_RANK: Record<ProjectMutationDependencyMode, number> = { info: 1, warn: 2, block: 3 };

function mergeModeMap(
  map: Map<ProjectMutationDependencyId, ProjectMutationDependencyMode>,
  id: ProjectMutationDependencyId,
  mode: ProjectMutationDependencyMode,
): void {
  const existing = map.get(id);
  if (!existing || MODE_RANK[mode] > MODE_RANK[existing]) {
    map.set(id, mode);
  }
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

async function countSoldProperties(projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.PROPERTIES)
    .where('projectId', '==', projectId)
    .where('commercialStatus', '==', 'sold')
    .select()
    .get();
  return snapshot.size;
}

async function countCalendarEvents(projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.CALENDAR)
    .where('projectId', '==', projectId)
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
    soldProperties,
    calendarEvents,
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
    countSoldProperties(projectId),
    countCalendarEvents(projectId),
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
    soldProperties,
    calendarEvents,
    employmentRecordsGlobal: 0,
    commissionRecords: 0,
  };
}

interface BuildDependenciesResult {
  readonly deps: ProjectMutationDependency[];
  readonly forcedWarn: boolean;
  readonly messageKeyOverride: string | null;
}

function applyDirectionalRule(
  rule: DirectionalTransitionRule,
  counts: Record<ProjectMutationDependencyId, number>,
  modeMap: Map<ProjectMutationDependencyId, ProjectMutationDependencyMode>,
): void {
  // Normal deps: show when count > 0
  for (const [depId, mode] of Object.entries(rule.dependencies) as Array<[ProjectMutationDependencyId, TransitionDependencyMode]>) {
    const count = counts[depId] ?? 0;
    if (count > 0) mergeModeMap(modeMap, depId, mode);
  }
  // Zero-count deps: show proactively when count = 0 (checklist pattern)
  if (rule.zeroCountDeps) {
    for (const [depId, mode] of Object.entries(rule.zeroCountDeps) as Array<[ProjectMutationDependencyId, TransitionDependencyMode]>) {
      const count = counts[depId] ?? 0;
      if (count === 0) modeMap.set(depId, mode);
    }
  }
}

function buildDependencies(
  dependencyCounts: Record<ProjectMutationDependencyId, number>,
  companyLinkChange: ProjectCompanyLinkChangeType,
  mutationKinds: ReadonlyArray<ProjectMutationKind>,
  changes: ReadonlyArray<ProjectMutationChange>,
): BuildDependenciesResult {
  const modeMap = new Map<ProjectMutationDependencyId, ProjectMutationDependencyMode>();
  let forcedWarn = false;
  let messageKeyOverride: string | null = null;

  const companyChangeIsHighRisk = companyLinkChange === 'unlink' || companyLinkChange === 'reassign';

  // ── COMPANY LINK (invariato) ───────────────────────────────────────────────
  if (mutationKinds.includes('companyLink')) {
    for (const [depId, count] of Object.entries(dependencyCounts) as Array<[ProjectMutationDependencyId, number]>) {
      if (count <= 0) continue;
      const mode: ProjectMutationDependencyMode =
        companyChangeIsHighRisk && BLOCKING_COMPANY_CHANGE_DEPENDENCIES.has(depId) ? 'block' : 'warn';
      mergeModeMap(modeMap, depId, mode);
    }
  }

  // ── PROJECT STATUS ─────────────────────────────────────────────────────────
  if (mutationKinds.includes('projectStatus')) {
    const statusChange = changes.find((c) => c.field === 'status');
    const toStatus = statusChange?.nextValue as ProjectStatus | null | undefined;
    const fromStatus = statusChange?.previousValue as ProjectStatus | null | undefined;

    if (toStatus) {
      // byTarget rules (from-agnostic)
      const byTargetRules = PROJECT_STATUS_TRANSITION_REGISTRY.byTarget[toStatus as StatusTransitionTarget];
      if (byTargetRules) {
        for (const [depId, mode] of Object.entries(byTargetRules) as Array<[ProjectMutationDependencyId, TransitionDependencyMode]>) {
          const count = dependencyCounts[depId] ?? 0;
          if (count > 0) mergeModeMap(modeMap, depId, mode);
        }
        const byTargetKey = PROJECT_STATUS_TRANSITION_REGISTRY.byTargetMessageKeys[toStatus as StatusTransitionTarget];
        if (byTargetKey) messageKeyOverride = byTargetKey;
      }

      // Directional rules (from + to must both match)
      if (fromStatus) {
        for (const rule of PROJECT_STATUS_TRANSITION_REGISTRY.directional) {
          if (!rule.from.includes(fromStatus) || !rule.to.includes(toStatus)) continue;
          applyDirectionalRule(rule, dependencyCounts, modeMap);
          if (rule.alwaysNotify) forcedWarn = true;
          if (rule.messageKey) messageKeyOverride = rule.messageKey;
        }
      }
    }
  }

  // ── PROJECT IDENTITY (name / title / description) ──────────────────────────
  if (mutationKinds.includes('projectIdentity')) {
    if ((dependencyCounts.legalContracts ?? 0) > 0) mergeModeMap(modeMap, 'legalContracts', 'warn');
    if ((dependencyCounts.calendarEvents ?? 0) > 0) mergeModeMap(modeMap, 'calendarEvents', 'info');
  }

  // ── PERMIT METADATA ────────────────────────────────────────────────────────
  if (mutationKinds.includes('permitMetadata')) {
    if ((dependencyCounts.legalContracts ?? 0) > 0) mergeModeMap(modeMap, 'legalContracts', 'warn');
    if ((dependencyCounts.buildings ?? 0) > 0) mergeModeMap(modeMap, 'buildings', 'info');
  }

  // Build deps array from modeMap
  const deps: ProjectMutationDependency[] = [];
  for (const [id, mode] of modeMap) {
    deps.push({ id, count: dependencyCounts[id] ?? 0, mode });
  }

  return { deps, forcedWarn, messageKeyOverride };
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
    const { deps: dependencies, forcedWarn, messageKeyOverride } = buildDependencies(
      dependencyCounts,
      companyLinkChange,
      mutationKinds,
      changes,
    );
    const blockingCount = dependencies.filter((dependency) => dependency.mode === 'block').length;
    const warningCount = dependencies.filter((dependency) => dependency.mode === 'warn').length;

    const mode = blockingCount > 0
      ? 'block'
      : (warningCount > 0 || forcedWarn)
        ? 'warn'
        : 'allow';

    const defaultMessageKey = mode === 'block'
      ? 'impactGuard.messages.block'
      : mode === 'warn'
        ? 'impactGuard.messages.warn'
        : 'impactGuard.messages.allow';

    const messageKey = messageKeyOverride ?? defaultMessageKey;

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
