/**
 * =============================================================================
 * BUILDING SHOWCASE SHARE RESOLVER (ADR-320)
 * =============================================================================
 *
 * Resolves `entityType: 'building_showcase'` shares. Mirrors the structure of
 * project-showcase.resolver.ts (ADR-316) for Building entities.
 *
 * Policy:
 *   - canShare: same-tenant user with access to the building
 *   - validateCreateInput: require `buildingId` + `showcaseMeta.pdfStoragePath`
 *   - resolve: fetch building summary + PDF storage path
 *   - safePublicProjection: exposes building id + PDF path but not companyId
 *
 * @module services/sharing/resolvers/building-showcase.resolver
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

const logger = createModuleLogger('BuildingShowcaseShareResolver');

export interface BuildingShowcaseResolvedData {
  shareId: string;
  token: string;
  buildingId: string;
  buildingTitle: string | null;
  pdfStoragePath: string | null;
  pdfRegeneratedAt: string | null;
  note: string | null;
}

async function resolveShowcase(
  share: ShareRecord,
): Promise<BuildingShowcaseResolvedData> {
  const ref = doc(db, COLLECTIONS.BUILDINGS, share.entityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    logger.warn('Showcase share points to missing building', {
      shareId: share.id,
      buildingId: share.entityId,
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
    buildingId: share.entityId,
    buildingTitle:
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
  if (input.entityType !== 'building_showcase') {
    return {
      valid: false,
      reason: 'Wrong resolver — expected entityType=building_showcase',
    };
  }
  if (!input.entityId?.trim()) return { valid: false, reason: 'buildingId required' };
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
  const ref = doc(db, COLLECTIONS.BUILDINGS, entityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const buildingCompanyId = snap.data().companyId as string | undefined;
  return buildingCompanyId === user.companyId;
}

export const buildingShowcaseShareResolver: ShareEntityDefinition<BuildingShowcaseResolvedData> = {
  resolve: resolveShowcase,
  safePublicProjection,
  validateCreateInput,
  canShare,
  renderPublic: () => null,
};
