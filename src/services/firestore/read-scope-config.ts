/**
 * @fileoverview Read Scope Configuration — per-collection read paths (ADR-862 Φ0 Β11)
 *
 * Ο **αδελφός** του `tenant-config.ts`: εκείνο δηλώνει **σε ποιον μισθωτή** ανήκει μια
 * λίστα, αυτό **από ποιους δρόμους** επιτρέπεται να διαβάσει έγγραφα του μισθωτή.
 *
 * 🔴 Γιατί χρειάζεται (μετρημένο 2026-09-17): το Firestore κρίνει τα `list` από τα
 * φίλτρα του ερωτήματος. Μια συλλογή της οποίας ο κανόνας `allow list` ζητά πεδίο
 * ορατότητας **πρέπει** να το βλέπει σε κάθε λίστα — αλλιώς η λίστα απορρίπτεται
 * ολόκληρη. Εδώ δηλώνεται **μία φορά**, και το `firestoreQueryService` το εφαρμόζει
 * σε `getAll` · `subscribe` · `batchGet`, όπως εφαρμόζει τον μισθωτή, ενώνοντας τους
 * δρόμους (`firestore-read-paths.ts`).
 *
 * ⚠️ Το `tenantOverride: 'skip'` **ΔΕΝ** παρακάμπτει τους δρόμους: άλλη ερώτηση («ποιος
 * μισθωτής») από αυτήν («ποια έγγραφα»), και ο κανόνας τα ζητά και τα δύο.
 */

import type { QueryConstraint } from 'firebase/firestore';

import type { CollectionKey } from '@/config/firestore-collections';
import { fileListReadPaths } from '@/lib/files/file-visibility-scope';

/** Συλλογές με φράχτη ανάγνωσης στον κανόνα `list`. Απούσα = ένας δρόμος, χωρίς φίλτρο. */
const READ_PATHS: Partial<Record<CollectionKey, (uid: string) => QueryConstraint[][]>> = {
  FILES: fileListReadPaths,
};

/**
 * **Το πεδίο ισότητας κάθε δρόμου, ως ΔΕΔΟΜΕΝΟ** — για την πύλη κάλυψης δεικτών (CHECK 3.15).
 *
 * 🔴 Γιατί υπάρχει: η 3.15 διαβάζει τον κώδικα **στατικά** και ήξερε μόνο τον μισθωτή. Χωρίς
 * αυτόν τον πίνακα, ερώτημα `files` με `orderBy` θα περνούσε πράσινο ενώ στην παραγωγή θα
 * έπεφτε σε `FAILED_PRECONDITION` (κανένας δείκτης με `cdeReadReach`/`createdBy`).
 * ⚠️ Literal επίτηδες (όχι σταθερές από άλλο αρχείο), ώστε ο AST αναγνώστης να τον διαβάζει.
 * Η συμφωνία του με το {@link READ_PATHS} **αποδεικνύεται** από την άγκυρα Α22.
 */
export const READ_PATH_FIELDS: Partial<Record<CollectionKey, readonly string[]>> = {
  FILES: ['cdeReadReach', 'createdBy'],
};

/** Ο δρόμος μιας συλλογής χωρίς φράχτη: ένας, χωρίς επιπλέον φίλτρο. */
const UNSCOPED_PATHS: readonly QueryConstraint[][] = [[]];

/** Έχει η συλλογή φράχτη ανάγνωσης; (τότε ο καλών χρειάζεται την ταυτότητα) */
export function hasReadPaths(key: CollectionKey): boolean {
  return READ_PATHS[key] !== undefined;
}

/**
 * **Οι δρόμοι ανάγνωσης** που οφείλει να δηλώνει κάθε client λίστα της συλλογής —
 * πάντα τουλάχιστον ένας.
 */
export function buildReadPaths(key: CollectionKey, uid: string): readonly QueryConstraint[][] {
  return READ_PATHS[key]?.(uid) ?? UNSCOPED_PATHS;
}
