/**
 * =============================================================================
 * ΤΟ ΜΟΝΟΠΑΤΙ ΚΑΙ ΟΙ ΕΡΩΤΗΣΕΙΣ ΤΗΣ ΣΥΜΜΕΤΟΧΗΣ — ΜΙΑ ΦΟΡΑ (ADR-862 Φ1)
 * =============================================================================
 *
 * Μάθημα του `project-member-ref.ts`: όταν αναγνώστης και γραφέας χτίζουν το μονοπάτι **χωριστά**,
 * αποκλίνουν σιωπηλά (ο αναγνώστης μέλους δεν έβρισκε **ποτέ** μέλος). Εδώ αναγνώστης, γραφέας και
 * υπηρεσίες ρωτούν **από το ίδιο σημείο**.
 *
 * @module lib/auth/engagement-ref
 * @see lib/auth/engagement-read — ο αναγνώστης · lib/auth/engagement-write — ο ΕΝΑΣ γραφέας
 */

import 'server-only';

import type { CollectionReference, DocumentReference, Firestore, Query } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { EngagementKey, EngagementSubject } from '@/types/engagement';

/**
 * ADR-862 §5.3.10 — το φίλτρο «αυτή η υπόθεση», **ανά είδος**, με **ρητό** όνομα πεδίου: οι πύλες δεικτών
 * (CHECK 3.15 · 3.91) διαβάζουν το όνομα στατικά — μια διαδρομή συντεθειμένη σε χρόνο εκτέλεσης θα τους ήταν αόρατη.
 * Η μεταβίβαση δίνει **ακριβώς** το ερώτημα που έδινε πριν (`subject.caseId`). Μόνο ισότητες ⇒ κανένας σύνθετος δείκτης.
 */
function subjectFilter(query: Query, subject: EngagementSubject): Query {
  // Ο μισθωτής είναι ήδη η διαδρομή της συλλογής (`engagementsCollection`).
  switch (subject.kind) {
    case 'conveyance_case':
      return query.where('subject.caseId', '==', subject.caseId);
    case 'document_issuance':
      return query.where('subject.assignmentId', '==', subject.assignmentId);
  }
}

/**
 * `companies/{hostCompanyId}/projects/{projectId}/engagements`.
 *
 * 🔑 **Ο μισθωτής ΕΙΝΑΙ Η ΔΙΑΔΡΟΜΗ** — ο χώρος **του έργου**, ποτέ του καλούντα (ADR-862 §2.3, Κ-3:
 * ακριβώς αυτό έσπασε στα `getProjectMembership`/`getPropertyGrant`).
 */
export function engagementsCollection(db: Firestore, hostCompanyId: string, projectId: string): CollectionReference {
  // tenant-scope-exempt: ο μισθωτής είναι το ίδιο το μονοπάτι `companies/{hostCompanyId}/…`, όχι πεδίο.
  return db
    .collection(COLLECTIONS.COMPANIES)
    .doc(hostCompanyId)
    .collection(SUBCOLLECTIONS.COMPANY_PROJECTS)
    .doc(projectId)
    .collection(SUBCOLLECTIONS.PROJECT_ENGAGEMENTS);
}

/** Ένα έγγραφο συμμετοχής. */
export function engagementRef(db: Firestore, key: EngagementKey): DocumentReference {
  return engagementsCollection(db, key.hostCompanyId, key.projectId).doc(key.engagementId);
}

/**
 * **Όλες** οι συμμετοχές (κάθε κατάστασης) ενός ανθρώπου σε **μία** υπόθεση του έργου.
 *
 * ⚠️ **Χωρίς `limit`**: η ιστορία (ανακληθείσα → νέα πρόταση) ζει σε **χωριστά** έγγραφα· η επιλογή
 *    της τρέχουσας γίνεται **μία** φορά, στο `selectCurrentEngagement` — ποτέ «η πρώτη που ήρθε».
 */
export function engagementsOfUserForSubjectQuery(
  collection: CollectionReference,
  uid: string,
  subject: EngagementSubject,
): Query {
  // Ο μισθωτής είναι ήδη η διαδρομή της συλλογής (`engagementsCollection`).
  return subjectFilter(collection.where('uid', '==', uid), subject);
}

/** Όλες οι συμμετοχές μιας υπόθεσης — η όψη του **οικοδεσπότη** («ποιος βλέπει την υπόθεσή μου;»). */
export function engagementsForSubjectQuery(collection: CollectionReference, subject: EngagementSubject): Query {
  // Ο μισθωτής είναι ήδη η διαδρομή της συλλογής (`engagementsCollection`).
  return subjectFilter(collection, subject);
}

/**
 * **«Κοινόχρηστα μαζί μου»** — οι συμμετοχές ενός ανθρώπου σε **ΟΛΟΥΣ** τους χώρους.
 *
 * ⚠️ **Μόνο Admin SDK, ποτέ κανόνας collection-group στον πελάτη** — ίδιος λόγος με το
 *    `listMemberWorkspaces`: ένας τέτοιος κανόνας θα άνοιγε απαρίθμηση όλων των γραφείων
 *    (ADR-787 Ε-5 §4 #1).
 */
export function engagementsOfUserQuery(db: Firestore, uid: string): Query {
  // tenant-scope-exempt: Η ερώτηση ΕΙΝΑΙ «σε ποιους ΞΕΝΟΥΣ χώρους συμμετέχει αυτός ο άνθρωπος;» —
  // ένα `where('companyId')` θα την ακύρωνε (ο καλεσμένος ΔΕΝ ανήκει στον χώρο). Ο άξονας απομόνωσης
  // είναι το `uid` από το υπογεγραμμένο token, και κάθε αποτέλεσμα ξανακρίνεται από τον `decideEngagement`.
  return db.collectionGroup(SUBCOLLECTIONS.PROJECT_ENGAGEMENTS).where('uid', '==', uid);
}
