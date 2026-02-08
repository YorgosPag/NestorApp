/**
 * =============================================================================
 * COMMUNICATION TYPES & CONSTANTS - CANONICAL SSoT
 * =============================================================================
 *
 * Single Source of Truth for communication channels, categories, priorities,
 * and message interfaces. Used by server orchestrator, config, and client.
 *
 * @module types/communications
 * @enterprise ADR-026 - Communication Types (Canonical)
 */

// ============================================================================
// COMMUNICATION CHANNEL CONSTANTS (SSoT)
// ============================================================================

/**
 * Communication channels - canonical constants (declared)
 * NOTE: Not all channels have adapters. Use IMPLEMENTED_CHANNELS for dispatch.
 */
export const COMMUNICATION_CHANNELS = {
  EMAIL: 'email',
  TELEGRAM: 'telegram',
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  MESSENGER: 'messenger',
} as const;

/**
 * Communication channel type (derived from constants)
 */
export type CommunicationChannel = typeof COMMUNICATION_CHANNELS[keyof typeof COMMUNICATION_CHANNELS];

/**
 * Legacy alias for backward compatibility
 * @deprecated Use CommunicationChannel instead
 */
export type Channel = CommunicationChannel;

// ============================================================================
// IMPLEMENTED CHANNELS (SSoT) - Enterprise Hardening
// ============================================================================

/**
 * Channels with actual adapter/router implementation
 * @enterprise RULE: Dispatch ONLY to implemented channels
 * @enterprise SSoT: References COMMUNICATION_CHANNELS.* (no string duplication)
 *
 * To add a new channel:
 * 1. Add to COMMUNICATION_CHANNELS (declared)
 * 2. Implement adapter in src/lib/communications/providers/
 * 3. Add router handler in messageRouter.ts
 * 4. Add to IMPLEMENTED_CHANNELS (implemented)
 * 5. Update config validation
 */
export const IMPLEMENTED_CHANNELS = [
  COMMUNICATION_CHANNELS.EMAIL,
  COMMUNICATION_CHANNELS.TELEGRAM,
  // COMMUNICATION_CHANNELS.WHATSAPP,   // Declared but not fully implemented
  // COMMUNICATION_CHANNELS.SMS,        // Declared but not fully implemented
  // COMMUNICATION_CHANNELS.MESSENGER,  // Declared but not implemented
] as const;

/**
 * Implemented channel type (subset of CommunicationChannel)
 * @enterprise Derived from array for compile-time safety
 */
export type ImplementedChannel = typeof IMPLEMENTED_CHANNELS[number];

/**
 * Check if channel has actual implementation (adapter/router)
 * @enterprise FAIL-FAST: Use this before dispatch to prevent silent failures
 */
export function isChannelImplemented(
  channel: CommunicationChannel
): channel is ImplementedChannel {
  return (IMPLEMENTED_CHANNELS as readonly string[]).includes(channel);
}

/**
 * Get list of implemented channels (for error messages - SSoT)
 * @enterprise Use this to generate dynamic error messages (no hardcoding)
 */
export function getImplementedChannels(): readonly ImplementedChannel[] {
  return IMPLEMENTED_CHANNELS;
}

/**
 * Get list of unimplemented channels (for error messages)
 */
export function getUnimplementedChannels(): CommunicationChannel[] {
  const implemented = new Set<string>(IMPLEMENTED_CHANNELS);
  return Object.values(COMMUNICATION_CHANNELS).filter(ch => !implemented.has(ch));
}

// ============================================================================
// MESSAGE PRIORITY CONSTANTS (SSoT)
// ============================================================================

/**
 * Message priorities - canonical constants
 */
export const MESSAGE_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

/**
 * Message priority type (derived from constants)
 */
export type MessagePriority = typeof MESSAGE_PRIORITIES[keyof typeof MESSAGE_PRIORITIES];

// ============================================================================
// MESSAGE CATEGORY CONSTANTS (SSoT)
// ============================================================================

/**
 * Message categories - canonical constants
 */
export const MESSAGE_CATEGORIES = {
  TRANSACTIONAL: 'transactional',
  MARKETING: 'marketing',
  NOTIFICATION: 'notification',
  SYSTEM: 'system',
} as const;

/**
 * Message category type (derived from constants)
 */
export type MessageCategory = typeof MESSAGE_CATEGORIES[keyof typeof MESSAGE_CATEGORIES];

// ============================================================================
// VALIDATORS
// ============================================================================

/**
 * Check if value is a valid communication channel
 */
export function isValidChannel(value: string): value is CommunicationChannel {
  return Object.values(COMMUNICATION_CHANNELS).includes(value as CommunicationChannel);
}

/**
 * Check if value is a valid message priority
 */
export function isValidPriority(value: string): value is MessagePriority {
  return Object.values(MESSAGE_PRIORITIES).includes(value as MessagePriority);
}

/**
 * Check if value is a valid message category
 */
export function isValidCategory(value: string): value is MessageCategory {
  return Object.values(MESSAGE_CATEGORIES).includes(value as MessageCategory);
}

// ============================================================================
// MESSAGE INTERFACES
// ============================================================================

export interface BaseMessageInput {
  channel: Channel;
  to: string;
  from?: string;
  subject?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  messageType?: string; // channel-specific (e.g., telegram: 'text'|'photo'...)
  attachments?: string[];
  entityType?: 'lead' | 'contact' | 'unit' | null;
  entityId?: string | null;
  threadId?: string | null;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  externalId?: string;
  error?: string;
}

export interface TemplateSendInput {
  templateType: string;
  channel: Channel;
  to: string;
  content?: string | null;
  variables?: Record<string, string>;
  entityType?: 'lead' | 'contact' | 'unit';
  entityId?: string;
  metadata?: Record<string, unknown>;
}
