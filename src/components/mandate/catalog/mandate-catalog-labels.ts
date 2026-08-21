/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για τον κατάλογο εντολών.
 * @related ADR-777 §8.34 · lib/mandate/mandate-standing.ts · N.11 · CHECK 3.8
 * @module components/mandate/catalog/mandate-catalog-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ `t(\`…standing.${row.standing}\`)`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το δυναμικό κλειδί θα ήταν μία γραμμή αντί για δέκα. Θα ήταν επίσης:
 *
 * 1. **Αόρατο στη CHECK 3.8** — η πύλη που ρωτά «υπάρχει αυτό το κλειδί;» διαβάζει
 *    **κυριολεκτικά** ορίσματα του `t()`. Ένα κλειδί που λείπει θα προσγειωνόταν
 *    πράσινο και θα έβγαινε **ωμό στην οθόνη**. Είναι ακριβώς το μάθημα **Μ-Η** του
 *    §8.33: *«κανένα μήνυμα “τι λείπει” δεν ελεγχόταν ποτέ, γιατί χτίζεται δυναμικά»*.
 * 2. **Καύσιμο για το ανοιχτό πρόβλημα του §8.33** — οι **76 ανεπίλυτες δυναμικές
 *    `t()`** είναι ο λόγος που ο generator του route slice **αρνήθηκε** να παράγει.
 *    Κάθε νέα δυναμική κλήση κάνει εκείνη τη δουλειά **δυσκολότερη**.
 *
 * 🔑 **Ο πίνακας ΔΕΝ είναι δεύτερη αυθεντία**, και αυτό είναι το κρίσιμο: ο τύπος του
 * είναι `Record<MandateStanding, string>` ⇒ **ενδέκατη κατάσταση δεν μεταγλωττίζεται**
 * μέχρι κάποιος να της δώσει κείμενο. Ένα δυναμικό κλειδί, αντίθετα, θα «δούλευε» και
 * θα ζωγράφιζε `offer.mandates.standing.νεα-κατασταση` σε παραγωγή.
 *
 * ⚠️ **Η άγκυρα `mandate-catalog-labels.test.ts` επιβάλλει το άλλο μισό**: ότι κάθε
 * κλειδί εδώ **υπάρχει** στα `el` ΚΑΙ στα `en`. Ο μεταγλωττιστής φυλά την πληρότητα
 * του πίνακα· μόνο ένα test φυλά την ύπαρξη του κειμένου.
 */

import type {
  MandateStanding,
  MandateStandingGroup,
} from '@/lib/mandate/mandate-standing';
import type { MandateActionRejection } from '@/lib/mandate/mandate-actions';
import type { MandateProofVia } from '@/types/owner-property-mandate';

/** Το namespace που ταξιδεύει **ολόκληρο** στο κέλυφος — δες ADR-744 / CHECK 3.34. */
export const CATALOG_NS = 'search-results';

const K = 'search-results:offer.mandates';

/** Το κοινό κλειδί, ώστε οι σταθερές παρακάτω να διαβάζονται σαν πρόταση. */
export const CATALOG_KEYS = {
  title: `${K}.title`,
  lead: `${K}.lead`,
  create: `${K}.create`,
  loading: `${K}.loading`,
  error: `${K}.error`,
  retry: `${K}.retry`,
  empty: `${K}.empty`,
  emptyHint: `${K}.emptyHint`,
  truncated: `${K}.truncated`,
  clientUnknown: `${K}.clientUnknown`,
  clientLabel: `${K}.clientLabel`,
  expiresIn: `${K}.expiresIn`,
  expiredLabel: `${K}.expiredLabel`,
  onTheMarket: `${K}.onTheMarket`,
  offTheMarket: `${K}.offTheMarket`,
  notifiedNever: `${K}.notifiedNever`,
  viewedNever: `${K}.viewedNever`,
  groupCount: `${K}.groupCount`,
  working: `${K}.action.working`,
  networkFailure: `${K}.reject.network`,
} as const;

/** Ο τίτλος κάθε **ομάδας** — εξαντλητικά. */
export const GROUP_LABEL_KEYS: Record<MandateStandingGroup, string> = {
  'needs-us': `${K}.group.needs-us`,
  'waiting-client': `${K}.group.waiting-client`,
  expiring: `${K}.group.expiring`,
  settled: `${K}.group.settled`,
  closed: `${K}.group.closed`,
};

/** Το **όνομα** κάθε κατάστασης. */
export const STANDING_LABEL_KEYS: Record<MandateStanding, string> = {
  'unannounced-live': `${K}.standing.unannounced-live`,
  'never-notified': `${K}.standing.never-notified`,
  'link-revoked': `${K}.standing.link-revoked`,
  'expiring-soon': `${K}.standing.expiring-soon`,
  'awaiting-decision': `${K}.standing.awaiting-decision`,
  'awaiting-view': `${K}.standing.awaiting-view`,
  declined: `${K}.standing.declined`,
  expired: `${K}.standing.expired`,
  'expired-unanswered': `${K}.standing.expired-unanswered`,
  live: `${K}.standing.live`,
};

/**
 * **Τι να κάνει ο μεσίτης** σε κάθε κατάσταση.
 *
 * 🔑 Ξεχωριστό από το όνομα, και είναι η ουσία της οθόνης: ένα «Δεν στάλθηκε ποτέ» που
 * δεν λέει *«η επαφή δεν είχε email — συμπληρώστε το»* είναι **διάγνωση χωρίς
 * θεραπεία**. Το MLS δίνει μόνο το πρώτο.
 */
export const STANDING_HINT_KEYS: Record<MandateStanding, string> = {
  'unannounced-live': `${K}.standingHint.unannounced-live`,
  'never-notified': `${K}.standingHint.never-notified`,
  'link-revoked': `${K}.standingHint.link-revoked`,
  'expiring-soon': `${K}.standingHint.expiring-soon`,
  'awaiting-decision': `${K}.standingHint.awaiting-decision`,
  'awaiting-view': `${K}.standingHint.awaiting-view`,
  declined: `${K}.standingHint.declined`,
  expired: `${K}.standingHint.expired`,
  'expired-unanswered': `${K}.standingHint.expired-unanswered`,
  live: `${K}.standingHint.live`,
};

/** Η **προέλευση** της έγκρισης — ποτέ κρυμμένη από τον κατάλογο. */
export const PROOF_LABEL_KEYS: Record<MandateProofVia, string> = {
  'owner-consent': `${K}.proof.owner-consent`,
  'agency-attestation': `${K}.proof.agency-attestation`,
};

/** Οι δύο πράξεις. */
export const ACTION_LABEL_KEYS = {
  resend: `${K}.action.resend`,
  revoke: `${K}.action.revoke`,
} as const;

/** Τι λέμε όταν **πέτυχε** η πράξη. */
export const ACTION_DONE_KEYS = {
  resend: `${K}.actionDone.resend`,
  revoke: `${K}.actionDone.revoke`,
} as const;

/** Τι λέμε όταν ο διακομιστής **αρνήθηκε** — κάθε λόγος με δικό του κείμενο. */
export const REJECTION_KEYS: Record<MandateActionRejection, string> = {
  absent: `${K}.reject.absent`,
  'not-brokered': `${K}.reject.not-brokered`,
  declined: `${K}.reject.declined`,
  expired: `${K}.reject.expired`,
  'not-pending': `${K}.reject.not-pending`,
  'already-revoked': `${K}.reject.already-revoked`,
  'no-address': `${K}.reject.no-address`,
  'write-failed': `${K}.reject.write-failed`,
};
