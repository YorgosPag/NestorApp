/**
 * =============================================================================
 * LINK CHANNEL — Manually Link External Channel Identity to Contact
 * =============================================================================
 *
 * Creates an external_identity document linking a channel (Telegram, WhatsApp,
 * etc.) to a CRM contact. Used when the contact hasn't sent a message via
 * that channel yet (no automatic webhook-based linking).
 *
 * @route POST /api/contacts/[contactId]/link-channel
 * @route DELETE /api/contacts/[contactId]/link-channel
 * @security Admin SDK + withAuth + Tenant Isolation
 * @enterprise Phase 2 — Multi-Channel Sharing
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { generateExternalIdentityId } from '@/server/lib/id-generation';
import { IDENTITY_PROVIDER } from '@/types/conversations';
import type { IdentityProvider } from '@/types/conversations';
import { FieldValue } from 'firebase-admin/firestore';

const logger = createModuleLogger('LinkChannelRoute');

// ============================================================================
// TYPES
// ============================================================================

interface LinkChannelRequest {
  provider: IdentityProvider;
  externalUserId: string;
  displayName?: string;
}

interface LinkChannelResponse {
  success: boolean;
  identityId: string;
}

interface UnlinkChannelRequest {
  provider: IdentityProvider;
  externalUserId: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

const LINKABLE_PROVIDERS = new Set<string>([
  IDENTITY_PROVIDER.TELEGRAM,
  IDENTITY_PROVIDER.WHATSAPP,
  IDENTITY_PROVIDER.MESSENGER,
  IDENTITY_PROVIDER.INSTAGRAM,
]);

function validateLinkRequest(body: unknown): LinkChannelRequest {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'Invalid request body', 'VALIDATION_ERROR');
  }
  const b = body as Record<string, unknown>;

  if (typeof b.provider !== 'string' || !LINKABLE_PROVIDERS.has(b.provider)) {
    throw new ApiError(400, 'Invalid provider. Use: telegram, whatsapp, messenger, instagram', 'VALIDATION_ERROR');
  }
  if (typeof b.externalUserId !== 'string' || b.externalUserId.trim().length === 0) {
    throw new ApiError(400, 'Invalid externalUserId', 'VALIDATION_ERROR');
  }
  if (b.displayName !== undefined && typeof b.displayName !== 'string') {
    throw new ApiError(400, 'Invalid displayName', 'VALIDATION_ERROR');
  }

  return {
    provider: b.provider as IdentityProvider,
    externalUserId: b.externalUserId.trim(),
    displayName: typeof b.displayName === 'string' ? b.displayName.trim() : undefined,
  };
}

function validateUnlinkRequest(body: unknown): UnlinkChannelRequest {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'Invalid request body', 'VALIDATION_ERROR');
  }
  const b = body as Record<string, unknown>;

  if (typeof b.provider !== 'string' || !LINKABLE_PROVIDERS.has(b.provider)) {
    throw new ApiError(400, 'Invalid provider', 'VALIDATION_ERROR');
  }
  if (typeof b.externalUserId !== 'string' || b.externalUserId.trim().length === 0) {
    throw new ApiError(400, 'Invalid externalUserId', 'VALIDATION_ERROR');
  }

  return {
    provider: b.provider as IdentityProvider,
    externalUserId: b.externalUserId.trim(),
  };
}

// ============================================================================
// POST — Link Channel to Contact
// ============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ contactId: string }> }
): Promise<NextResponse> {
  const { contactId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<LinkChannelResponse>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const body = await req.json().catch(() => null);
      const data = validateLinkRequest(body);

      if (!contactId || contactId.length < 3) {
        throw new ApiError(400, 'Invalid contactId', 'VALIDATION_ERROR');
      }

      const db = getAdminFirestore();
      if (!db) {
        throw new ApiError(503, 'Database not available', 'DB_UNAVAILABLE');
      }

      // Verify contact exists + tenant isolation
      const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
      if (!contactDoc.exists) {
        throw new ApiError(404, 'Contact not found', 'NOT_FOUND');
      }
      if (contactDoc.data()?.[FIELDS.COMPANY_ID] !== ctx.companyId) {
        throw new ApiError(403, 'Access denied', 'FORBIDDEN');
      }

      // Generate deterministic ID (same pattern as webhooks)
      const identityId = generateExternalIdentityId(data.provider, data.externalUserId);

      // Check if identity already exists
      const identityRef = db.collection(COLLECTIONS.EXTERNAL_IDENTITIES).doc(identityId);
      const existing = await identityRef.get();

      if (existing.exists) {
        // Update contactId link if not already linked
        await identityRef.update({
          contactId,
          displayName: data.displayName ?? existing.data()?.displayName ?? '',
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        // Create new external identity with contact link
        await identityRef.set({
          id: identityId,
          companyId: ctx.companyId,
          provider: data.provider,
          externalUserId: data.externalUserId,
          contactId,
          displayName: data.displayName ?? '',
          verified: false,
          consent: { marketing: false, transactional: true },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
        });
      }

      logger.info('Channel linked to contact', {
        contactId,
        provider: data.provider,
        identityId,
        isUpdate: existing.exists,
        tenant: ctx.companyId,
      });

      return apiSuccess<LinkChannelResponse>({ success: true, identityId });
    },
    { permissions: 'crm:contacts:update' }
  );

  return handler(request);
}

// ============================================================================
// DELETE — Unlink Channel from Contact
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ contactId: string }> }
): Promise<NextResponse> {
  const { contactId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<{ success: boolean }>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const body = await req.json().catch(() => null);
      const data = validateUnlinkRequest(body);

      const db = getAdminFirestore();
      if (!db) {
        throw new ApiError(503, 'Database not available', 'DB_UNAVAILABLE');
      }

      // Verify contact + tenant
      const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
      if (!contactDoc.exists || contactDoc.data()?.[FIELDS.COMPANY_ID] !== ctx.companyId) {
        throw new ApiError(403, 'Access denied', 'FORBIDDEN');
      }

      const identityId = generateExternalIdentityId(data.provider, data.externalUserId);
      const identityRef = db.collection(COLLECTIONS.EXTERNAL_IDENTITIES).doc(identityId);

      // Remove contactId link (keep identity for future auto-link)
      const existing = await identityRef.get();
      if (existing.exists) {
        await identityRef.update({
          contactId: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      logger.info('Channel unlinked from contact', {
        contactId, provider: data.provider, identityId, tenant: ctx.companyId,
      });

      return apiSuccess({ success: true });
    },
    { permissions: 'crm:contacts:update' }
  );

  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
export const DELETE = withSensitiveRateLimit(handleDelete);
