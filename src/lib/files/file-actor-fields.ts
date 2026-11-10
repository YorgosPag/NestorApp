/**
 * =============================================================================
 * ΤΑ ΠΕΔΙΑ ΔΡΑΣΤΗ ΜΙΑΣ ΕΓΓΡΑΦΗΣ ΑΡΧΕΙΟΥ — «πού γράφεται ο άνθρωπος;» (ADR-936 Στάδιο 1)
 * =============================================================================
 *
 * **Κλειστή λίστα** των πεδίων του `FileRecord` (`types/file-record.ts` + `fileRestoreFields`) που κρατούν uid ανθρώπου.
 * Τη διαβάζουν:
 *   - η διαγραφή ΓΚΠΔ (`server/files/gdpr-erasure.server.ts`): ανωνυμοποιεί **ακριβώς** αυτά όπου τιμή == υποκείμενο·
 *   - ο χώρος συστήματος (`system-file-space.ts`, ADR-934 Μ-β7): το `SYSTEM_SPACE_ACTOR_FIELDS` είναι **υποσύνολο** τους,
 *     δεμένο με `satisfies` — όχι δεύτερη λίστα.
 *
 * 🔑 Διαδρομή με τελεία (`iso19650Source.overriddenBy`) = ένθετο πεδίο· το Firestore τη δέχεται ως έχει σε `where` και `update`.
 * ⚠️ Νέο πεδίο `…By` στο `FileRecord` ⇒ γραμμή εδώ, αλλιώς η διαγραφή ΓΚΠΔ αφήνει τον άνθρωπο μέσα σε περιεχόμενο που μένει.
 *
 * **Καθαρό · leaf · κανένα `server-only`.**
 *
 * @module lib/files/file-actor-fields
 */

export const FILE_ACTOR_FIELDS = [
  'createdBy',
  'classifiedBy',
  'trashedBy',
  'archivedBy',
  'deletedBy',
  'restoredBy',
  'holdPlacedBy',
  'holdReleasedBy',
  'iso19650Source.overriddenBy',
] as const;

export type FileActorField = (typeof FILE_ACTOR_FIELDS)[number];

/**
 * Το **στιγμιότυπο ονόματος** που συνοδεύει πεδίο δράστη — σβήνεται μαζί του, αλλιώς το όνομα μένει εκεί όπου η ταυτότητα έφυγε.
 */
export const FILE_ACTOR_NAME_FIELDS: Readonly<Partial<Record<FileActorField, string>>> = {
  createdBy: 'uploaderName',
};
