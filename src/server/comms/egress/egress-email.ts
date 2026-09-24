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
  | { readonly ok: false; readonly error: string };
