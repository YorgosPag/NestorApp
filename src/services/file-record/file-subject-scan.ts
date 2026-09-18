/**
 * =============================================================================
 * «ΠΟΙΑ ΑΡΧΕΙΑ ΕΙΝΑΙ ΔΕΔΟΜΕΝΑ ΑΥΤΟΥ ΤΟΥ ΑΝΘΡΩΠΟΥ;» — ΓΚΠΔ άρθρα 15 · 17 · 20 (ADR-866 §2.6.9 Β6)
 * =============================================================================
 *
 * Ο **ένας** σαρωτής υποκειμένου για **τις δύο** διαδρομές ΓΚΠΔ (`gdpr-export` · `gdpr-delete`).
 *
 * 🔴 **ΤΙ ΒΡΕΘΗΚΕ**: και οι δύο σάρωναν **μόνο** `files`. Με το προσωπικό διαμέρισμα, ο πολίτης θα
 * ζητούσε «σβήσε τα δεδομένα μου» και ο φάκελος του σπιτιού του θα **έμενε** — και η εξαγωγή δεν θα
 * τον έδειχνε, άρα δεν θα το **μάθαινε** ποτέ. Δύο διαδρομές με δικό τους ερώτημα η καθεμία =
 * διαγραφή που καλύπτει κάτι άλλο από όσα δείχνει η εξαγωγή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΠΕΔΙΟ ΥΠΟΚΕΙΜΕΝΟΥ ΔΙΑΦΕΡΕΙ ΑΝΑ ΔΙΑΜΕΡΙΣΜΑ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * | διαμέρισμα | πεδίο | γιατί |
 * |---|---|---|
 * | εταιρεία | `createdBy` | ό,τι ίσχυε: υπεύθυνος επεξεργασίας είναι η **εταιρεία**· του ανθρώπου είναι ό,τι **ανέβασε** |
 * | άνθρωπος | `userId` | ο **κάτοχος**, όχι ο συντάκτης: στη Φ3 ο μεσίτης ανεβάζει στον φάκελο του ιδιοκτήτη — η διαγραφή του **μεσίτη** δεν σβήνει τον φάκελο του **ιδιοκτήτη** |
 *
 * ⚠️ Η τιμή του φίλτρου είναι **πάντα** η επαληθευμένη ταυτότητα — ποτέ τιμή από το αίτημα.
 *
 * @module services/file-record/file-subject-scan
 * @see lib/files/file-custody — `FILE_COLLECTION`
 */

import 'server-only';

import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { FILE_AUDIT_COLLECTION, FILE_COLLECTION } from '@/lib/files/file-custody';
import { CUSTODY_KINDS, type CustodyKind } from '@/lib/workspace/custody-scope';

/** Ποιο πεδίο ονομάζει το υποκείμενο σε κάθε διαμέρισμα — η **μία** δήλωση (βλ. πίνακα πάνω). */
export const FILE_SUBJECT_FIELD = {
  company: FIELDS.CREATED_BY,
  personal: FIELDS.USER_ID,
} as const satisfies Record<CustodyKind, string>;

/** Ένα αρχείο του υποκειμένου — μαζί με το διαμέρισμα **όπου βρέθηκε**. */
export interface SubjectFileDoc {
  readonly custody: CustodyKind;
  readonly doc: QueryDocumentSnapshot;
}

/**
 * Όλα τα αρχεία του υποκειμένου, σε **όλα** τα διαμερίσματα.
 *
 * 🔑 Το διαμέρισμα ταξιδεύει **από το ερώτημα**, ποτέ από τα πεδία του εγγράφου: ο καλών γράφει
 * πίσω στη **συλλογή όπου βρέθηκε** (`doc.ref`).
 */
export async function findSubjectFiles(db: Firestore, uid: string): Promise<SubjectFileDoc[]> {
  const perCustody = await Promise.all(
    CUSTODY_KINDS.map(async (custody) => {
      // tenant-scope-exempt: αίτημα ΓΚΠΔ του ΙΔΙΟΥ του υποκειμένου — εκ σχεδιασμού διασχίζει κάθε
      // μισθωτή όπου ο άνθρωπος έχει δεδομένα· το φίλτρο είναι η επαληθευμένη ταυτότητα (`uid`).
      const snapshot = await db
        .collection(COLLECTIONS[FILE_COLLECTION[custody]])
        .where(FILE_SUBJECT_FIELD[custody], '==', uid)
        .get();
      return snapshot.docs.map((doc) => ({ custody, doc }));
    }),
  );
  return perCustody.flat();
}

/**
 * Ποιο πεδίο ονομάζει το υποκείμενο στη **δραστηριότητα** κάθε διαμερίσματος (ADR-866 §2.6.11).
 *
 * | βιβλίο | πεδίο | γιατί |
 * |---|---|---|
 * | εταιρικό | `performedBy` | ό,τι ίσχυε: του ανθρώπου είναι ό,τι **έκανε**· το βιβλίο ανήκει στην εταιρεία |
 * | προσωπικό | `userId` | το **δικό του** βιβλίο — ολόκληρο, και ό,τι έκαναν άλλοι στα αρχεία του |
 */
export const FILE_ACTIVITY_SUBJECT_FIELD = {
  company: 'performedBy',
  personal: FIELDS.USER_ID,
} as const satisfies Record<CustodyKind, string>;

/** Μια γραμμή δραστηριότητας του υποκειμένου — μαζί με το βιβλίο **όπου βρέθηκε**. */
export interface SubjectActivityDoc {
  readonly custody: CustodyKind;
  readonly doc: QueryDocumentSnapshot;
}

/**
 * Όλη η δραστηριότητα αρχείων του υποκειμένου, σε **όλα** τα βιβλία — ό,τι δείχνει η εξαγωγή
 * (άρθρο 15/20) είναι ακριβώς ό,τι χειρίζεται η διαγραφή (άρθρο 17).
 *
 * 🔴 Πριν το 2β.4 η εξαγωγή διάβαζε **μόνο** το εταιρικό βιβλίο: με προσωπικό διαμέρισμα, ο πολίτης
 * θα λάμβανε εξαγωγή **χωρίς** τη δραστηριότητα των δικών του αρχείων — και δεν θα το μάθαινε ποτέ.
 */
export async function findSubjectActivity(db: Firestore, uid: string): Promise<SubjectActivityDoc[]> {
  const perCustody = await Promise.all(
    CUSTODY_KINDS.map(async (custody) => {
      // tenant-scope-exempt: αίτημα ΓΚΠΔ του ΙΔΙΟΥ του υποκειμένου — εκ σχεδιασμού διασχίζει κάθε
      // μισθωτή όπου ο άνθρωπος έχει δεδομένα· το φίλτρο είναι η επαληθευμένη ταυτότητα (`uid`).
      const snapshot = await db
        .collection(COLLECTIONS[FILE_AUDIT_COLLECTION[custody]])
        .where(FILE_ACTIVITY_SUBJECT_FIELD[custody], '==', uid)
        .get();
      return snapshot.docs.map((doc) => ({ custody, doc }));
    }),
  );
  return perCustody.flat();
}
