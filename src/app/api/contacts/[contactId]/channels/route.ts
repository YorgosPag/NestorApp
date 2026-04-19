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
  type LinkingHint,
} from '@/components/ui/channel-sharing/types';
import { isValidTelegramChatId } from '@/lib/telegram/chat-id-validator';

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

// Platforms stored in `contact.socialMedia[]` that map 1:1 onto a shareable
// channel. `facebook` is intentionally excluded because a Facebook profile
// username is not a Messenger identity; `linkedin` / `twitter` / `tiktok` /
// `youtube` / `github` are not share channels in ADR-147.
const SOCIAL_MEDIA_TO_CHANNEL: Partial<Record<string, ChannelProvider>> = {
  telegram: 'telegram',
  whatsapp: 'whatsapp',
  instagram: 'instagram',
};

function extractSocialMediaChannels(data: FirebaseFirestore.DocumentData): AvailableChannel[] {
  const social = data.socialMedia;
  if (!Array.isArray(social)) return [];

  const channels: AvailableChannel[] = [];
  for (const entry of social) {
    const platform = String((entry as Record<string, unknown>)?.platform ?? '');
    const username = String((entry as Record<string, unknown>)?.username ?? '').trim();
    const provider = SOCIAL_MEDIA_TO_CHANNEL[platform];
    if (!provider || !username) continue;

    // Telegram Bot API only delivers messages to numeric `chat_id` values —
    // `@username` handles return `Bad Request: chat not found`. Skip the
    // channel entirely so the UI does not surface an unusable destination.
    // The contact can still be reached after an admin registers the numeric
    // chat_id via `Σύνδεση καναλιού` (ADR-312 Phase 9.12).
    if (provider === 'telegram' && !isValidTelegramChatId(username)) continue;

    channels.push({
      provider,
      externalUserId: username,
      displayName: username,
      verified: false,
      capabilities: CHANNEL_CAPABILITIES[provider],
    });
  }
  return channels;
}

// Non-deliverable `socialMedia[]` entries still carry useful signal — the user
// already typed the handle once, so the link form should pre-populate with it
// instead of forcing a retype. Today only Telegram needs this (ADR-312 Phase
// 9.13): `@username` handles are filtered out of `channels[]` by Phase 9.12
// but remain the best anchor for `displayName` + guidance on what to replace.
function extractLinkingHints(
  data: FirebaseFirestore.DocumentData,
  contactName: string,
): LinkingHint[] {
  const social = data.socialMedia;
  if (!Array.isArray(social)) return [];

  const hints: LinkingHint[] = [];
  for (const entry of social) {
    const platform = String((entry as Record<string, unknown>)?.platform ?? '');
    const username = String((entry as Record<string, unknown>)?.username ?? '').trim();
    if (!username) continue;

    if (platform === 'telegram' && !isValidTelegramChatId(username)) {
      hints.push({
        provider: 'telegram',
        suggestedExternalId: username,
        suggestedDisplayName: contactName,
        reason: 'non_numeric_telegram_username',
      });
    }
  }
  return hints;
}

function isValidChannelProvider(provider: string): provider is ChannelProvider {
  return (CHANNEL_PROVIDERS as readonly string[]).includes(provider);
}

function mergeChannelsDeduped(...groups: AvailableChannel[][]): AvailableChannel[] {
  const seen = new Map<string, AvailableChannel>();
  for (const group of groups) {
    for (const channel of group) {
      const key = `${channel.provider}:${channel.externalUserId.toLowerCase()}`;
      const existing = seen.get(key);
      // `external_identities` entries come first in caller ordering and carry
      // `verified: true` from the admin linking flow — keep them as the
      // authoritative record. Fallbacks from `socialMedia[]` fill holes.
      if (!existing || (!existing.verified && channel.verified)) {
        seen.set(key, channel);
      }
    }
  }
  return Array.from(seen.values());
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

      // 3. Map external identities (admin-linked) to available channels
      const identityChannels: AvailableChannel[] = [];
      for (const doc of identitiesSnap.docs) {
        const data = doc.data();
        const provider = String(data.provider ?? '');

        if (!isValidChannelProvider(provider)) continue;
        if (provider === 'email') continue; // emails come from contact doc

        identityChannels.push({
          provider,
          externalUserId: String(data.externalUserId ?? ''),
          displayName: String(data.displayName ?? data.username ?? ''),
          verified: Boolean(data.verified),
          capabilities: CHANNEL_CAPABILITIES[provider],
        });
      }

      // 4. Extract channels already registered in the contact profile via
      // `socialMedia[{platform: 'telegram' | 'whatsapp' | 'instagram', …}]`.
      // These are unverified but spare the user a redundant `Σύνδεση
      // καναλιού` step when the data is already on the contact doc.
      const socialMediaChannels = extractSocialMediaChannels(contactData);

      // 5. Email channels live on the contact doc (not in external_identities)
      const emailChannels = extractEmailChannels(contactData);

      // 6. Merge + dedupe by (provider, externalUserId). Verified
      // external_identities win over unverified socialMedia fallbacks.
      const channels = mergeChannelsDeduped(
        identityChannels,
        socialMediaChannels,
        emailChannels,
      );

      // 7. Sort by provider priority (CHANNEL_PROVIDERS order)
      channels.sort((a, b) => {
        const aIdx = CHANNEL_PROVIDERS.indexOf(a.provider);
        const bIdx = CHANNEL_PROVIDERS.indexOf(b.provider);
        return aIdx - bIdx;
      });

      const linkingHints = extractLinkingHints(contactData, contactName);

      logger.info('Contact channels resolved', {
        contactId,
        channelCount: channels.length,
        hintCount: linkingHints.length,
        providers: [...new Set(channels.map(c => c.provider))],
        tenant: ctx.companyId,
      });

      return apiSuccess<ContactChannelsResponse>({ channels, contactName, linkingHints });
    },
    { permissions: 'crm:contacts:view' }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
