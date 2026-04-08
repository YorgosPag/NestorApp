/**
 * =============================================================================
 * CHANNEL ICON MAP — SSoT for communication channel → icon mapping
 * =============================================================================
 *
 * Pure mapping: channel string → LucideIcon component.
 * Each consumer renders with their own size/color/className.
 *
 * Used by: UnifiedInbox, SendMessageModal, CommunicationsIntegration,
 *          ProposalReviewCard, and any future channel UI.
 *
 * @module channel-icon-map
 * @enterprise Google SSoT — single source of truth, zero duplicates
 */

import { Globe, Mail, MessageSquare, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Maps a communication channel identifier to its Lucide icon component.
 *
 * Supports both COMMUNICATION_CHANNELS (TypeScript) and MESSAGE_TYPES (JS config)
 * constant values — they use the same string literals.
 *
 * @param channel - Channel identifier (e.g., 'email', 'telegram', 'whatsapp')
 * @returns LucideIcon component — render with `<Icon className={...} />`
 */
export function getChannelIconComponent(channel: string): LucideIcon {
  switch (channel) {
    case 'email':
      return Mail;
    case 'telegram':
    case 'whatsapp':
    case 'messenger':
    case 'sms':
    case 'viber':
    case 'instagram':
      return MessageSquare;
    case 'call':
      return Phone;
    default:
      return Globe;
  }
}
