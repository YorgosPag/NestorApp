/**
 * @fileoverview **ΤΑ ΠΕΔΙΑ ΑΡΧΕΙΟΥ ΠΟΥ ΟΡΙΖΟΥΝ ΤΙ ΒΛΕΠΕΙ ΤΟ ΚΟΙΝΟ** — το κατηγόρημα δημοσίευσης, ως δεδομένα.
 * @related ADR-845 §7.17 (κλάση Ο-35) · services/listings/agency-media.reader (το ερώτημα) ·
 *   services/listings/agency-media-publication (φρουρός #1) · lib/listings/listing-file-deliverability (φρουρός #2)
 * @module lib/listings/listing-file-publication-fields
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η δημόσια αγγελία παράγεται από τα **αρχεία** του ακινήτου. Όποιος αλλάξει ένα από αυτά τα πεδία
 * αλλάζει την αγγελία — άρα η αλλαγή οφείλει να περάσει από **πράξη** *(διαβάθμιση · κάδος ·
 * αρχειοθέτηση · πράξη δοχείου)* που κρίνει, καταγράφει και **ξαναπροβάλλει**. Γενικός γραφέας
 * *(εργαλείο AI, μαζική ενημέρωση)* που τα αγγίζει είναι ακριβώς η πόρτα που ξέφευγε στην κλάση Ο-35.
 *
 * ⚠️ **Κλειστή λίστα, δεμένη στο `FileRecord`** (`satisfies`): μετονομασία πεδίου **σπάει εδώ**.
 * Νέο πεδίο που αρχίζει να ρωτά το κατηγόρημα **οφείλει** γραμμή εδώ — αλλιώς ο γενικός γραφέας
 * το αλλάζει χωρίς να το μάθει η αγγελία.
 *
 * Καθαρό module *(χωρίς `server-only`)*: το διαβάζουν διακομιστής και πύλες.
 */

import type { FileRecord } from '@/types/file-record';

/**
 * | πεδίο | ποιος το ρωτά |
 * |---|---|
 * | `companyId` · `entityType` · `entityId` · `category` | το ερώτημα (`agency-media.reader`) |
 * | `classification` | φρουρός #1 — *«επιτρέπεται να φύγει από την εταιρεία;»* |
 * | `status` · `isDeleted` · `lifecycleState` · `storagePath` · `storagePlacement` · `contentType` | φρουρός #2 — καταλληλότητα |
 * | `publicationIdentity` · `createdAt` | ένα ανά ταυτότητα, το νεότερο |
 */
export const LISTING_FILE_PUBLICATION_FIELDS = [
  'companyId',
  'entityType',
  'entityId',
  'category',
  'classification',
  'status',
  'isDeleted',
  'lifecycleState',
  'storagePath',
  'storagePlacement',
  'contentType',
  'publicationIdentity',
  'createdAt',
] as const satisfies readonly (keyof FileRecord)[];

const PUBLICATION_FIELD_NAMES: readonly string[] = LISTING_FILE_PUBLICATION_FIELDS;

/**
 * **Ποια από τα κλειδιά αυτής της γραφής ορίζουν τι βλέπει το κοινό;**
 *
 * 🔑 Κρίνεται το **πρώτο τμήμα** του κλειδιού: το `storagePlacement.bucket` είναι γραφή μέσα στο
 * `storagePlacement`, και η βάση το δέχεται ως διαδρομή πεδίου.
 *
 * @example
 * publicationFieldsIn({ description: 'x', classification: 'public' }); // ['classification']
 */
export function publicationFieldsIn(data: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.keys(data).filter((key) => PUBLICATION_FIELD_NAMES.includes(key.split('.')[0]));
}
