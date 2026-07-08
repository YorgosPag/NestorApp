import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  ProjectMutationDependency,
  ProjectMutationImpactPreview,
} from '@/types/project-mutation-impact';
import { resolveImpactPreview } from '@/lib/firestore/impact-preview-primitives';
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
// PUBLIC API
// =============================================================================

export async function previewBrokerTerminateImpact(
  req: BrokerTerminateImpactRequest,
  companyId: string,
): Promise<ProjectMutationImpactPreview> {
  return resolveImpactPreview(
    async () =>
      buildDependencies({
        pendingCommissions: await countPendingCommissions(req.agreementId, companyId),
      }),
    (error) =>
      logger.warn('Broker terminate impact preview failed', { agreementId: req.agreementId, error }),
  );
}
