/**
 * =============================================================================
 * CANONICAL CONVERSATION MODEL - OMNICHANNEL SSoT
 * =============================================================================
 *
 * Enterprise domain model for omnichannel conversations.
 * Provides unified structure for all communication channels.
 *
 * @module types/conversations
 * @enterprise ADR-029 - Omnichannel Conversation Model
 *
 * SEPARATION OF CONCERNS:
 * - communications.ts: Channel constants, message priorities, outbound types
 * - conversations.ts: Conversation domain model, inbound normalization
 */

import { CommunicationChannel, ImplementedChannel } from './communications';

// ============================================================================
// ID GENERATION - SERVER-ONLY
// ============================================================================
// IMPORTANT: ID generation functions are in server-only module:
// @see src/server/lib/id-generation.ts
//
// Do NOT re-export crypto functions here - they are server-only
// and must not be bundled in client code.

// ============================================================================
// CONVERSATION STATUS & CONSTANTS
// ============================================================================

/**
 * Conversation status values
 */
export const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
  SPAM: 'spam',
} as const;

export type ConversationStatus = typeof CONVERSATION_STATUS[keyof typeof CONVERSATION_STATUS];

/**
 * Message direction
 */
export const MESSAGE_DIRECTION = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export type MessageDirection = typeof MESSAGE_DIRECTION[keyof typeof MESSAGE_DIRECTION];

/**
 * Message delivery status
 */
export const DELIVERY_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
} as const;

export type DeliveryStatus = typeof DELIVERY_STATUS[keyof typeof DELIVERY_STATUS];

/**
 * External identity provider types
 */
export const IDENTITY_PROVIDER = {
  TELEGRAM: 'telegram',
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
  MESSENGER: 'messenger',
  INSTAGRAM: 'instagram',
  SMS: 'sms',
  PHONE: 'phone',
} as const;

export type IdentityProvider = typeof IDENTITY_PROVIDER[keyof typeof IDENTITY_PROVIDER];

// ============================================================================
// EXTERNAL IDENTITY (SSoT)
// ============================================================================

/**
 * External identity for linking external users to internal contacts/leads
 * @enterprise Enables omnichannel identity resolution
 */
export interface ExternalIdentity {
  /** Unique identifier */
  id: string;

  /** Provider/channel type */
  provider: IdentityProvider;

  /** External user ID from provider (telegram user id, phone, email) */
  externalUserId: string;

  /** Display name from provider */
  displayName?: string;

  /** Username if available (e.g., @telegram_username) */
  username?: string;

  /** Whether identity is verified */
  verified: boolean;

  /** Linked internal user ID (if user has app account) */
  linkedUserId?: string;

  /** Linked contact ID (CRM contact) */
  linkedContactId?: string;

  /** Linked lead ID (CRM lead) */
  linkedLeadId?: string;

  /** Consent status for communications */
  consent: {
    marketing: boolean;
    transactional: boolean;
    consentedAt?: Date;
    optOutAt?: Date;
  };

  /** Provider-specific metadata */
  providerMetadata?: Record<string, unknown>;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt?: Date;
}

// ============================================================================
// CONVERSATION (SSoT)
// ============================================================================

/**
 * Conversation participant
 */
export interface ConversationParticipant {
  /** External identity ID or internal user ID */
  identityId: string;

  /** Whether this is an internal user (staff) or external (customer) */
  isInternal: boolean;

  /** Display name */
  displayName: string;

  /** Role in conversation */
  role: 'customer' | 'agent' | 'bot' | 'system';

  /** When participant joined */
  joinedAt: Date;

  /** When participant left (if applicable) */
  leftAt?: Date;
}

/**
 * Canonical Conversation entity
 * @enterprise Groups all messages across channels for a single thread
 */
export interface Conversation {
  /** Unique conversation ID */
  id: string;

  /** Primary channel for this conversation */
  channel: CommunicationChannel;

  /** Conversation participants */
  participants: ConversationParticipant[];

  /** Current status */
  status: ConversationStatus;

