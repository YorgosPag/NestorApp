import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// DELIVERY CHANNEL — ADR-327 §17 Q7
// ============================================================================

export type DeliveryChannel = 'email' | 'whatsapp' | 'sms' | 'copy_link';

// ============================================================================
// INVITE STATUS — ADR-327 §17 Q23 (decline button)
// ============================================================================

export type InviteStatus = 'sent' | 'opened' | 'submitted' | 'declined' | 'expired';

// ============================================================================
// VENDOR INVITE ENTITY
// ============================================================================

export interface VendorInvite {
  id: string;
  rfqId: string;
  vendorContactId: string;
  companyId: string;
  token: string;
  deliveryChannel: DeliveryChannel;
  preferredChannel: DeliveryChannel | null;
  status: InviteStatus;
  deliveredAt: Timestamp | null;
  openedAt: Timestamp | null;
  submittedAt: Timestamp | null;
  declinedAt: Timestamp | null;
  declineReason: string | null;
  expiresAt: Timestamp;
  editWindowExpiresAt: Timestamp | null;
  remindersSentAt: Timestamp[];
  lastReminderAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// DTOS
// ============================================================================

export interface CreateVendorInviteDTO {
  rfqId: string;
  vendorContactId: string;
  deliveryChannel: DeliveryChannel;
  expiresInDays?: number;
}
