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
  /** Empty string when invite was created via manual email entry (no contact). */
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
  /** Snapshot of recipient email at creation (always set, both modes). */
  recipientEmail: string | null;
  /** Snapshot of recipient display name at creation (always set, both modes). */
  recipientName: string | null;
}

// ============================================================================
// DTOS
// ============================================================================

interface CreateVendorInviteBaseDTO {
  rfqId: string;
  deliveryChannel: DeliveryChannel;
  expiresInDays?: number;
}

interface CreateVendorInviteFromContactDTO extends CreateVendorInviteBaseDTO {
  vendorContactId: string;
  manualEmail?: undefined;
  manualName?: undefined;
}

interface CreateVendorInviteManualDTO extends CreateVendorInviteBaseDTO {
  vendorContactId?: undefined;
  manualEmail: string;
  manualName: string;
}

export type CreateVendorInviteDTO =
  | CreateVendorInviteFromContactDTO
  | CreateVendorInviteManualDTO;
