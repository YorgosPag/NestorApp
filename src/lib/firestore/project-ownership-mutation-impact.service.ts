import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type {
  ProjectMutationDependency,
  ProjectMutationDependencyMode,
  ProjectMutationImpactPreview,
} from '@/types/project-mutation-impact';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectOwnershipMutationImpact');

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export type OwnershipOperation = 'finalize' | 'unlock';

export interface OwnershipImpactRequest {
  readonly operation: OwnershipOperation;
  /** Ownership table Firestore document ID */
  readonly tableId: string;
  /** Current version (0 = never finalized before; >0 = re-finalization) */
  readonly tableVersion: number;
  /** Current lifecycle status */
  readonly tableStatus: 'draft' | 'finalized' | 'registered';
}

// =============================================================================
// QUERIES — lightweight, only what is needed for ownership guard
// =============================================================================

async function countSoldProperties(projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.PROPERTIES)
    .where('projectId', '==', projectId)
    .where('commercialStatus', '==', 'sold')
    .select()
    .get();
  return snap.size;
}

async function countLegalContracts(projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.LEGAL_CONTRACTS)
    .where('projectId', '==', projectId)
    .select()
    .get();
  return snap.size;
}

async function countPropertyPaymentPlans(projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const propertiesSnap = await db
    .collection(COLLECTIONS.PROPERTIES)
    .where('projectId', '==', projectId)
    .select()
    .get();

  if (propertiesSnap.empty) return 0;

  const planSnapshots = await Promise.all(
    propertiesSnap.docs.map((propertyDoc) =>
      db
        .collection(COLLECTIONS.PROPERTIES)
        .doc(propertyDoc.id)
        .collection(SUBCOLLECTIONS.PROPERTY_PAYMENT_PLANS)
        .select()
        .get(),
    ),
  );

  return planSnapshots.reduce((sum, snap) => sum + snap.size, 0);
}

interface OwnershipImpactCounts {
  readonly soldProperties: number;
  readonly legalContracts: number;
  readonly propertyPaymentPlans: number;
}

async function collectCounts(projectId: string): Promise<OwnershipImpactCounts> {
  const [soldProperties, legalContracts, propertyPaymentPlans] = await Promise.all([
    countSoldProperties(projectId),
    countLegalContracts(projectId),
    countPropertyPaymentPlans(projectId),
  ]);
  return { soldProperties, legalContracts, propertyPaymentPlans };
}

// =============================================================================
// RULE ENGINE
// =============================================================================

type OwnershipDepId = 'soldProperties' | 'legalContracts' | 'propertyPaymentPlans';

function makeDep(
  id: OwnershipDepId,
  count: number,
  mode: ProjectMutationDependencyMode,
): ProjectMutationDependency {
  return { id, count, mode };
}

interface RuleResult {
  readonly deps: ProjectMutationDependency[];
  readonly messageKey: string | null;
  readonly forcedBlock: boolean;
  /** Force warn dialog even when deps is empty (alwaysNotify pattern — ADR-302 §5.3.2) */
  readonly forcedWarn: boolean;
}

