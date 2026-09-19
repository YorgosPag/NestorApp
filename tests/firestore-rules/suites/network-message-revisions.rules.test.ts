/**
 * Firestore Rules — συλλογή `network_message_revisions` (ADR-867 Β7)
 *
 * Πρότυπο: κλειστό **και στις δύο πλευρές**, για **καθέναν** — `networkServerOnlyMatrix`.
 *
 * 🔑 **Η ΕΠΕΞΕΡΓΑΣΙΑ ΔΕΝ ΕΧΕΙ ΟΡΙΟ ΧΡΟΝΟΥ** (Teams · Slack · Google Chat — απόφαση της έρευνας,
 * 2026-09-19). Ό,τι επιτρέπει να ξαναγραφτεί ένα μήνυμα **οποτεδήποτε** σε νήμα που είναι
 * **τεκμήριο** (ADR-834 (β) ③) είναι ανεκτό **μόνο** επειδή κάθε προηγούμενη μορφή μένει εδώ,
 * εκτός κάθε πελάτη — **και** του ίδιου του αποστολέα. Αν μπορούσε να τη διαβάσει, θα μπορούσε να
 * τη ζητήσει· ό,τι φορτώνεται, διαρρέει σε κάποια διαδρομή.
 *
 * 📐 Πρότυπο: Microsoft Teams (αντίγραφο συμμόρφωσης) · Slack («save edits and deletions»).
 *
 * @since 2026-09-19 (ADR-867 Β7)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'network_message_revisions',
)!;

describe('network_message_revisions.rules — ό,τι αντικαταστάθηκε ΔΕΝ διαβάζεται από κανέναν πελάτη (ADR-867 Β7)', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
