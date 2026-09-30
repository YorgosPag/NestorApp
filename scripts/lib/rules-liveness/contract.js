/**
 * CHECK 3.96 — ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΣ ΠΥΛΗΣ ΖΩΝΤΑΝΗΣ ΣΥΝΔΕΣΗΣ (ADR-894 §10.7)
 *
 * «Περνά ΚΑΘΕ `allow` που δίνει πρόσβαση σε συνδεδεμένο άνθρωπο από το `signInIsLive()`;»
 *
 * 🔑 Ο κανόνας δεν απαριθμεί ΡΙΖΕΣ (`isAuthenticated`, `isOwner`): ρωτά απευθείας το ΚΑΤΗΓΟΡΗΜΑ. Μια ρίζα που
 * κάποιος «απλοποιήσει» σε σκέτο `request.auth != null` βγαίνει ακάλυπτη αυτόματα — μαζί με ό,τι κρέμεται από
 * αυτήν.
 * ⛔ Το κλειστό σύνολο PUBLIC_READS είναι το ΜΟΝΟ μέρος όπου επιτρέπεται `if true` — με λόγο.
 */

'use strict';

/** Τα δύο αρχεία κανόνων — και τα δύο βλέπουν το ίδιο token. */
const RULES_FILES = Object.freeze(['firestore.rules', 'storage.rules']);

/** Το κατηγόρημα που οφείλει να απαιτεί κάθε μη-δημόσιο `allow`. */
const LIVENESS_PREDICATE = 'signInIsLive';

/** Η ΜΙΑ πηγή του ονόματος του claim — το literal των κανόνων πρέπει να είναι ΙΔΙΟ. */
const CLAIM_SOURCE_FILE = 'src/lib/auth/revoked-sign-ins-claim.ts';
const CLAIM_CONSTANT = 'REVOKED_SIGN_INS_CLAIM';

/** Ελάχιστο μήκος λόγου για δημόσια ανάγνωση (ίδιο πρότυπο με τους ιδιοκτήτες του 3.95). */
const MIN_REASON_LENGTH = 40;

/**
 * Οι ΜΟΝΕΣ δημόσιες αναγνώσεις — κλειδί: `αρχείο :: εσωτερικό match :: πράξεις`. Ό,τι άλλο `if true` ⇒ εύρημα.
 */
const PUBLIC_READS = Object.freeze({
  'firestore.rules :: /public_lands/{landId} :: read':
    'Δημόσιο αντίγραφο οικοπέδου αγγελίας (ADR-777): γραφέας μόνο ο server, διαβάζεται από τον επισκέπτη χωρίς λογαριασμό.',
  'firestore.rules :: /public_buildings/{buildingId} :: read':
    'Δημόσιο αντίγραφο κτιρίου αγγελίας (ADR-777): γραφέας μόνο ο server, διαβάζεται από τον επισκέπτη χωρίς λογαριασμό.',
  'firestore.rules :: /public_listings/{listingId} :: read':
    'Η δημόσια αγγελία (ADR-777): γραφέας μόνο ο server μέσω του συνόρου ανάγνωσης, για κάθε επισκέπτη χωρίς λογαριασμό.',
  'firestore.rules :: /agency_profiles/{companyId} :: read':
    'Το δημόσιο προφίλ γραφείου, OPT-IN με ρητή ανακλητή πράξη του ίδιου του γραφείου· γραφέας μόνο ο server.',
});

const GATE_STATES = Object.freeze({
  UNCOVERED_ALLOW: 'uncovered-allow',
  UNDECLARED_PUBLIC: 'undeclared-public',
  ORPHAN_PUBLIC: 'orphan-public',
  REASONLESS_PUBLIC: 'reasonless-public',
  MISSING_PREDICATE: 'missing-predicate',
  CLAIM_MISMATCH: 'claim-mismatch',
  COVERED: 'covered',
  DENIED: 'if-false',
  PUBLIC: 'public',
});

const BLOCKING = Object.freeze([
  GATE_STATES.UNCOVERED_ALLOW,
  GATE_STATES.UNDECLARED_PUBLIC,
  GATE_STATES.ORPHAN_PUBLIC,
  GATE_STATES.REASONLESS_PUBLIC,
  GATE_STATES.MISSING_PREDICATE,
  GATE_STATES.CLAIM_MISMATCH,
]);

module.exports = {
  BLOCKING,
  CLAIM_CONSTANT,
  CLAIM_SOURCE_FILE,
  GATE_STATES,
  LIVENESS_PREDICATE,
  MIN_REASON_LENGTH,
  PUBLIC_READS,
  RULES_FILES,
};