function buildDependencies(
  req: OwnershipImpactRequest,
  counts: OwnershipImpactCounts,
): RuleResult {
  const deps: ProjectMutationDependency[] = [];
  let messageKey: string | null = null;
  let forcedBlock = false;
  let forcedWarn = false;

  switch (req.operation) {
    // ── FINALIZE ─────────────────────────────────────────────────────────────
    //
    // finalizeTable() writes millesimalShares + commercial.owners to:
    //   - properties  (each row with entityRef.collection === 'properties')
    //   - storage_units (rows with hasOwnShares === true)
    //   - parking_spots (informational rows)
    // Re-finalization (version > 0) overwrites existing shares in those docs.
    case 'finalize': {
      // BLOCK: sold units have notarial obligations — shares cannot be rewritten
      if (counts.soldProperties > 0) {
        forcedBlock = true;
        deps.push(makeDep('soldProperties', counts.soldProperties, 'block'));
        messageKey = 'impactGuard.ownershipMutation.finalizeSoldProperties';
        break;
      }

      // WARN: legal contracts reference millesimalShares indirectly via properties
      if (counts.legalContracts > 0) {
        deps.push(makeDep('legalContracts', counts.legalContracts, 'warn'));
        if (!messageKey) messageKey = 'impactGuard.ownershipMutation.finalizeWithContracts';
      }

      // WARN: payment plans are tied to properties whose shares will be overwritten
      if (counts.propertyPaymentPlans > 0) {
        deps.push(makeDep('propertyPaymentPlans', counts.propertyPaymentPlans, 'warn'));
        if (!messageKey) messageKey = 'impactGuard.ownershipMutation.finalizeWithPaymentPlans';
      }

      // WARN: re-finalization — millesimalShares in properties/storage will be overwritten
      if (req.tableVersion > 0) {
        forcedWarn = true;
        if (!messageKey) messageKey = 'impactGuard.ownershipMutation.finalizeReFinalize';
      }

      break;
    }

    // ── UNLOCK ───────────────────────────────────────────────────────────────
    //
    // unlockTable() reverts status to 'draft' and bumps version.
    // Any subsequent finalization will overwrite shares in 3 collections.
    case 'unlock': {
      // BLOCK: land registry completed (KAEK codes) — legally immutable
      if (req.tableStatus === 'registered') {
        forcedBlock = true;
        messageKey = 'impactGuard.ownershipMutation.unlockRegistered';
        break;
      }

      // BLOCK: units already sold — notarial deeds signed with these shares
      if (counts.soldProperties > 0) {
        forcedBlock = true;
        deps.push(makeDep('soldProperties', counts.soldProperties, 'block'));
        messageKey = 'impactGuard.ownershipMutation.unlockSoldProperties';
        break;
      }

      // WARN: legal contracts reference the finalized millesimalShares
      if (counts.legalContracts > 0) {
        deps.push(makeDep('legalContracts', counts.legalContracts, 'warn'));
        messageKey = 'impactGuard.ownershipMutation.unlockWithContracts';
      }

      // Always notify on unlock — significant event regardless of dependency count
      forcedWarn = true;
      if (!messageKey) messageKey = 'impactGuard.ownershipMutation.unlockWithHistory';

      break;
    }
  }

  return { deps, messageKey, forcedBlock, forcedWarn };
}

// =============================================================================
// PREVIEW BUILDERS
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

// =============================================================================
// PUBLIC API
// =============================================================================

export async function previewOwnershipMutationImpact(
  projectId: string,
  req: OwnershipImpactRequest,
): Promise<ProjectMutationImpactPreview> {
  try {
    const counts = await collectCounts(projectId);
    const { deps, messageKey, forcedBlock, forcedWarn } = buildDependencies(req, counts);

    if (forcedBlock) {
      return {
        mode: 'block',
        mutationKinds: [],
        changes: [],
        dependencies: deps,
        companyLinkChange: 'none',
        messageKey: messageKey ?? 'impactGuard.messages.block',
        blockingCount: deps.filter((d) => d.mode === 'block').length,
        warningCount: 0,
      };
    }

    if (deps.length === 0 && !forcedWarn) return buildAllowPreview();

    const blockingCount = deps.filter((d) => d.mode === 'block').length;
    const warningCount = deps.filter((d) => d.mode === 'warn').length;
    const mode = blockingCount > 0 ? 'block' : 'warn';

    return {
      mode,
      mutationKinds: [],
      changes: [],
      dependencies: deps,
      companyLinkChange: 'none',
      messageKey: messageKey ?? 'impactGuard.messages.warn',
      blockingCount,
      warningCount,
    };
  } catch (error) {
    logger.warn('Ownership mutation impact preview failed', { projectId, error });
    return buildUnavailablePreview();
  }
}