  /** Subject/title (for email threads) */
  subject?: string;

  /** Tags for categorization */
  tags: string[];

  /** Assigned agent (internal user ID) */
  assignedTo?: string;

  /** Message counts */
  messageCount: number;
  unreadCount: number;

  /** Last message preview */
  lastMessage?: {
    content: string;
    direction: MessageDirection;
    timestamp: Date;
  };

  /** Entity associations (CRM linking) */
  linkedEntities?: {
    contactId?: string;
    leadId?: string;
    projectId?: string;
    unitId?: string;
  };

  /** Audit trail */
  audit: {
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date;
    closedBy?: string;
  };
}

// ============================================================================
// CANONICAL MESSAGE (SSoT)
// ============================================================================

// ============================================================================
// MESSAGE REACTIONS (Telegram-style)
// ============================================================================

/**
 * Single reaction entry
 * @enterprise Telegram-compatible reaction format
 */
export interface MessageReaction {
  /** Emoji character (e.g., '👍', '❤️', '😂') */
  emoji: string;
  /** User IDs who reacted with this emoji */
  userIds: string[];
  /** Display names for tooltip (optional, denormalized for performance) */
  userNames?: string[];
  /** Total count (derived from userIds.length but stored for queries) */
  count: number;
  /** When first reaction was added */
  createdAt: Date;
  /** When last reaction was added/removed */
  updatedAt: Date;
}

/**
 * Reactions map for a message
 * Key is emoji string, value is reaction data
 * @enterprise Optimized for Firestore map operations
 */
export type MessageReactionsMap = Record<string, MessageReaction>;

/**
 * Quick reaction emojis (Telegram-style)
 * @enterprise Canonical list - change here to update everywhere
 */
export const QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'] as const;
export type QuickReactionEmoji = typeof QUICK_REACTION_EMOJIS[number];

/**
 * Canonical Message entity
 * @enterprise Unified message format across all channels
 */
export interface CanonicalMessage {
  /** Unique message ID */
  id: string;

  /** Parent conversation ID */
  conversationId: string;

  /** Message direction */
  direction: MessageDirection;

  /** Channel used */
  channel: CommunicationChannel;

  /** Sender identity */
  senderId: string;
  senderName: string;
  senderType: 'customer' | 'agent' | 'bot' | 'system';

  /** Message content */
  content: {
    text?: string;
    html?: string;
    attachments?: MessageAttachment[];
  };

  /** Provider-specific message ID (for idempotency) */
  providerMessageId: string;

  /** Delivery status */
  deliveryStatus: DeliveryStatus;
  deliveryStatusHistory?: Array<{
    status: DeliveryStatus;
    timestamp: Date;
    error?: string;
  }>;

  /** Provider-specific metadata (preserved for debugging) */
  providerMetadata?: Record<string, unknown>;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;

  /** Reactions (Telegram-style) */
  reactions?: MessageReactionsMap;
  /** Total reaction count (for sorting/filtering) */
  reactionCount?: number;
  /** Whether current user has reacted (hydrated client-side) */
  userReactions?: string[];
}

// ============================================================================
// MESSAGE ATTACHMENTS (ADR-055 - Enterprise Attachment System)
// ============================================================================

/**
 * Attachment type discriminator
 * @enterprise Canonical attachment types for omnichannel support
 */
export const ATTACHMENT_TYPES = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  VIDEO: 'video',
  LOCATION: 'location',
  CONTACT: 'contact',
} as const;

export type AttachmentType = typeof ATTACHMENT_TYPES[keyof typeof ATTACHMENT_TYPES];

/**
 * Attachment upload status
 * @enterprise For tracking upload progress in UI
 */
export const ATTACHMENT_UPLOAD_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type AttachmentUploadStatus = typeof ATTACHMENT_UPLOAD_STATUS[keyof typeof ATTACHMENT_UPLOAD_STATUS];

