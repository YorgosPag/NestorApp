import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// DELIVERY CHANNEL — ADR-327 §17 Q7
// ============================================================================

export type DeliveryChannel = 'email' | 'whatsapp' | 'sms' | 'copy_link';

// ============================================================================
// INVITE STATUS — ADR-327 §17 Q23 (decline button)
// ============================================================================

/**
 * ⚠️ **`revoked` ≠ λήξη (ADR-876 §5 Σ5).** Η ανάκληση έγραφε `'expired'`, οπότε «ο PM το
 * απέσυρε» και «πέρασε ο χρόνος» ήταν αδιάκριτα — και μια αυτοεξυπηρέτηση λήξης θα ξανάνοιγε
 * ανακληθείσα πρόσκληση. Η **λήξη δεν αποθηκεύεται πια ως κατάσταση**: είναι παράγωγη του
 * `expiresAt` (βλ. `vendorInviteDisplayStatus`). Έγγραφα με `'expired'` προ-migration
 * διαβάζονται ως ανακλημένα (ήταν η μόνη πηγή τους).
 */
export type InviteStatus = 'pending' | 'sent' | 'opened' | 'submitted' | 'declined' | 'revoked';

// ============================================================================
// VENDOR INVITE ENTITY
// ============================================================================

export interface VendorInvite {
  id: string;
  rfqId: string;
  /** Empty string when invite was created via manual email entry (no contact). */
  vendorContactId: string;
  companyId: string;
  // 🔴 ΚΑΝΕΝΑ `token` ΕΔΩ (ADR-876 §5 Ε4): το έγγραφο διαβάζεται από κάθε μέλος της εταιρείας.
  //    Οι σύνδεσμοι ζουν ως hash στο server-only `vendor_invite_credentials`.
  deliveryChannel: DeliveryChannel;
  preferredChannel: DeliveryChannel | null;
  status: InviteStatus;
  deliveredAt: Timestamp | null;
  openedAt: Timestamp | null;
  submittedAt: Timestamp | null;
  declinedAt: Timestamp | null;
  declineReason: string | null;
  /** Η λήξη του **νεότερου** ζωντανού συνδέσμου — ανανεώνεται σε κάθε νέα έκδοση. */
  expiresAt: Timestamp;
  editWindowExpiresAt: Timestamp | null;
  /**
   * **Η απάντηση ΑΥΤΗΣ της πρόσκλησης** — γράφεται στην πρώτη υποβολή (ADR-876 §5 Σ19).
   * 🔴 Ήταν ερώτημα `(rfqId, vendorContactId)`: με χειροκίνητο email το `vendorContactId` είναι `''`,
   * άρα ο δεύτερος προμηθευτής **έγραφε πάνω** στην προσφορά του πρώτου. Μία πρόσκληση = μία απάντηση.
   * `undefined` σε έγγραφα προ-Σ19.
   */
  quoteId?: string | null;
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
