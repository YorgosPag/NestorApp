/**
 * =============================================================================
 * CHANNEL SHARING TYPES — Multi-Channel Photo Sharing to CRM Contacts
 * =============================================================================
 *
 * SSoT types + capabilities for the multi-channel sharing feature.
 * Used by: ContactChannelPicker, ChannelShareForm, ShareModal, API routes
 *
 * @module components/ui/channel-sharing/types
 */

// ============================================================================
// CHANNEL PROVIDERS
// ============================================================================

/** Supported sharing channels — subset of pipeline channels relevant for user-initiated shares */
export type ChannelProvider = 'telegram' | 'whatsapp' | 'messenger' | 'instagram' | 'email';

/** All supported channel providers (ordered by priority for UI display) */
export const CHANNEL_PROVIDERS: readonly ChannelProvider[] = [
  'email',
  'telegram',
  'whatsapp',
  'messenger',
  'instagram',
] as const;

// ============================================================================
// CHANNEL CAPABILITIES — SSoT
// ============================================================================

export type PhotoMethod = 'native' | 'link-fallback' | 'attachment';

export interface ChannelCapabilities {
  /** Whether the channel supports native photo delivery */
  supportsNativePhoto: boolean;
  /** How photos are delivered via this channel */
  photoMethod: PhotoMethod;
}

/**
 * SSoT: What each channel supports for photo sharing.
 *
 * - email: HTML attachment via Mailgun
 * - telegram: Bot API sendPhoto (direct URL)
 * - whatsapp/messenger/instagram: Text message with download link
 */
export const CHANNEL_CAPABILITIES: Record<ChannelProvider, ChannelCapabilities> = {
  email:     { supportsNativePhoto: true,  photoMethod: 'attachment' },
  telegram:  { supportsNativePhoto: true,  photoMethod: 'native' },
  whatsapp:  { supportsNativePhoto: false, photoMethod: 'link-fallback' },
  messenger: { supportsNativePhoto: false, photoMethod: 'link-fallback' },
  instagram: { supportsNativePhoto: false, photoMethod: 'link-fallback' },
} as const;

// ============================================================================
// AVAILABLE CHANNEL (from API response)
// ============================================================================

/** A resolved channel available for a specific contact */
export interface AvailableChannel {
  provider: ChannelProvider;
  /** Channel-specific recipient ID: chatId, phone, PSID, IGSID, or email */
  externalUserId: string;
  displayName?: string;
  verified: boolean;
  capabilities: ChannelCapabilities;
}

// ============================================================================
// LINKING HINTS — pre-fill suggestions for the `Σύνδεση καναλιού` form
// ============================================================================

/** Why a `LinkingHint` exists — used for analytics and future UI cues */
export type LinkingHintReason =
  /** Telegram `socialMedia[]` entry with a non-numeric `@username` handle,
   * filtered out of `channels[]` by ADR-312 Phase 9.12. We still want the UI
   * to surface it so the user can replace the handle with a numeric chat_id
   * instead of retyping the display name from scratch. */
  | 'non_numeric_telegram_username';

/** Server-generated suggestion that pre-fills the manual linking form when
 * the user picks a provider without an existing deliverable channel. */
export interface LinkingHint {
  provider: ChannelProvider;
  suggestedExternalId: string;
  suggestedDisplayName: string;
  reason: LinkingHintReason;
}

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

/** GET /api/contacts/[contactId]/channels response */
export interface ContactChannelsResponse {
  channels: AvailableChannel[];
  contactName: string;
  linkingHints: LinkingHint[];
}

/** POST /api/communications/share-to-channel request body.
 *
 * Two mutually-exclusive dispatch modes:
 *  - **photo mode** — `photoUrls[]` present → sendChannelMediaReply per photo.
 *  - **link mode** — `shareUrl` present → sendChannelReply text, body = `{caption}\n\n{shareUrl}`.
 *
 * Exactly one of `photoUrls` / `shareUrl` MUST be provided (ADR-312 Phase 9.16).
 * Link mode is the fallback when the showcase has no real image payload and
 * the user still wants to send the token URL via Telegram/WhatsApp/etc.
 */
export interface ChannelShareRequest {
  contactId: string;
  contactName: string;
  channel: ChannelProvider;
  externalUserId: string;
  photoUrls?: string[];
  shareUrl?: string;
  caption?: string;
}

/** POST /api/communications/share-to-channel response */
export interface ChannelShareResponse {
  success: boolean;
  shareId: string;
  messageId?: string;
  error?: string;
}
