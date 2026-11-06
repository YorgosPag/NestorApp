/**
 * Το μήνυμα όπως φτάνει στην **πόρτα εξόδου** — ΕΝΑ σχήμα για κάθε πάροχο και για το outbox.
 *
 * Υπερσύνολο των δύο σχημάτων που ζούσαν χωριστά (ADR-876 §5.8 Σ22): ο `EmailAdapter` περνούσε
 * κεφαλίδες αλλά όχι συνημμένα/συσχέτιση, ο `sendReplyViaMailgun` το ανάποδο. Ένας πάροχος που
 * αγνοούσε ένα πεδίο το έχανε **σιωπηλά** ανάλογα με το ποιος δρόμος το έστειλε.
 *
 * @module server/comms/egress/egress-email
 * @see ADR-876 §5.8 Σ22
 */

import type { SenderHeader } from '@/services/company/sender-identity';
import type { EmailDeliveryCorrelation } from '@/types/email-delivery';

export interface EgressAttachment {
  /** Όνομα όπως εμφανίζεται στο email (π.χ. `A-42_Acme_20260317.pdf`). */
  readonly filename: string;
  readonly content: Buffer | Blob;
  readonly contentType: string;
}

export interface EgressEmail {
  readonly to: string;
  /** ADR-857 Φ9 — **μόνο** από τη ρίζα ταυτότητας αποστολέα· απουσία ⇒ `resolveSenderHeader()`. */
  readonly from?: SenderHeader;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  /** Κεφαλίδες φακέλου, **ήδη ελεγμένες** για έγχυση (`safeHeaderEntries`). */
  readonly headers?: Readonly<Record<string, string>>;
  readonly attachments?: readonly EgressAttachment[];
  readonly correlation?: EmailDeliveryCorrelation;
}

export type EgressResult =
  | { readonly ok: true; readonly messageId?: string }
  | {
      readonly ok: false;
      readonly error: string;
      /**
       * 🔑 ADR-923 §5.13 Τ5 Χ-Α — `true` ⇒ το αίτημα **ίσως έφτασε** στον πάροχο: βλάβη δικτύου (ECONNRESET, άκυρη
       * σύνδεση, λήξη χρόνου) ή 5xx. Ο πάροχος μπορεί να το δέχτηκε, άρα δεν είναι βέβαιη άρνηση. Ρητό 4xx ⇒ απουσία.
       */
      readonly uncertain?: true;
    };

/** HTTP status που **δεν** αποδεικνύει άρνηση: ο διακομιστής ίσως επεξεργάστηκε το αίτημα πριν πέσει. */
export function statusLeavesOutcomeUncertain(status: number): boolean {
  return status >= 500;
}
