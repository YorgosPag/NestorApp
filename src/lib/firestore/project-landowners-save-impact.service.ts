import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  ProjectMutationDependency,
  ProjectMutationImpactPreview,
} from '@/types/project-mutation-impact';
import { resolveImpactPreview } from '@/lib/firestore/impact-preview-primitives';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectLandownersSaveImpact');

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export interface LandownersSaveImpactRequest {
  readonly landownersChanged: boolean;
  readonly bartexChanged: boolean;
}

// =============================================================================
// QUERIES
// =============================================================================

async function countOwnershipTables(projectId: string): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.OWNERSHIP_TABLES)
    .where('projectId', '==', projectId)
    .select()
    .get();
  return snap.size;
}

// =============================================================================
// RULE ENGINE
// =============================================================================

function buildDependencies(
  counts: { ownershipTables: number },
  req: LandownersSaveImpactRequest,
): { deps: ProjectMutationDependency[]; messageKey: string | null } {
  const deps: ProjectMutationDependency[] = [];
  let messageKey: string | null = null;

  if (counts.ownershipTables > 0) {
    const mode = req.bartexChanged ? 'warn' : 'warn';
    deps.push({ id: 'ownershipTables', count: counts.ownershipTables, mode });
    messageKey = req.bartexChanged
      ? 'impactGuard.landownersSave.withBartexChange'
      : 'impactGuard.landownersSave.withOwnershipTables';
  }

  return { deps, messageKey };
}

// =============================================================================
// PUBLIC API
// =============================================================================

export async function previewLandownersSaveImpact(
  projectId: string,
  req: LandownersSaveImpactRequest,
): Promise<ProjectMutationImpactPreview> {
  return resolveImpactPreview(
    async () => buildDependencies({ ownershipTables: await countOwnershipTables(projectId) }, req),
    (error) => logger.warn('Landowners save impact preview failed', { projectId, error }),
  );
}