/**
 * Message attachment - CANONICAL TYPE (ADR-055)
 * @enterprise Single Source of Truth for all attachment handling
 *
 * Used in:
 * - CanonicalMessage.content.attachments[]
 * - InboundMessageNormalized.content.attachments[]
 * - ReplyComposer (outbound)
 * - ThreadView (display)
 * - Telegram/Email/WhatsApp handlers
 */
export interface MessageAttachment {
  /** Attachment type discriminator */
  type: AttachmentType;
  /** Download URL (Firebase Storage or external) */
  url?: string;
  /** Original filename (with extension) */
  filename?: string;
  /** MIME type (e.g., 'image/jpeg', 'application/pdf') */
  mimeType?: string;
  /** File size in bytes */
  size?: number;
  /** Provider-specific or custom metadata */
  metadata?: Record<string, unknown>;

  // === ADR-055 Extensions ===

  /** FileRecord ID (links to Firestore FILES collection) */
  fileRecordId?: string;
  /** Upload progress status (for UI state tracking) */
  uploadStatus?: AttachmentUploadStatus;
  /** Thumbnail URL for images/videos (for faster preview) */
  thumbnailUrl?: string;
  /** Width in pixels (for images/videos) */
  width?: number;
  /** Height in pixels (for images/videos) */
  height?: number;
  /** Duration in seconds (for audio/video) */
  duration?: number;
}

/**
 * Attachment upload request - for outbound message composition
 * @enterprise Used by ReplyComposer when attaching files
 */
export interface AttachmentUploadRequest {
  /** The file to upload */
  file: File;
  /** Attachment type (auto-detected from MIME if not provided) */
  type?: AttachmentType;
  /** Custom filename override */
  filename?: string;
}

/**
 * Detect attachment type from MIME type
 * @enterprise Helper function for type discrimination
 */
export function detectAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith('image/')) return ATTACHMENT_TYPES.IMAGE;
  if (mimeType.startsWith('video/')) return ATTACHMENT_TYPES.VIDEO;
  if (mimeType.startsWith('audio/')) return ATTACHMENT_TYPES.AUDIO;
  return ATTACHMENT_TYPES.DOCUMENT;
}

// ============================================================================
// INBOUND NORMALIZATION CONTRACT
// ============================================================================

/**
 * Normalized inbound message (output from channel adapters)
 * @enterprise All channel adapters MUST normalize to this format
 */
export interface InboundMessageNormalized {
  /** Provider event ID (for idempotency) */
  providerEventId: string;

  /** Provider message ID */
  providerMessageId: string;

  /** Channel source */
  channel: ImplementedChannel;

  /** External sender identity */
  sender: {
    externalUserId: string;
    displayName: string;
    username?: string;
    providerMetadata?: Record<string, unknown>;
  };

  /** Recipient (typically our bot/system) */
  recipient: {
    externalUserId: string;
    isBot: boolean;
  };

  /** Normalized content */
  content: {
    text?: string;
    attachments?: MessageAttachment[];
  };

  /** Original timestamp from provider */
  timestamp: Date;

  /** Original raw payload (for debugging, not for business logic) */
  rawPayload?: unknown;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if message direction is valid
 */
export function isValidDirection(value: string): value is MessageDirection {
  return Object.values(MESSAGE_DIRECTION).includes(value as MessageDirection);
}

/**
 * Check if conversation status is valid
 */
export function isValidConversationStatus(value: string): value is ConversationStatus {
  return Object.values(CONVERSATION_STATUS).includes(value as ConversationStatus);
}

/**
 * Check if delivery status is valid
 */
export function isValidDeliveryStatus(value: string): value is DeliveryStatus {
  return Object.values(DELIVERY_STATUS).includes(value as DeliveryStatus);
}

// ============================================================================
// FIRESTORE BOUNDARY CONTRACTS - SERVER-ONLY
// ============================================================================
// IMPORTANT: Firestore document types with Timestamp are in:
// @see src/server/types/conversations.firestore.ts
//
// Do NOT add FirebaseFirestore.Timestamp types here - they couple
// shared types to server-only modules and break client bundles.
