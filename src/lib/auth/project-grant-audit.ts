import 'server-only';

/**
 * Η ΓΡΑΜΜΗ ΣΤΟ ΒΙΒΛΙΟ ΑΣΦΑΛΕΙΑΣ όταν εγγραφή την έδωσε ο ρόλος έργου (ADR-926 Κ8).
 *
 * Ένας γραφέας για το `withAuth` και για όσα κρίνονται μέσα στον handler (επαναφορά, στόχος μεταφοράς κτιρίου).
 * Γράφεται αφού πετύχει η πράξη: το βιβλίο λέει τι έγινε, όχι τι ζητήθηκε.
 *
 * @module lib/auth/project-grant-audit
 */

import { logAuditEvent } from './audit';
import type { PermissionCheckResult } from './permissions';
import type { AuthContext, PermissionId } from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('project-grant-audit');

export interface ProjectGrant {
  readonly projectId: string;
  readonly permission: PermissionId;
  readonly source: 'project_role' | 'permission_set';
}

/** Η ετυμηγορία ως γραμμή: `null` όταν την έδωσε η εταιρεία, ή όταν δεν κρίθηκε έργο. */
export function projectGrantOf(
  decision: PermissionCheckResult,
  permission: PermissionId,
  projectId: string | undefined,
): ProjectGrant | null {
  if (!projectId) return null;
  return decision.source === 'project_role' || decision.source === 'permission_set'
    ? { projectId, permission, source: decision.source }
    : null;
}

export async function recordProjectGrants(grants: readonly ProjectGrant[], path: string, ctx: AuthContext): Promise<void> {
  for (const grant of grants) {
    logger.info('Project role exercised', { uid: ctx.uid, ...grant });
    await logAuditEvent(ctx, 'project_role_exercised', grant.projectId, 'project', {
      metadata: { path, reason: `${grant.permission} via ${grant.source}` },
    });
  }
}
