/**
 * @fileoverview **ΤΙ ΕΓΙΝΕ ΜΕ ΕΝΑ EMAIL ΠΟΥ ΣΤΕΙΛΑΜΕ** — λεξιλόγιο συμβάντων παράδοσης, ανεξάρτητο παρόχου
 *   (ADR-841 §7 Α21.20).
 * @related lib/communications/email-delivery/mailgun-event-read.ts (ο προσαρμογέας Mailgun) ·
 *   lib/communications/email-delivery/recipient-standing.ts (η κατάσταση ανά διεύθυνση) ·
 *   server/comms/email-delivery/email-delivery-ledger.ts (το ημερολόγιο)
 * @module types/email-delivery
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΣΥΜΒΑΝ ΔΕΝ ΕΙΝΑΙ ΑΠΟΔΕΙΞΗ — Η ΑΠΟΔΕΙΞΗ ΕΙΝΑΙ ΜΙΑ ΚΑΤΗΓΟΡΙΑ ΤΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα `failed` του παρόχου σημαίνει πέντε διαφορετικά πράγματα. Μόνο **ένα** — `mailbox-absent` —
 * λέει «αυτό το γραμματοκιβώτιο δεν υπάρχει». Τα υπόλοιπα είναι **άρνηση του ίδιου του παρόχου να
 * δοκιμάσει** (Mailgun 605), **εξάντληση επαναλήψεων** (`old`), **πολιτική** του παραλήπτη (5.7.x) ή
 * **γεμάτο** γραμματοκιβώτιο (5.2.2). Ένα σύστημα που τα διαβάζει όλα ως «νεκρό» σβήνει σήματα από
 * ζωντανά γραμματοκιβώτια.
 *
 * **Layering**: leaf — καθαροί τύποι και κλειστά σύνολα.
 */

// =============================================================================
// 1. ΤΑ ΚΛΕΙΣΤΑ ΣΥΝΟΛΑ — ο πίνακας είναι η αυθεντία, ο τύπος παράγεται
// =============================================================================

export const EMAIL_DELIVERY_PROVIDERS = ['mailgun'] as const;
export type EmailDeliveryProvider = (typeof EMAIL_DELIVERY_PROVIDERS)[number];

export const EMAIL_DELIVERY_KINDS = [
  /** Ο διακομιστής του παραλήπτη το δέχτηκε. */
  'delivered',
  /** Μόνιμη αποτυχία — **δες την απόδειξη** πριν συμπεράνεις οτιδήποτε. */
  'failed',
  /** Προσωρινή αποτυχία· ο πάροχος ξαναδοκιμάζει. */
  'deferred',
  /** Ο παραλήπτης το σήμανε spam — άρα **το έλαβε**. */
  'complained',
  /** Ο παραλήπτης απεγγράφηκε μέσω του παρόχου. */
  'unsubscribed',
] as const;
export type EmailDeliveryKind = (typeof EMAIL_DELIVERY_KINDS)[number];

export const EMAIL_FAILURE_EVIDENCE = [
  /** 🔴 Το γραμματοκιβώτιο/domain **δεν υπάρχει** (5.1.x · 5.2.1). Η **μόνη** απόδειξη θανάτου. */
  'mailbox-absent',
  /** Ο πάροχος **δεν δοκίμασε** — η διεύθυνση ήταν ήδη στη λίστα του (Mailgun 605/607 · `suppress-*`). */
  'suppressed-send',
  /** Εξαντλήθηκαν οι επαναλήψεις προσωρινών αποτυχιών (Mailgun `old`). Όχι απόδειξη. */
  'exhausted-retries',
  /** Άρνηση πολιτικής/φήμης (5.7.x · `espblock`). Το γραμματοκιβώτιο μπορεί να ζει. */
  'policy',
  /** Γεμάτο γραμματοκιβώτιο (5.2.2) — **ζει**. */
  'mailbox-full',
  'unknown',
] as const;
export type EmailFailureEvidence = (typeof EMAIL_FAILURE_EVIDENCE)[number];

// =============================================================================
// 2. ΣΥΣΧΕΤΙΣΗ ΑΠΟΣΤΟΛΗΣ — τι ταξιδεύει μαζί με το μήνυμα και γυρίζει στο συμβάν
// =============================================================================

/** Ονόματα των μεταβλητών παρόχου (Mailgun `v:<όνομα>`). **Ένα** σημείο ορισμού. */
export const EMAIL_DELIVERY_VARIABLES = {
  purpose: 'nestor-purpose',
  ref: 'nestor-ref',
} as const;

/** Γιατί στάλθηκε — κλειστό σύνολο, ώστε ο δέκτης να μη μαντεύει από κείμενο. */
export const EMAIL_DELIVERY_PURPOSES = ['showcase-email-confirmation'] as const;
export type EmailDeliveryPurpose = (typeof EMAIL_DELIVERY_PURPOSES)[number];

export interface EmailDeliveryCorrelation {
  readonly purpose: EmailDeliveryPurpose;
  /** Ταυτότητα της οντότητας που γέννησε το μήνυμα (π.χ. `secf_*`). */
  readonly ref: string;
}

// =============================================================================
// 3. ΤΟ ΣΥΜΒΑΝ — κανονικοποιημένο, ό,τι κι αν έστειλε ο πάροχος
// =============================================================================

export interface EmailDeliveryEvent {
  readonly provider: EmailDeliveryProvider;
  /** Η ταυτότητα του συμβάντος **στον πάροχο** — το κλειδί ιδεμποτένειας. */
  readonly providerEventId: string;
  /** ISO — πότε συνέβη **στον πάροχο**, όχι πότε το λάβαμε. */
  readonly occurredAt: string;
  /** Κανονικοποιημένη με το `normaliseChannelEmail`. */
  readonly recipient: string;
  readonly kind: EmailDeliveryKind;
  /** Μόνο για `failed`/`deferred` — αλλιώς `null`. */
  readonly evidence: EmailFailureEvidence | null;
  readonly providerReason: string | null;
  readonly smtpCode: number | null;
  /** RFC 3463 (`5.1.1`) — συχνά απών. */
  readonly enhancedCode: string | null;
  readonly providerMessageId: string | null;
  readonly purpose: EmailDeliveryPurpose | null;
  readonly ref: string | null;
}

// =============================================================================
// 4. Η ΚΑΤΑΣΤΑΣΗ ΜΙΑΣ ΔΙΕΥΘΥΝΣΗΣ — προβολή του ημερολογίου
// =============================================================================

export interface RecipientStanding {
  readonly email: string;
  /** Η **νεότερη** απόδειξη `mailbox-absent` — ή `null`. */
  readonly mailboxAbsentAt: string | null;
  /** Το συμβάν που τη στηρίζει. */
  readonly evidenceEventId: string | null;
  readonly lastDeliveredAt: string | null;
  readonly lastComplainedAt: string | null;
  readonly lastEventAt: string | null;
}
