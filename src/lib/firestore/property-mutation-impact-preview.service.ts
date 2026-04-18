import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { PropertyMutationImpactPreview, PropertyMutationChange, PropertyMutationDependency, PropertyMutationDependencyId, PropertyMutationKind } from '@/types/property-mutation-impact';

const FIELD_KIND_MAP: Readonly<Record<string, PropertyMutationKind>> = {
  name: 'identity',
  code: 'identity',
  type: 'identity',
  commercialStatus: 'commercial',
  commercial: 'commercial',
  buildingId: 'structure',
  floorId: 'structure',
  floor: 'structure',
  // linkedSpaces is its own kind — adding/removing a parking/storage
  // association does not invalidate files, payments, contracts or invoices.
  // Treating it as `structure` (and therefore triggering the SOLD-lock blocking
  // dependency set) was a false positive that blocked legitimate additions.
  linkedSpaces: 'linkedSpaces',
  areas: 'features',
  layout: 'features',
  orientations: 'features',
  condition: 'features',
  energy: 'features',
  systemsOverride: 'features',
  finishes: 'features',
  interiorFeatures: 'features',
  securityFeatures: 'features',
};

const BLOCKING_DEPENDENCIES_FOR_STRUCTURE: ReadonlySet<PropertyMutationDependencyId> = new Set([
  'paymentPlans',
  'payments',
  'cheques',
  'legalContracts',
  'accountingInvoices',
  'files',
]);

function normalizeValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function buildChanges(
  property: Record<string, unknown>,
  updates: Record<string, unknown>,
): PropertyMutationChange[] {
  const changes: PropertyMutationChange[] = [];

  for (const [field, kind] of Object.entries(FIELD_KIND_MAP)) {
    if (!(field in updates)) {
      continue;
    }

    const previousValue = normalizeValue(property[field]);
    const nextValue = normalizeValue(updates[field]);
    if (previousValue === nextValue) {
      continue;
    }

    changes.push({
      field,
      kind,
      previousValue,
      nextValue,
    });
  }

  return changes;
}

async function countPropertyPaymentPlans(propertyId: string): Promise<number> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(COLLECTIONS.PROPERTIES)
    .doc(propertyId)
    .collection(SUBCOLLECTIONS.PROPERTY_PAYMENT_PLANS)
    .select()
    .get();

  return snapshot.size;
}

async function countPropertyPayments(propertyId: string): Promise<number> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(COLLECTIONS.PROPERTIES)
    .doc(propertyId)
    .collection(SUBCOLLECTIONS.PROPERTY_PAYMENTS)
    .select()
    .get();

  return snapshot.size;
}

async function countDirectCollection(
  collection: string,
  field: string,
  propertyId: string,
): Promise<number> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(collection).where(field, '==', propertyId).select().get();
  return snapshot.size;
}

async function countFiles(propertyId: string): Promise<number> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(COLLECTIONS.FILES)
    .where('entityType', '==', 'property')
    .where('entityId', '==', propertyId)
    .where('isDeleted', '==', false)
    .select()
    .get();
  return snapshot.size;
}

async function collectDependencyCounts(propertyId: string): Promise<Record<PropertyMutationDependencyId, number>> {
  const [paymentPlans, payments, cheques, legalContracts, accountingInvoices, files] = await Promise.all([
    countPropertyPaymentPlans(propertyId),
    countPropertyPayments(propertyId),
    countDirectCollection(COLLECTIONS.CHEQUES, 'propertyId', propertyId),
    countDirectCollection(COLLECTIONS.LEGAL_CONTRACTS, 'propertyId', propertyId),
    countDirectCollection(COLLECTIONS.ACCOUNTING_INVOICES, 'propertyId', propertyId),
    countFiles(propertyId),
  ]);

  return {
    paymentPlans,
    payments,
    cheques,
    legalContracts,
    accountingInvoices,
    files,
  };
}

function buildDependencies(
  dependencyCounts: Record<PropertyMutationDependencyId, number>,
  mutationKinds: ReadonlyArray<PropertyMutationKind>,
): PropertyMutationDependency[] {
  const dependencies: PropertyMutationDependency[] = [];
  const isStructureChange = mutationKinds.includes('structure');
  const isCommercialChange = mutationKinds.includes('commercial');

  for (const [id, count] of Object.entries(dependencyCounts) as Array<[PropertyMutationDependencyId, number]>) {
    if (count <= 0) {
      continue;
    }

    let mode: 'warn' | 'block' = 'warn';
    if (isStructureChange && BLOCKING_DEPENDENCIES_FOR_STRUCTURE.has(id)) {
      mode = 'block';
    } else if (isCommercialChange) {
      mode = 'warn';
    }

    dependencies.push({ id, count, mode });
  }

  return dependencies;
}

export async function previewPropertyMutationImpact(
  propertyId: string,
  property: Record<string, unknown>,
  updates: Record<string, unknown>,
): Promise<PropertyMutationImpactPreview> {
  try {
    const changes = buildChanges(property, updates);
    if (changes.length === 0) {
      return {
        mode: 'allow',
        mutationKinds: [],
        changes: [],
        dependencies: [],
        messageKey: 'mutationImpact.allow',
        blockingCount: 0,
        warningCount: 0,
      };
    }

    const mutationKinds = Array.from(new Set(changes.map((change) => change.kind)));
    const dependencyCounts = await collectDependencyCounts(propertyId);
    const dependencies = buildDependencies(dependencyCounts, mutationKinds);
    const blockingCount = dependencies.filter((dependency) => dependency.mode === 'block').length;
    const warningCount = dependencies.filter((dependency) => dependency.mode === 'warn').length;

    const mode = blockingCount > 0
      ? 'block'
      : warningCount > 0
        ? 'warn'
        : 'allow';

    const messageKey = mode === 'block'
      ? 'mutationImpact.block'
      : mode === 'warn'
        ? 'mutationImpact.warn'
        : 'mutationImpact.allow';

    return {
      mode,
      mutationKinds,
      changes,
      dependencies,
      messageKey,
      blockingCount,
      warningCount,
    };
  } catch {
    return {
      mode: 'block',
      mutationKinds: [],
      changes: [],
      dependencies: [],
      messageKey: 'mutationImpact.unavailable',
      blockingCount: 0,
      warningCount: 0,
    };
  }
}
