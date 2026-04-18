/**
 * =============================================================================
 * PROPERTY SHOWCASE SHARE RESOLVER (ADR-315)
 * =============================================================================
 *
 * Resolves `entityType: 'property_showcase'` shares. Replaces ADR-312's inline
 * `showcaseMode`/`showcasePropertyId` discriminator fields on `file_shares`
 * with a first-class entityType + `showcaseMeta` (pdfStoragePath, regen ts).
 *
 * Policy:
 *   - canShare: same-tenant user with access to the property
 *   - validateCreateInput: require `propertyId` + `showcaseMeta.pdfStoragePath`
 *   - resolve: fetch property summary + PDF storage path
 *   - safePublicProjection: exposes property id + PDF path but not companyId
 *
 * @module services/sharing/resolvers/property-showcase.resolver
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

const logger = createModuleLogger('PropertyShowcaseShareResolver');

export interface PropertyShowcaseResolvedData {
  shareId: string;
  token: string;
  propertyId: string;
  propertyTitle: string | null;
  pdfStoragePath: string | null;
  pdfRegeneratedAt: string | null;
  note: string | null;
}

async function resolveShowcase(
  share: ShareRecord,
): Promise<PropertyShowcaseResolvedData> {
  const ref = doc(db, COLLECTIONS.PROPERTIES, share.entityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    logger.warn('Showcase share points to missing property', {
      shareId: share.id,
      propertyId: share.entityId,
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
    propertyId: share.entityId,
    propertyTitle:
      (data?.title as string | undefined) ??
      (data?.name as string | undefined) ??
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
  if (input.entityType !== 'property_showcase') {
    return {
      valid: false,
      reason: 'Wrong resolver — expected entityType=property_showcase',
    };
  }
  if (!input.entityId?.trim()) return { valid: false, reason: 'propertyId required' };
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
  const ref = doc(db, COLLECTIONS.PROPERTIES, entityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const propertyCompanyId = snap.data().companyId as string | undefined;
  return propertyCompanyId === user.companyId;
}

export const propertyShowcaseShareResolver: ShareEntityDefinition<PropertyShowcaseResolvedData> = {
  resolve: resolveShowcase,
  safePublicProjection,
  validateCreateInput,
  canShare,
  renderPublic: () => null, // Wired in Step D (public route dispatcher)
};
