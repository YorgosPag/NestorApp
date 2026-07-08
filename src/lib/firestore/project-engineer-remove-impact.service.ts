import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  ProjectMutationDependency,
  ProjectMutationImpactPreview,
} from '@/types/project-mutation-impact';
import { resolveImpactPreview } from '@/lib/firestore/impact-preview-primitives';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectEngineerRemoveImpact');

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export interface EngineerRemoveImpactRequest {
  readonly contactId: string;
  readonly role: string;
}

// =============================================================================
// QUERIES
// =============================================================================

async function countAssignedObligations(
  projectId: string,
  contactId: string,
): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.OBLIGATIONS)
    .where('projectId', '==', projectId)
    .where('assigneeId', '==', contactId)
    .select()
    .get();
  return snap.size;
}

// =============================================================================
// RULE ENGINE
// =============================================================================

function buildDependencies(
  counts: { obligations: number },
): { deps: ProjectMutationDependency[]; messageKey: string | null } {
  const deps: ProjectMutationDependency[] = [];
  let messageKey: string | null = null;

  if (counts.obligations > 0) {
    deps.push({ id: 'obligations', count: counts.obligations, mode: 'warn' });
    messageKey = 'impactGuard.engineerRemove.withObligations';
  }

  return { deps, messageKey };
}

// =============================================================================
// PUBLIC API
// =============================================================================

export async function previewEngineerRemoveImpact(
  projectId: string,
  req: EngineerRemoveImpactRequest,
): Promise<ProjectMutationImpactPreview> {
  return resolveImpactPreview(
    async () =>
      buildDependencies({ obligations: await countAssignedObligations(projectId, req.contactId) }),
    (error) =>
      logger.warn('Engineer remove impact preview failed', {
        projectId,
        contactId: req.contactId,
        error,
      }),
  );
}
