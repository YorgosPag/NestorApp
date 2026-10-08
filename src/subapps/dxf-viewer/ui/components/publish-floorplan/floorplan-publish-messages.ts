/**
 * @fileoverview **ΤΙ ΛΕΜΕ ΣΤΟΝ ΑΝΘΡΩΠΟ ΜΕΤΑ ΤΗ ΔΗΜΟΣΙΕΥΣΗ** — η έκβαση του διακομιστή σε ΕΝΑ μήνυμα (ADR-909 Β2.5).
 * @related ../../../io/floorplan-publish/publish-floorplan-to-property · locales `publishFloorplan.outcomes.*`
 * @module subapps/dxf-viewer/ui/components/publish-floorplan/floorplan-publish-messages
 *
 * 🔴 **«ΑΝΕΒΗΚΕ» ΔΕΝ ΣΗΜΑΙΝΕΙ «ΤΟ ΒΛΕΠΕΙ ΤΟ ΚΟΙΝΟ».** Η πόρτα απαντά επιτυχία και όταν η κάτοψη δεν δηλώθηκε
 * (`full` / `failed`) ή η αγγελία δεν ξαναπροβλήθηκε. Ένας διάλογος που κλείνει σιωπηλά σε κάθε «200» θα
 * άφηνε τον άνθρωπο να νομίζει ότι η αγγελία άλλαξε — η εκκρεμότητα που το ADR-845 §7.17 κατέγραψε για
 * **κάθε** πόρτα υλικού *(«η απάντηση φέρει `listing`, αλλά καμία οθόνη δεν το δείχνει»)*.
 *
 * ⛔ Καθαρό module — χωρίς React, ώστε η σειρά προτεραιότητας να ελέγχεται με ένα test πίνακα.
 */

import type {
  FloorplanDeclared,
  FloorplanListing,
} from '../../../io/floorplan-publish/publish-floorplan-to-property';

export type FloorplanOutcomeMessage =
  | 'published'
  | 'uploaded-not-listed'
  | 'declared-full'
  | 'declared-failed'
  | 'listing-failed';

/**
 * **Το ένα μήνυμα**, με σειρά: πρώτα ό,τι εμποδίζει την κάτοψη να φανεί *(δήλωση)*, μετά η αγγελία.
 *
 * 🔑 Μόνο `listing === 'published'` λέει «δημοσιεύτηκε». Άγνωστη τιμή ⇒ το **μετριοπαθές** μήνυμα: ποτέ
 * ισχυρισμός ότι το κοινό βλέπει κάτι που δεν επιβεβαιώθηκε.
 */
export function floorplanOutcomeMessageOf(
  declared: FloorplanDeclared,
  listing: FloorplanListing,
): FloorplanOutcomeMessage {
  if (declared === 'full') return 'declared-full';
  if (declared === 'failed') return 'declared-failed';
  if (listing === 'published') return 'published';
  return listing === 'failed' ? 'listing-failed' : 'uploaded-not-listed';
}
