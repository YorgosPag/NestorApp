/**
 * Firestore Rules Test Coverage — **ΣΗΜΑΤΑ ΟΨΕΩΝ** (ADR-901 §14.8)
 *
 * `conveyance_view_signals` — ένα έγγραφο ανά **όψη**, μόνο αριθμός (`revision`). Ανάγνωση **μόνο `get`** από τον
 * **κάτοχο** του σήματος· `list` και κάθε γραφή: κανείς.
 *
 * Ο πίνακας των 35 κελιών μετρά το έγγραφο της **όψης του οικοδεσπότη** (`companyId` του σπαρμένου μισθωτή) — το
 * πρότυπο `belongsToCompany` που φοράει κάθε συλλογή του χώρου. Τα **δύο** άλλα σχήματα του κανόνα δεν εκφράζονται
 * σε πίνακα ενός εγγράφου και τα φρουρούν οι άγκυρες της σουίτας:
 *   - η όψη **συμμετοχής** (`uid`): ο ίδιος ✅ · ο διαχειριστής του χώρου-οικοδεσπότη ❌ (`not_owner`)
 *   - το **ανύπαρκτο** έγγραφο (`resource == null`): κάθε πιστοποιημένος ✅ — ο listener ανοίγει πριν την 1η αύξηση
 *   - ο ιδιώτης **χωρίς** εταιρεία μπροστά σε όψη οικοδεσπότη ❌ (η παγίδα `null == null`)
 *
 * 🔑 **Γιατί δεν είναι `denyAllMatrix`**: η ανάγνωση **επιτρέπεται** — είναι ο λόγος ύπαρξης της συλλογής (ζωντανή
 *    οθόνη χωρίς F5). Και **γιατί όχι εξαιρέσεις**: ο κανόνας κρίνει κάθε κελί με γνωστή πρόθεση — μια ομολογία
 *    άγνοιας εδώ θα ήταν ψεύτικη (ίδιο σκεπτικό με το `coverage-matrices-network.ts`).
 *
 * @module tests/firestore-rules/_registry/coverage-matrices-view-signals
 * @since 2026-10-04 (ADR-901 §14.8)
 */

import { cell } from './coverage-matrices';
import { defineMatrix, type CoverageDefinition } from './coverage-completeness';
import { ALL_PERSONAS, type Persona } from './personas';

/** Οι πιστοποιημένοι — ο `anonymous` κόβεται νωρίτερα (`missing_claim`), πάντα. */
const AUTHENTICATED: readonly Persona[] = ALL_PERSONAS.filter((p) => p !== 'anonymous');

/** Όσοι έχουν το `companyId` του σπαρμένου μισθωτή — ή παρακάμπτουν με ρόλο (super admin). */
const OWNERS_OF_HOST_SIGNAL: readonly Persona[] = ['super_admin', 'same_tenant_admin', 'same_tenant_user', 'external_user'];

export function viewSignalMatrix(): CoverageDefinition {
  return defineMatrix('viewSignalMatrix', [
    // ── READ (get): ο κάτοχος. Ο ξένος μισθωτής ΔΕΝ μαθαίνει ούτε ότι «κάτι κινείται».
    ...OWNERS_OF_HOST_SIGNAL.map((p) => cell(p, 'read', 'allow')),
    cell('cross_tenant_admin', 'read', 'deny', 'cross_tenant'),
    cell('cross_tenant_user', 'read', 'deny', 'cross_tenant'),
    cell('anonymous', 'read', 'deny', 'missing_claim'),

    // ── LIST: κανείς — μια λίστα θα έδειχνε ΠΟΙΕΣ όψεις κινούνται (ο χρονισμός ως πληροφορία).
    ...AUTHENTICATED.map((p) => cell(p, 'list', 'deny', 'server_only')),
    cell('anonymous', 'list', 'deny', 'missing_claim'),

    // ── CREATE / UPDATE / DELETE: κανείς — γράφει ΜΟΝΟ ο server, μέσα στη συναλλαγή της πράξης.
    ...(['create', 'update', 'delete'] as const).flatMap((operation) => [
      ...AUTHENTICATED.map((p) => cell(p, operation, 'deny', 'server_only')),
      cell('anonymous', operation, 'deny', 'missing_claim'),
    ]),
  ]);
}
