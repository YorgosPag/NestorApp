/**
 * =============================================================================
 * CONTACT CHANNELS — Available Communication Channels for a Contact
 * =============================================================================
 *
 * Returns all available channels (Email, Telegram, WhatsApp, etc.) for a
 * specific CRM contact, by querying external_identities + contact emails.
 *
 * @route GET /api/contacts/[contactId]/channels
 * @security Admin SDK + withAuth + Tenant Isolation
 * @enterprise Phase 2 — Multi-Channel Sharing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import {
  CHANNEL_CAPABILITIES,
  CHANNEL_PROVIDERS,
  type AvailableChannel,
  type ChannelProvider,
  type ContactChannelsResponse,
} from '@/components/ui/channel-sharing/types';

const logger = createModuleLogger('ContactChannelsRoute');

// ============================================================================
// HELPERS
// ============================================================================

function extractDisplayName(data: FirebaseFirestore.DocumentData): string {
  if (data.type === 'company') {
    return String(data.companyName ?? data.tradeName ?? '');
  }
  if (data.type === 'service') {
    return String(data.serviceName ?? data.companyName ?? '');
  }
  const first = String(data.firstName ?? '');
  const last = String(data.lastName ?? '');
  return `${first} ${last}`.trim();
}

function extractEmailChannels(data: FirebaseFirestore.DocumentData): AvailableChannel[] {
  const emails = data.emails;
  if (!Array.isArray(emails)) return [];

  return emails
    .filter((e: Record<string, unknown>) => typeof e?.email === 'string' && e.email.length > 0)
    .map((e: Record<string, unknown>) => ({
      provider: 'email' as ChannelProvider,
      externalUserId: String(e.email),
      displayName: String(e.email),
      verified: true,
      capabilities: CHANNEL_CAPABILITIES.email,
    }));
}

function isValidChannelProvider(provider: string): provider is ChannelProvider {
  return (CHANNEL_PROVIDERS as readonly string[]).includes(provider);
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ contactId: string }> }
): Promise<NextResponse> {
  const { contactId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<ContactChannelsResponse>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      if (!contactId || contactId.length < 3) {
        throw new ApiError(400, 'Invalid contactId', 'VALIDATION_ERROR');
      }

      const db = getAdminFirestore();
      if (!db) {
        throw new ApiError(503, 'Database connection not available', 'DB_UNAVAILABLE');
      }

      // 1. Load contact doc — verify tenant isolation
      const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
      if (!contactDoc.exists) {
        throw new ApiError(404, 'Contact not found', 'NOT_FOUND');
      }

      const contactData = contactDoc.data()!;
      if (contactData[FIELDS.COMPANY_ID] !== ctx.companyId) {
        throw new ApiError(403, 'Access denied', 'FORBIDDEN');
      }

      const contactName = extractDisplayName(contactData);

      // 2. Query external_identities WHERE contactId matches
      const identitiesSnap = await db
        .collection(COLLECTIONS.EXTERNAL_IDENTITIES)
        .where('contactId', '==', contactId)
        .get();

      const channels: AvailableChannel[] = [];

      // 3. Map external identities to available channels
      for (const doc of identitiesSnap.docs) {
        const data = doc.data();
        const provider = String(data.provider ?? '');

        if (!isValidChannelProvider(provider)) continue;
        if (provider === 'email') continue; // emails come from contact doc

        channels.push({
          provider,
          externalUserId: String(data.externalUserId ?? ''),
          displayName: String(data.displayName ?? data.username ?? ''),
          verified: Boolean(data.verified),
          capabilities: CHANNEL_CAPABILITIES[provider],
        });
      }

      // 4. Add email channels from contact document
      const emailChannels = extractEmailChannels(contactData);
      channels.push(...emailChannels);

      // 5. Sort by provider priority (CHANNEL_PROVIDERS order)
      channels.sort((a, b) => {
        const aIdx = CHANNEL_PROVIDERS.indexOf(a.provider);
        const bIdx = CHANNEL_PROVIDERS.indexOf(b.provider);
        return aIdx - bIdx;
      });

      logger.info('Contact channels resolved', {
        contactId,
        channelCount: channels.length,
        providers: [...new Set(channels.map(c => c.provider))],
        tenant: ctx.companyId,
      });

      return apiSuccess<ContactChannelsResponse>({ channels, contactName });
    },
    { permissions: 'crm:contacts:view' }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
