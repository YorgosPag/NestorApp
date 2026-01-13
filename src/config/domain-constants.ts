/**
 * =============================================================================
 * DOMAIN CONSTANTS - ENTERPRISE SSoT
 * =============================================================================
 *
 * Centralized domain constants for the entire application.
 * NO hardcoded magic strings in handlers/stores - use these constants.
 *
 * @module config/domain-constants
 * @enterprise ADR-030 - Zero Hardcoded Values
 */

// ============================================================================
// BOT & SYSTEM IDENTITY
// ============================================================================

/**
 * Bot identity configuration
 * @enterprise Used consistently across all channels
 */
export const BOT_IDENTITY = {
  /** Internal identifier for bot messages */
  ID: 'bot',
  /** Display name shown in conversations */
  DISPLAY_NAME: 'Pagonis Bot',
  /** Bot type identifier */
  TYPE: 'bot',
} as const;

/**
 * System identity for automated actions
 */
export const SYSTEM_IDENTITY = {
  /** Internal identifier for system actions */
  ID: 'system',
  /** Display name for system messages */
  DISPLAY_NAME: 'System',
  /** System type identifier */
  TYPE: 'system',
} as const;

// ============================================================================
// PARTICIPANT ROLES
// ============================================================================

/**
 * Conversation participant roles
 * @enterprise Used in ConversationParticipant.role
 */
export const PARTICIPANT_ROLES = {
  /** External customer/user */
  CUSTOMER: 'customer',
  /** Internal support agent */
  AGENT: 'agent',
  /** Automated bot */
  BOT: 'bot',
  /** System automated actions */
  SYSTEM: 'system',
} as const;

export type ParticipantRole = typeof PARTICIPANT_ROLES[keyof typeof PARTICIPANT_ROLES];

// ============================================================================
// SENDER TYPES
// ============================================================================

/**
 * Message sender types
 * @enterprise Used in CanonicalMessage.senderType
 */
export const SENDER_TYPES = {
  /** External customer sending message */
  CUSTOMER: 'customer',
  /** Internal agent sending message */
  AGENT: 'agent',
  /** Bot automated response */
  BOT: 'bot',
  /** System notification/action */
  SYSTEM: 'system',
} as const;

export type SenderType = typeof SENDER_TYPES[keyof typeof SENDER_TYPES];

// ============================================================================
// ENTITY TYPES
// ============================================================================

/**
 * CRM entity types for linking
 * @enterprise Used in communications and conversations
 */
export const ENTITY_TYPES = {
  /** Lead entity */
  LEAD: 'lead',
  /** Contact entity */
  CONTACT: 'contact',
  /** Company entity */
  COMPANY: 'company',
  /** Project entity */
  PROJECT: 'project',
  /** Unit entity */
  UNIT: 'unit',
  /** Building entity */
  BUILDING: 'building',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];

// ============================================================================
// MESSAGE STATUS VALUES
// ============================================================================

/**
 * Legacy message status values (for backward compatibility)
 * @enterprise Used in COMMUNICATIONS collection
 */
export const MESSAGE_STATUS = {
  /** Message received */
  RECEIVED: 'received',
  /** Message sent */
  SENT: 'sent',
  /** Message delivered */
  DELIVERED: 'delivered',
  /** Message read */
  READ: 'read',
  /** Message failed */
  FAILED: 'failed',
} as const;

export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS];

// ============================================================================
// PLATFORM IDENTIFIERS
// ============================================================================

/**
 * Platform identifiers for provider metadata
 * @enterprise Used in providerMetadata.platform
 */
export const PLATFORMS = {
  TELEGRAM: 'telegram',
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
  MESSENGER: 'messenger',
  SMS: 'sms',
  WEB: 'web',
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Default values for missing data
 * @enterprise Use these instead of inline strings
 */
export const DEFAULTS = {
  /** Default sender name when not provided */
  UNKNOWN_SENDER: 'Unknown',
  /** Default message content for media */
  MEDIA_MESSAGE_PLACEHOLDER: '[Media Message]',
  /** Default conversation subject */
  NO_SUBJECT: '(No Subject)',
} as const;
