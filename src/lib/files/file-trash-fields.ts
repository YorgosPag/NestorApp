/**
 * 🗑️ **ΤΑ ΠΕΔΙΑ ΤΟΥ ΚΑΔΟΥ ΕΝΟΣ ΑΡΧΕΙΟΥ** — η ΜΙΑ δήλωση για κάθε γραφέα που στέλνει ένα `FileRecord` στον κάδο
 * (ADR-032 · ADR-191 Phase 3.2 · ADR-899 §2.2).
 *
 * Ο κάδος είναι η **ουρά** της μίας αγωγού οριστικής διαγραφής: το cron της εφαρμογής (`lib/cron/jobs/file-purge.job.ts`)
 * διαλέγει `isDeleted == true && purgeAt <= now` και περνά κάθε εγγραφή από τον ΕΝΑ κριτή δέσμευσης (`isFileHeld`) και
 * τον ΕΝΑ γραφέα (`purgeFileRecord`: πρωτότυπο + **κάθε** συνοδευτικό · άρνηση ⇒ ξανά αύριο · ίχνος στο βιβλίο του κατόχου).
 * Όποιος θέλει να σβηστεί ένα αρχείο **δεν** σβήνει bytes μόνος του — γράφει αυτά τα πεδία (Google Drive / Box: κάθε
 * πόρτα διαγραφής καταλήγει στην ίδια αγωγό).
 *
 * Γραφείς: ο διακομιστής (`services/file-record/file-trash.service`) και τα Cloud Functions (`onDeleteFloorplanBackground`).
 *
 * **Layering**: leaf — **μηδέν** imports (προβάλλεται στα Cloud Functions, ADR-874 · CHECK 3.93). Η τιμή της κατάστασης
 * έρχεται από τον καλούντα (`FILE_LIFECYCLE_STATES.TRASHED` — εφαρμογή ή προβολή του), ώστε να ζει σε ΕΝΑ σημείο.
 *
 * @module lib/files/file-trash-fields
 */

export interface FileTrashFieldsInput<TTime> {
  /** `FILE_LIFECYCLE_STATES.TRASHED` — από τις σταθερές του καλούντα. */
  readonly trashedState: string;
  /** Ποιος — uid ανθρώπου ή `system:<πόρτα>`. */
  readonly by: string;
  /** ISO 8601 (UTC): το cron συγκρίνει **ως συμβολοσειρά** (`purgeAt <= nowISO()`). */
  readonly purgeAt: string;
  /** Ο χρόνος του γραφέα — `FieldValue.serverTimestamp()`. */
  readonly now: TTime;
}

/** Τα πεδία που βάζουν μια εγγραφή στην ουρά της εκκαθάρισης — `isDeleted` + `purgeAt` είναι το κλειδί του cron. */
export function fileTrashFields<TTime>(input: FileTrashFieldsInput<TTime>): Record<string, TTime | string | boolean> {
  return {
    lifecycleState: input.trashedState,
    trashedAt: input.now,
    trashedBy: input.by,
    purgeAt: input.purgeAt,
    isDeleted: true,
    deletedAt: input.now,
    deletedBy: input.by,
    updatedAt: input.now,
  };
}
