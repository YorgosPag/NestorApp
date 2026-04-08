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
// API REQUEST / RESPONSE TYPES
// ============================================================================

/** GET /api/contacts/[contactId]/channels response */
export interface ContactChannelsResponse {
  channels: AvailableChannel[];
  contactName: string;
}

/** POST /api/communications/share-to-channel request body */
export interface ChannelShareRequest {
  contactId: string;
  contactName: string;
  channel: ChannelProvider;
  externalUserId: string;
  photoUrls: string[];
  caption?: string;
}

/** POST /api/communications/share-to-channel response */
export interface ChannelShareResponse {
  success: boolean;
  shareId: string;
  messageId?: string;
  error?: string;
}
