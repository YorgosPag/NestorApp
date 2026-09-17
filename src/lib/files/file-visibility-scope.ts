/**
 * =============================================================================
 * Ο ΠΑΡΑΓΩΓΟΣ ΤΟΥ ΦΙΛΤΡΟΥ ΟΡΑΤΟΤΗΤΑΣ ΤΩΝ ΛΙΣΤΩΝ ΑΡΧΕΙΩΝ (ADR-862 Φ0 Β11)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Ποιο φίλτρο πρέπει να δηλώνει ΚΑΘΕ client λίστα της συλλογής
 * `files`, ώστε ο κανόνας `allow list` να μπορεί να την εγκρίνει;»*
 *
 * 🔴 **Χωρίς αυτό, η λίστα απορρίπτεται ΟΛΟΚΛΗΡΗ** — το Firestore κρίνει το `list`
 * από τα φίλτρα, όχι από τα δεδομένα (*«rules are not filters — queries are all or
 * nothing»*). Δεν «λείπουν μερικά αρχεία»: λείπουν **όλα**, με `permission-denied`.
 *
 * 🏆 **Πού ξεπερνάμε**: η Firebase ζητά ο συν-σχεδιασμός ερωτήματος↔κανόνα να γίνεται
 * **με το χέρι σε κάθε ερώτημα**. Εδώ υπάρχει **ΕΝΑΣ** παραγωγός, το
 * `firestoreQueryService` τον εφαρμόζει **αυτόματα** (`read-scope-config.ts`, όπως
 * εφαρμόζει τον μισθωτή), και η πύλη του Β12 μπλοκάρει κάθε άμεσο client ερώτημα
 * `files` που τον παρακάμπτει.
 *
 * ⚠️ **ΤΑ WIP ΔΕΝ ΧΑΝΟΝΤΑΙ — ΣΕΡΒΙΡΟΝΤΑΙ ΑΛΛΙΩΣ**: ο κανόνας δεν ξέρει ομάδες, άρα τα
 * `author` τα φέρνει η διαδρομή διακομιστή (`/api/files/wip`), όπου κρίνει ο
 * `decideContainerAccess`.
 *
 * @module lib/files/file-visibility-scope
 * @see lib/auth/container-read-reach — η παραγωγή της εμβέλειας
 * @see firestore.rules `match /files/{fileId}` `allow list`
 */

import { where, type QueryConstraint } from 'firebase/firestore';

import { readReachForState } from '@/lib/auth/container-read-reach';

/** Το όνομα του πεδίου — ΕΝΑ σημείο για κανόνα, ερώτημα και πύλη. */
const FILE_READ_REACH_FIELD = 'cdeReadReach';

/**
 * Η εμβέλεια που δηλώνει κάθε client λίστα: του **γραφείου**.
 *
 * 🔑 Παράγεται από τη γραμμή `SHARED` του πίνακα, όχι literal: αν ποτέ αλλάξει ο
 * φράχτης των κοινοποιημένων, η λίστα ακολουθεί.
 */
const LIST_READ_REACH = readReachForState('SHARED');

/**
 * **Τα φίλτρα ορατότητας κάθε client λίστας `files`.**
 *
 * @example
 * query(collection(db, COLLECTIONS.FILES), where('companyId', '==', companyId), ...fileListVisibilityConstraints())
 */
function fileListVisibilityConstraints(): QueryConstraint[] {
  return [where(FILE_READ_REACH_FIELD, '==', LIST_READ_REACH)];
}

/**
 * **Τα φίλτρα της λίστας «τα δικά μου»** — ο δεύτερος δρόμος που δέχεται ο κανόνας.
 *
 * 🔑 Φέρνει **και** τα WIP του δημιουργού, που η λίστα γραφείου δεν φέρνει. Όποιος
 * ψάχνει **συγκεκριμένο** αρχείο (π.χ. επαναχρησιμοποίηση εγγραφής από auto-save)
 * ρωτά **και τους δύο** δρόμους με {@link fileListReadPaths}.
 */
function fileListOwnConstraints(uid: string): QueryConstraint[] {
  return [where('createdBy', '==', uid)];
}

/**
 * **Οι δύο δρόμοι** που μπορεί να δηλώσει μια client λίστα — για αναζήτηση που δεν
 * επιτρέπεται να «χάσει» το WIP του αιτούντος.
 *
 * @example
 * for (const scope of fileListReadPaths(uid)) { const hit = await find(scope); if (hit) return hit; }
 */
export function fileListReadPaths(uid: string): QueryConstraint[][] {
  return [fileListVisibilityConstraints(), fileListOwnConstraints(uid)];
}
