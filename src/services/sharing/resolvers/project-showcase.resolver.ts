/**
 * =============================================================================
 * PROJECT SHOWCASE SHARE RESOLVER (ADR-316)
 * =============================================================================
 *
 * Resolves `entityType: 'project_showcase'` shares. Mirrors the structure of
 * property-showcase.resolver.ts (ADR-315) for Project entities.
 *
 * Policy:
 *   - canShare: same-tenant user with access to the project
 *   - validateCreateInput: require `projectId` + `showcaseMeta.pdfStoragePath`
 *   - resolve: fetch project summary + PDF storage path
 *   - safePublicProjection: exposes project id + PDF path but not companyId
 *
 * @module services/sharing/resolvers/project-showcase.resolver
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  AuthorizedUser,
  CreateShareInput,
  PublicShareData,
  ShareEntityDefinition,
  ShareRecord,
  ValidationResult,
} from '@/types/sharing';

const logger = createModuleLogger('ProjectShowcaseShareResolver');

export interface ProjectShowcaseResolvedData {
  shareId: string;
  token: string;
  projectId: string;
  projectTitle: string | null;
  pdfStoragePath: string | null;
  pdfRegeneratedAt: string | null;
  note: string | null;
}

async function resolveShowcase(
  share: ShareRecord,
): Promise<ProjectShowcaseResolvedData> {
  const ref = doc(db, COLLECTIONS.PROJECTS, share.entityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    logger.warn('Showcase share points to missing project', {
      shareId: share.id,
      projectId: share.entityId,
    });
  }
  const data = snap.exists() ? snap.data() : null;

  const regen = share.showcaseMeta?.pdfRegeneratedAt;
  const regenIso =
    regen && typeof regen === 'object' && 'toDate' in regen
      ? (regen as { toDate: () => Date }).toDate().toISOString()
      : typeof regen === 'string'
        ? regen
        : null;

  return {
    shareId: share.id,
    token: share.token,
    projectId: share.entityId,
    projectTitle:
      (data?.name as string | undefined) ??
      (data?.title as string | undefined) ??
      null,
    pdfStoragePath: share.showcaseMeta?.pdfStoragePath ?? null,
    pdfRegeneratedAt: regenIso,
    note: share.note ?? null,
  };
}

function safePublicProjection(share: ShareRecord): PublicShareData {
  return {
    entityType: share.entityType,
    entityId: share.entityId,
    requiresPassword: share.requiresPassword,
    expiresAt: share.expiresAt,
    isActive: share.isActive,
    accessCount: share.accessCount,
    maxAccesses: share.maxAccesses,
    note: share.note ?? null,
    showcaseMeta: share.showcaseMeta ?? null,
  };
}

function validateCreateInput(input: CreateShareInput): ValidationResult {
  if (input.entityType !== 'project_showcase') {
    return {
      valid: false,
      reason: 'Wrong resolver — expected entityType=project_showcase',
    };
  }
  if (!input.entityId?.trim()) return { valid: false, reason: 'projectId required' };
  if (!input.companyId?.trim()) return { valid: false, reason: 'companyId required' };
  if (!input.createdBy?.trim()) return { valid: false, reason: 'createdBy required' };
  if (!input.showcaseMeta?.pdfStoragePath?.trim()) {
    return {
      valid: false,
      reason: 'showcaseMeta.pdfStoragePath required',
    };
  }
  return { valid: true };
}

async function canShare(user: AuthorizedUser, entityId: string): Promise<boolean> {
  if (!user?.uid || !user?.companyId) return false;
  const ref = doc(db, COLLECTIONS.PROJECTS, entityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const projectCompanyId = snap.data().companyId as string | undefined;
  return projectCompanyId === user.companyId;
}

export const projectShowcaseShareResolver: ShareEntityDefinition<ProjectShowcaseResolvedData> = {
  resolve: resolveShowcase,
  safePublicProjection,
  validateCreateInput,
  canShare,
  renderPublic: () => null, // Wired in F5 (public route dispatcher)
};
