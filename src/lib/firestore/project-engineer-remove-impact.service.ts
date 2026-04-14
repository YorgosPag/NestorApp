import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  ProjectMutationDependency,
  ProjectMutationImpactPreview,
} from '@/types/project-mutation-impact';
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

export async function previewEngineerRemoveImpact(
  projectId: string,
  req: EngineerRemoveImpactRequest,
): Promise<ProjectMutationImpactPreview> {
  try {
    const obligations = await countAssignedObligations(projectId, req.contactId);
    const { deps, messageKey } = buildDependencies({ obligations });

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
    logger.warn('Engineer remove impact preview failed', { projectId, contactId: req.contactId, error });
    return buildUnavailablePreview();
  }
}
