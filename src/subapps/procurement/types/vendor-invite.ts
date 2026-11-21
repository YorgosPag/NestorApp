import type { Timestamp } from 'firebase/firestore';

import type { VendorInviteDelivery } from './vendor-invite-delivery';

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
   * `null` μέχρι την πρώτη υποβολή· **υποχρεωτικό** πεδίο (Φ7 — δεν υπάρχουν έγγραφα προ-Σ19).
   */
  quoteId: string | null;
  remindersSentAt: Timestamp[];
  lastReminderAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /**
   * Snapshot of recipient email at delivery. 🔒 **Always `null` for a platform supplier** (ADR-923 §5.13 Τ5): its
   * quote-intake address is private and this document is readable by every member of the buyer's company.
   */
  recipientEmail: string | null;
  /**
   * Snapshot of the recipient's display name at creation — `null` when a manual invite was sent without a name
   * (ADR-327 §7.5, Ε3: the greeting is then neutral; the email address is never used as a name).
   */
  recipientName: string | null;
  /**
   * ADR-327 §7.5 — the buyer's personal note (plain text, ≤ `VENDOR_INVITE_NOTE_MAX_LENGTH`), carried by EVERY
   * delivery of this invite (first send · outbox · resend · self-service renew). Absent on invites before §7.5.
   */
  buyerNote?: string | null;
  /** ADR-923 §5.13 Τ5 — the delivery outbox of an RFQ fan-out invite. Absent on manual and legacy invites. */
  delivery?: VendorInviteDelivery;
}

// ============================================================================
// DTOS
// ============================================================================

interface CreateVendorInviteBaseDTO {
  rfqId: string;
  deliveryChannel: DeliveryChannel;
  expiresInDays?: number;
  /**
   * ADR-327 §7.5 (Ε1β) — η ημέρα `YYYY-MM-DD` ως την οποία ισχύει ο σύνδεσμος (ολόκληρη, ώρα του φορέα).
   * Κερδίζει το `expiresInDays`. Κρίση: `judgeInviteExpiryDay` (`config/vendor-invite-policy`).
   */
  expiresOn?: string;
  /** ADR-327 §7.5 (Ε1) — προσωπικό σημείωμα του αγοραστή, απλό κείμενο ≤ `VENDOR_INVITE_NOTE_MAX_LENGTH`. */
  buyerNote?: string | null;
}

interface CreateVendorInviteFromContactDTO extends CreateVendorInviteBaseDTO {
  vendorContactId: string;
  manualEmail?: undefined;
  manualName?: undefined;
}

interface CreateVendorInviteManualDTO extends CreateVendorInviteBaseDTO {
  vendorContactId?: undefined;
  manualEmail: string;
  /** Προαιρετικό (Ε3): χωρίς όνομα ο χαιρετισμός είναι ουδέτερος — ποτέ το email στη θέση του. */
  manualName?: string;
}

export type CreateVendorInviteDTO =
  | CreateVendorInviteFromContactDTO
  | CreateVendorInviteManualDTO;
