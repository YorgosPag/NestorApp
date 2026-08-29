/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για τα εισερχόμενα αιτήματα (Σ2/Σ3).
 * @related ADR-827 §9.21 · N.11 · CHECK 3.8
 * @module components/mandate/inbox/mandate-inbox-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΠΙΝΑΚΕΣ ΚΑΙ ΟΧΙ ``t(`…${reason}`)`` — ΤΡΙΤΗ ΦΟΡΑ ΤΟ ΙΔΙΟ ΜΑΘΗΜΑ ΣΕ ΑΥΤΟ ΤΟ ADR
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το δυναμικό κλειδί θα ήταν μία γραμμή αντί για δώδεκα. Θα ήταν επίσης:
 *
 * 1. **Δομικά αόρατο στη CHECK 3.8** — η πύλη διαβάζει **κυριολεκτικά** ορίσματα του
 *    `t()`. Κλειδί που λείπει προσγειώνεται πράσινο και βγαίνει **ωμό στην οθόνη**.
 * 2. **Καύσιμο για το ανοιχτό του §8.33** — κάθε νέα ανεπίλυτη δυναμική `t()` κάνει
 *    τον τεμαχιστή του route slice να αρνείται να παράγει.
 *
 * 🔑 **Οι πίνακες ΔΕΝ είναι δεύτερη αυθεντία**: ο τύπος τους είναι
 * `Record<ΚλειστόΣύνολο, string>` ⇒ **νέα** τιμή **δεν μεταγλωττίζεται** μέχρι κάποιος
 * να της δώσει κείμενο. Ένα δυναμικό κλειδί, αντίθετα, θα «δούλευε» και θα ζωγράφιζε
 * `mandate.inbox.refusal.νεος-kodikos` σε παραγωγή.
 *
 * ⚠️ **Κυριολεκτικοί πίνακες, ΟΧΙ spread**: ο εξαγωγέας διαβάζει **τιμές σταθεράς
 * module**· ένα `{...A, ...B}` **δεν διαβάζεται** και βγαίνει *«unresolved dynamic
 * t()»* (Π3, §9.14).
 */

import type { MandateDecisionRefusal } from '@/services/mandate/mandate-decision-vocabulary';
import type { MandateRequestDecision } from '@/types/mandate-request';

/** Το namespace της αγοράς — **`property-market`** (ADR-777 §8.38). */
export const INBOX_NS = 'property-market';

/** Οι τρεις κάδοι της οθόνης — τα ονόματα του {@link MandateInboxGroups}. */
export const INBOX_GROUPS = ['actionable', 'lapsed', 'decided'] as const;

export type MandateInboxGroup = (typeof INBOX_GROUPS)[number];

/** Επικεφαλίδα ομάδας. */
export const GROUP_LABEL_KEYS: Record<MandateInboxGroup, string> = {
  actionable: 'property-market:mandate.inbox.groups.actionable',
  lapsed: 'property-market:mandate.inbox.groups.lapsed',
  decided: 'property-market:mandate.inbox.groups.decided',
};

/**
 * **Τι σημαίνει η ομάδα** — μία πρόταση, κάτω από την επικεφαλίδα.
 *
 * 🔑 Το `lapsed` **οφείλει** να εξηγηθεί: χωρίς πρόταση, ένα αίτημα που δεν έχει
 * κουμπιά διαβάζεται ως **σφάλμα της εφαρμογής**, όχι ως ληγμένη πρόταση.
 */
export const GROUP_HINT_KEYS: Record<MandateInboxGroup, string> = {
  actionable: 'property-market:mandate.inbox.hints.actionable',
  lapsed: 'property-market:mandate.inbox.hints.lapsed',
  decided: 'property-market:mandate.inbox.hints.decided',
};

/** Το κουμπί κάθε απόφασης. */
export const DECISION_LABEL_KEYS: Record<MandateRequestDecision, string> = {
  accepted: 'property-market:mandate.inbox.decisions.accepted',
  'declined-revisable': 'property-market:mandate.inbox.decisions.declined-revisable',
  'declined-final': 'property-market:mandate.inbox.decisions.declined-final',
};

