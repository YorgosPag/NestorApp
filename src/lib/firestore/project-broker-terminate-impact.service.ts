import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  ProjectMutationDependency,
  ProjectMutationImpactPreview,
} from '@/types/project-mutation-impact';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectBrokerTerminateImpact');

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export interface BrokerTerminateImpactRequest {
  readonly agreementId: string;
}

// =============================================================================
// QUERIES
// =============================================================================

async function countPendingCommissions(
  agreementId: string,
  companyId: string,
): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.COMMISSION_RECORDS)
    .where('companyId', '==', companyId)
    .where('brokerageAgreementId', '==', agreementId)
    .where('paymentStatus', '==', 'pending')
    .select()
    .get();
  return snap.size;
}

// =============================================================================
// RULE ENGINE
// =============================================================================

function buildDependencies(
  counts: { pendingCommissions: number },
): { deps: ProjectMutationDependency[]; messageKey: string | null } {
  const deps: ProjectMutationDependency[] = [];
  let messageKey: string | null = null;

  if (counts.pendingCommissions > 0) {
    deps.push({ id: 'commissionRecords', count: counts.pendingCommissions, mode: 'warn' });
    messageKey = 'impactGuard.brokerTerminate.withPendingCommissions';
  }

  return { deps, messageKey };
}

// =============================================================================
// HELPERS
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

export async function previewBrokerTerminateImpact(
  req: BrokerTerminateImpactRequest,
  companyId: string,
): Promise<ProjectMutationImpactPreview> {
  try {
    const pendingCommissions = await countPendingCommissions(req.agreementId, companyId);
    const { deps, messageKey } = buildDependencies({ pendingCommissions });

    if (deps.length === 0) return buildAllowPreview();

    const warningCount = deps.filter((d) => d.mode === 'warn').length;
    const blockingCount = deps.filter((d) => d.mode === 'block').length;
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
    logger.warn('Broker terminate impact preview failed', { agreementId: req.agreementId, error });
    return buildUnavailablePreview();
  }
}
