/**
 * =============================================================================
 * Ο ΧΩΡΟΣ ΣΥΣΤΗΜΑΤΟΣ ΤΩΝ ΑΡΧΕΙΩΝ — ποια αρχεία ΔΕΝ ανήκουν στον χώρο του ανθρώπου (ADR-934 §5.2.2 Μ-β6)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Υπάρχουν αρχεία που κανένας άνθρωπος δεν διαχειρίζεται — και πού ζουν;»*
 *
 * 🔴 **Γιατί υπάρχει (μετρημένο 2026-11-09, ζωντανά)**: η καραντίνα μέσων καταλόγου ζούσε στη συλλογή `files`, δίπλα στα
 *   αρχεία του χρήστη ⇒ φαινόταν στη λίστα «Αρχεία», στους μετρητές της, στον Κάδο, στην Αρχειοθήκη, στην καθολική αναζήτηση —
 *   και ο χρήστης μπορούσε να την επαναφέρει ή να τη στείλει στον κάδο με το χέρι.
 *
 * 🌐 **Το μοντέλο των μεγάλων — φυσικός, όχι λογικός διαχωρισμός**: Google Drive `appDataFolder` (ξεχωριστό `space`,
 *   «hidden from the user», κανένα αρχείο δεν περνά από χώρο σε χώρο) · Adobe AEM (η καραντίνα «never enters the DAM»).
 *   ⛔ Απορρίφθηκαν: φίλτρο ερωτήματος `not-in`/`!=` (ανισότητα ⇒ σπάει κάθε `orderBy`, νέος δείκτης σε κάθε λίστα, κόβει
 *   έγγραφα χωρίς το πεδίο) · φίλτρο μετά την ανάγνωση (η συνδρομή θα κατέβαζε **κάθε** εγγραφή συστήματος για να την πετάξει).
 *
 * 🏆 **Πού ξεπερνάμε**: το `appDataFolder` δεν έχει κάδο ούτε επαναφορά και δεν δηλώνει τι ζει μέσα του. Εδώ ο κατάλογος είναι
 *   **κλειστός, με λόγο ανά τύπο**, φυλαγμένος από άγκυρα (`__tests__/system-file-space.test.ts`), και τα αρχεία κρατούν
 *   **ολόκληρο** τον κύκλο ζωής (κάδος · επιτύμβιο · εκκαθάριση · ίχνος) — από τα **ίδια** modules με τα αρχεία του ανθρώπου.
 *
 * ⚠️ **ΔΕΝ είναι διαμέρισμα κατόχου**: ο κάτοχος (εταιρεία) μένει στο `companyId` και στο βιβλίο ίχνους της. Μην το προσθέσεις
 *   στο `FILE_COLLECTION` (`satisfies CustodyPartition`): το `CUSTODY_KINDS` θα το έκανε «τρίτο κάτοχο» σε κάθε πύλη και cron.
 *
 * 🔑 **Η συλλογή γράφεται `COLLECTIONS.FILES_SYSTEM` στο σημείο κλήσης** — ποτέ μέσα από σταθερά-δείκτη: οι πύλες 3.35/3.91
 *   διαβάζουν τον κώδικα στατικά και ένα `COLLECTIONS[X]` θα τις έκανε τυφλές (ίδιος λόγος με το `FILE_COLLECTION[kind]`).
 *
 * **Καθαρό · leaf · κανένα `server-only`** — το διαβάζουν διακομιστής, μετανάστευση και άγκυρα.
 *
 * @module lib/files/system-file-space
 * @see config/firestore-collections `FILES_SYSTEM` · firestore.rules `match /files_system/{fileId}` (deny-all)
 */

import { ENTITY_TYPES } from '@/config/domain-constants';

/**
 * **Οι τύποι που ζουν στον χώρο συστήματος — κλειστός κατάλογος, με λόγο.** Νέα γραμμή = απόφαση, όχι σύμπτωση.
 */
export const SYSTEM_FILE_ENTITY_TYPE_REASONS = {
  [ENTITY_TYPES.CATALOG_MEDIA_CONTENT]:
    'Αντίγραφο bytes τρίτου σε καραντίνα (ADR-934 §5.2.2): ανακτήσιμο από τον προμηθευτή, κανένας άνθρωπος δεν το διαχειρίζεται· στο Μ-δ γίνεται αντίγραφο στο αρχείο του μέσου.',
} as const satisfies Readonly<Record<string, string>>;

export type SystemFileEntityType = keyof typeof SYSTEM_FILE_ENTITY_TYPE_REASONS;

export const SYSTEM_FILE_ENTITY_TYPES = Object.keys(SYSTEM_FILE_ENTITY_TYPE_REASONS) as readonly SystemFileEntityType[];

/**
 * Ο **χώρος** μιας εγγραφής αρχείου: του ανθρώπου (`files` / `files_personal`, κατά κάτοχο) ή του συστήματος (`files_system`).
 * Ορθογώνιο προς τον κάτοχο: ο χώρος λέει **ποιος τη διαχειρίζεται**, ο κάτοχος **σε ποιον ανήκει**.
 */
export type FileSpace = 'user' | 'system';

/** **Ο ένας κριτής**: ζει αυτός ο τύπος στον χώρο συστήματος; */
export function isSystemSpaceEntityType(entityType: unknown): entityType is SystemFileEntityType {
  return typeof entityType === 'string' && Object.prototype.hasOwnProperty.call(SYSTEM_FILE_ENTITY_TYPE_REASONS, entityType);
}
