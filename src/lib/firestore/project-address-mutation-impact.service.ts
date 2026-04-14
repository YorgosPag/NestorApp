import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Project } from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
import type {
  ProjectMutationDependency,
  ProjectMutationDependencyMode,
  ProjectMutationImpactPreview,
} from '@/types/project-mutation-impact';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectAddressMutationImpact');

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export type ProjectAddressOperation = 'add' | 'edit' | 'delete' | 'set-primary';

export interface ProjectAddressMutationRequest {
  readonly operation: ProjectAddressOperation;
  /** New address state (or address being deleted) */
  readonly address: ProjectAddress;
  /** Previous address state — required for 'edit' operation */
  readonly previousAddress?: ProjectAddress;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Core fields: change triggers delivery/primary downstream checks */
const CORE_ADDRESS_FIELDS: ReadonlySet<keyof ProjectAddress> = new Set([
  'street',
  'number',
  'postalCode',
  'city',
]);

// =============================================================================
// QUERIES — lightweight, only what is needed for address guard
// =============================================================================

async function countPurchaseOrders(projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.PURCHASE_ORDERS)
    .where('projectId', '==', projectId)
    .select()
    .get();
  return snap.size;
}

async function countBuildings(projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.BUILDINGS)
    .where('projectId', '==', projectId)
    .select()
    .get();
  return snap.size;
}

interface AddressImpactCounts {
  readonly purchaseOrders: number;
  readonly buildings: number;
}

async function collectCounts(projectId: string): Promise<AddressImpactCounts> {
  const [purchaseOrders, buildings] = await Promise.all([
    countPurchaseOrders(projectId),
    countBuildings(projectId),
  ]);
  return { purchaseOrders, buildings };
}

// =============================================================================
// RULE ENGINE
// =============================================================================

function makeDep(
  id: 'purchaseOrders' | 'buildings',
  count: number,
  mode: ProjectMutationDependencyMode,
): ProjectMutationDependency {
  return { id, count, mode };
}

function hasCoreChange(prev: ProjectAddress, next: ProjectAddress): boolean {
  return Array.from(CORE_ADDRESS_FIELDS).some(
    (field) => prev[field] !== next[field],
  );
}

function buildDependencies(
  op: ProjectAddressOperation,
  address: ProjectAddress,
  previousAddress: ProjectAddress | undefined,
  counts: AddressImpactCounts,
): { deps: ProjectMutationDependency[]; messageKey: string | null; forcedBlock: boolean } {
  const deps: ProjectMutationDependency[] = [];
  let messageKey: string | null = null;
  let forcedBlock = false;

  switch (op) {
    // ── ADD ──────────────────────────────────────────────────────────────────
    case 'add': {
      if (address.isPrimary && counts.buildings > 0) {
        deps.push(makeDep('buildings', counts.buildings, 'warn'));
        messageKey = 'impactGuard.addressMutation.setPrimary';
      }
      break;
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    case 'delete': {
      if (address.isPrimary) {
        forcedBlock = true;
        messageKey = 'impactGuard.addressMutation.deletePrimaryBlocked';
        break;
      }
      if (address.type === 'delivery' && counts.purchaseOrders > 0) {
        deps.push(makeDep('purchaseOrders', counts.purchaseOrders, 'warn'));
        messageKey = 'impactGuard.addressMutation.deleteDelivery';
      }
      break;
    }

    // ── SET-PRIMARY ───────────────────────────────────────────────────────────
    case 'set-primary': {
      if (counts.buildings > 0) {
        deps.push(makeDep('buildings', counts.buildings, 'warn'));
      }
      messageKey = 'impactGuard.addressMutation.setPrimary';
      break;
    }

    // ── EDIT ──────────────────────────────────────────────────────────────────
    case 'edit': {
      if (!previousAddress) break;

      const coreChanged = hasCoreChange(previousAddress, address);
      const typeChanged = previousAddress.type !== address.type;
      const primaryChanged = previousAddress.isPrimary !== address.isPrimary;

      // Core field change on delivery address → stale PO delivery addresses
      if (coreChanged && address.type === 'delivery' && counts.purchaseOrders > 0) {
        deps.push(makeDep('purchaseOrders', counts.purchaseOrders, 'warn'));
        messageKey = 'impactGuard.addressMutation.editDelivery';
      }

      // Core field change on primary address → buildings see different address
      if (coreChanged && address.isPrimary && counts.buildings > 0) {
        deps.push(makeDep('buildings', counts.buildings, 'info'));
        if (!messageKey) messageKey = 'impactGuard.addressMutation.editPrimary';
      }

      // Type changed FROM delivery → POs reference now-reclassified address
      if (typeChanged && previousAddress.type === 'delivery' && counts.purchaseOrders > 0) {
        // Promote to warn if not already present
        const existing = deps.find((d) => d.id === 'purchaseOrders');
        if (!existing) {
          deps.push(makeDep('purchaseOrders', counts.purchaseOrders, 'warn'));
        }
        if (!messageKey) messageKey = 'impactGuard.addressMutation.reclassifyDelivery';
      }

      // isPrimary set to true → buildings inherit this address
      if (primaryChanged && address.isPrimary && counts.buildings > 0) {
        const existing = deps.find((d) => d.id === 'buildings');
        if (!existing) {
          deps.push(makeDep('buildings', counts.buildings, 'warn'));
        }
        if (!messageKey) messageKey = 'impactGuard.addressMutation.setPrimary';
      }

      break;
    }
  }

  return { deps, messageKey, forcedBlock };
}

// =============================================================================
// PUBLIC API
// =============================================================================

function buildAllowPreview(): ProjectMutationImpactPreview {
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

function buildUnavailablePreview(): ProjectMutationImpactPreview {
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

export async function previewProjectAddressMutationImpact(
  project: Project,
  request: ProjectAddressMutationRequest,
): Promise<ProjectMutationImpactPreview> {
  try {
    const counts = await collectCounts(project.id);
    const { deps, messageKey, forcedBlock } = buildDependencies(
      request.operation,
      request.address,
      request.previousAddress,
      counts,
    );

    if (forcedBlock) {
      return {
        mode: 'block',
        mutationKinds: [],
        changes: [],
        dependencies: deps,
        companyLinkChange: 'none',
        messageKey: messageKey ?? 'impactGuard.messages.block',
        blockingCount: 0,
        warningCount: 0,
      };
    }

    if (deps.length === 0) return buildAllowPreview();

    const blockingCount = deps.filter((d) => d.mode === 'block').length;
    const warningCount = deps.filter((d) => d.mode === 'warn').length;
    const mode = blockingCount > 0 ? 'block' : warningCount > 0 ? 'warn' : 'allow';

    const defaultMessageKey = mode === 'block'
      ? 'impactGuard.messages.block'
      : mode === 'warn'
        ? 'impactGuard.messages.warn'
        : 'impactGuard.messages.allow';

    return {
      mode,
      mutationKinds: [],
      changes: [],
      dependencies: deps,
      companyLinkChange: 'none',
      messageKey: messageKey ?? defaultMessageKey,
      blockingCount,
      warningCount,
    };
  } catch (error) {
    logger.warn('Project address mutation impact preview failed', { projectId: project.id, error });
    return buildUnavailablePreview();
  }
}
