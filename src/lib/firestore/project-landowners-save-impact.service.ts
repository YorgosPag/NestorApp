import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  ProjectMutationDependency,
  ProjectMutationImpactPreview,
} from '@/types/project-mutation-impact';
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

export async function previewLandownersSaveImpact(
  projectId: string,
  req: LandownersSaveImpactRequest,
): Promise<ProjectMutationImpactPreview> {
  try {
    const ownershipTables = await countOwnershipTables(projectId);
    const { deps, messageKey } = buildDependencies({ ownershipTables }, req);

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
    logger.warn('Landowners save impact preview failed', { projectId, error });
    return buildUnavailablePreview();
  }
}
