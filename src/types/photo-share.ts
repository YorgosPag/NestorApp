/**
 * @fileoverview Photo Share History types — records of photos shared via CRM contacts.
 * @module types/photo-share
 */

import type { ChannelProvider } from '@/components/ui/channel-sharing/types';

// ============================================================================
// PHOTO SHARE STATUS
// ============================================================================

/** Outcome of a channel photo share */
export type PhotoShareStatus = 'sent' | 'failed' | 'partial';

// ============================================================================
// PHOTO SHARE RECORD
// ============================================================================

/** Structured record stored in `photo_shares` Firestore collection */
export interface PhotoShareRecord {
  /** Enterprise share ID (document key) */
  id: string;
  /** CRM contact ID */
  contactId: string;
  /** Denormalized contact display name */
  contactName: string;
  /** Channel used for delivery */
  channel: ChannelProvider;
  /** Channel-specific recipient (chatId, email, phone, PSID, IGSID) */
  externalUserId: string;
  /** Firebase Storage URLs of shared photos */
  photoUrls: string[];
  /** Denormalized count */
  photoCount: number;
  /** Optional message caption */
  caption: string | null;
  /** Delivery outcome */
  status: PhotoShareStatus;
  /** Number of photos successfully sent (for partial) */
  sentCount: number;
  /** Tenant isolation */
  companyId: string;
  /** UID of the sender */
  createdBy: string;
  /** Server timestamp */
  createdAt: Date | { seconds: number; nanoseconds: number };
}
