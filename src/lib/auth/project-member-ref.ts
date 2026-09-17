/**
 * =============================================================================
 * ΤΟ ΜΟΝΟΠΑΤΙ ΚΑΙ Η ΕΡΩΤΗΣΗ ΤΟΥ ΜΕΛΟΥΣ ΕΡΓΟΥ — ΜΙΑ ΦΟΡΑ (ADR-862 Φ0 Β14)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει**: μέχρι το Β7 ο αναγνώστης ρωτούσε `.doc(uid)` και ο γραφέας
 * έγραφε `members/{mbr_…}` με το `uid` ως **πεδίο** — η αναζήτηση μέλους **δεν έβρισκε
 * ποτέ** μέλος (`project-member-read.ts`, κεφαλίδα). Το Β7 ευθυγράμμισε τις δύο
 * ερωτήσεις **με σχόλιο**. Εδώ γίνονται **μία συνάρτηση**: ο αναγνώστης, ο γραφέας και
 * η διαχείριση ρόλων χτίζουν το μονοπάτι και την ερώτηση **από το ίδιο σημείο**, άρα
 * δεν μπορούν πια να αποκλίνουν χωρίς να αλλάξει αυτό το αρχείο.
 *
 * @module lib/auth/project-member-ref
 * @see lib/auth/project-member-read — ο ΕΝΑΣ αναγνώστης
 * @see lib/auth/project-member-write — ο ΕΝΑΣ γραφέας
 */

import 'server-only';

import type { CollectionReference, Firestore, Query } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';

/**
 * `companies/{companyId}/projects/{projectId}/members`.
 *
 * 🔑 **Ο μισθωτής ΕΙΝΑΙ Η ΔΙΑΔΡΟΜΗ**: η υποσυλλογή ενός χώρου δεν μπορεί δομικά να
 * επιστρέψει έγγραφο άλλου — αυστηρότερο από φίλτρο πεδίου (ADR-862 Φ0 Β6).
 *
 * ⚠️ Ο γονέας `companies/{W}/projects/{P}` **δεν υπάρχει ως έγγραφο**: το έργο ζει στο
 * top-level `projects/{P}`. Ο γονέας είναι μόνο άγκυρα υποσυλλογής (ADR-787 §5.1).
 */
export function projectMembersCollection(
  db: Firestore,
  companyId: string,
  projectId: string,
): CollectionReference {
  // tenant-scope-exempt: ο μισθωτής είναι το ίδιο το μονοπάτι `companies/{companyId}/…`, όχι πεδίο.
  return db
    .collection(COLLECTIONS.COMPANIES)
    .doc(companyId)
    .collection(SUBCOLLECTIONS.COMPANY_PROJECTS)
    .doc(projectId)
    .collection(SUBCOLLECTIONS.PROJECT_MEMBERS);
}

/**
 * **Η ΜΙΑ ερώτηση** «ποιο έγγραφο μέλους ανήκει σε αυτόν τον άνθρωπο;».
 *
 * 🔑 `limit(1)`: ο γραφέας εγγυάται **ένα** έγγραφο ανά uid (ελέγχει μέσα σε συναλλαγή
 * πριν γράψει). Δεύτερη γραμμή δεν θα έδινε «περισσότερη» ιδιότητα μέλους· θα έδινε
 * **μη ντετερμινιστική** απάντηση.
 */
export function memberByUidQuery(members: CollectionReference, uid: string): Query {
  // tenant-scope-exempt: η συλλογή είναι ήδη περιορισμένη στον χώρο από το μονοπάτι της.
  return members.where('uid', '==', uid).limit(1);
}