/**
 * **Τι θα συμβεί αν το πατήσω** — ο ΜΟΝΟΣ τρόπος να είναι η επιλογή ενημερωμένη.
 *
 * 🔴 **Η διαφορά των δύο «όχι» είναι ΕΞΟΥΣΙΑ, όχι ύφος** — και ένας μεσίτης που δεν
 * το διαβάζει θα πατούσε «οριστικό» εννοώντας «όχι έτσι». Η υπόδειξη **δεν είναι
 * διακόσμηση**: είναι το κείμενο που κάνει την απόφαση συνειδητή.
 */
export const DECISION_HINT_KEYS: Record<MandateRequestDecision, string> = {
  accepted: 'property-market:mandate.inbox.decisionHints.accepted',
  'declined-revisable': 'property-market:mandate.inbox.decisionHints.declined-revisable',
  'declined-final': 'property-market:mandate.inbox.decisionHints.declined-final',
};

/** Η απόφαση, ως **γεγονός** — στη γραμμή που έχει ήδη κριθεί. */
export const DECIDED_LABEL_KEYS: Record<MandateRequestDecision, string> = {
  accepted: 'property-market:mandate.inbox.decided.accepted',
  'declined-revisable': 'property-market:mandate.inbox.decided.declined-revisable',
  'declined-final': 'property-market:mandate.inbox.decided.declined-final',
};

/**
 * **Γιατί δεν κρίθηκε** — κάθε λόγος με τη **δική του** θεραπεία.
 *
 * ⚠️ Ένας κοινός κάδος *«δεν έγινε»* θα άφηνε τον μεσίτη να ξαναπατά για πρόβλημα
 * που **δεν λύνεται από αυτόν** (`identity-incomplete`).
 */
export const REFUSAL_KEYS: Record<MandateDecisionRefusal, string> = {
  'request-absent': 'property-market:mandate.inbox.refusals.request-absent',
  'request-not-pending': 'property-market:mandate.inbox.refusals.request-not-pending',
  'request-lapsed': 'property-market:mandate.inbox.refusals.request-lapsed',
  'listing-withdrawn': 'property-market:mandate.inbox.refusals.listing-withdrawn',
  'listing-already-brokered': 'property-market:mandate.inbox.refusals.listing-already-brokered',
  'identity-incomplete': 'property-market:mandate.inbox.refusals.identity-incomplete',
  'mandate-invalid': 'property-market:mandate.inbox.refusals.mandate-invalid',
};

/** Τα υπόλοιπα κείμενα της οθόνης. */
export const INBOX_KEYS = {
  title: 'property-market:mandate.inbox.title',
  lead: 'property-market:mandate.inbox.lead',
  empty: 'property-market:mandate.inbox.empty',
  emptyHint: 'property-market:mandate.inbox.emptyHint',
  failed: 'property-market:mandate.inbox.failed',
  retry: 'property-market:mandate.inbox.retry',
  loading: 'property-market:mandate.inbox.loading',
  unseen: 'property-market:mandate.inbox.unseen',
  withoutListing: 'property-market:mandate.inbox.withoutListing',
  truncated: 'property-market:mandate.inbox.truncated',
  open: 'property-market:mandate.inbox.open',
  close: 'property-market:mandate.inbox.close',
  backToCatalog: 'property-market:mandate.inbox.backToCatalog',
  requestedAt: 'property-market:mandate.inbox.requestedAt',
  expiresAt: 'property-market:mandate.inbox.expiresAt',
  compensation: 'property-market:mandate.inbox.compensation',
  agreement: 'property-market:mandate.inbox.agreement',
  revision: 'property-market:mandate.inbox.revision',
  decidingFailed: 'property-market:mandate.inbox.decidingFailed',
  anonymity: 'property-market:mandate.inbox.anonymity',
} as const;

/**
 * **Ο παρονομαστής**: κάθε τιμή κάθε κλειστού συνόλου έχει κείμενο σε **κάθε** πίνακα.
 *
 * 🔑 Ο τύπος το εγγυάται ήδη· αυτό υπάρχει για την **άγκυρα**, ώστε η εγγύηση να
 * μπορεί να **κοκκινίσει** και όχι μόνο να μη χτίζει (CHECK 3.54).
 */
export function everyInboxCodeNamed(): boolean {
  const tables = [GROUP_LABEL_KEYS, GROUP_HINT_KEYS, DECISION_LABEL_KEYS,
    DECISION_HINT_KEYS, DECIDED_LABEL_KEYS, REFUSAL_KEYS];

  return tables.every((table) =>
    Object.values(table).every((key) => key.startsWith(`${INBOX_NS}:mandate.inbox.`)),
  );
}
