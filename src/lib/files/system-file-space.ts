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

import { ENTITY_TYPES, SYSTEM_IDENTITY, isSystemActorId, type SystemActorId } from '@/config/domain-constants';
import type { FileActorField } from './file-actor-fields';

/** Μια γραμμή του καταλόγου: **γιατί** ο τύπος ζει εδώ και **ποια διεργασία** τον διαχειρίζεται. */
export interface SystemFileSpaceDeclaration {
  readonly reason: string;
  /**
   * Ο δράστης που γράφεται στα πεδία της εγγραφής (`createdBy` · `restoredBy` · `trashedBy` · `deletedBy`) — **ποτέ** uid
   * ανθρώπου (ADR-934 §5.2.2 Μ-β7). Ο άνθρωπος που προκάλεσε την πράξη γράφεται **μόνο** στο ίχνος (`performedBy`), όπου τον
   * βρίσκει ο σαρωτής υποκειμένου (`findSubjectActivity`) — πρότυπο AWS CloudTrail: υπηρεσία στο `invokedBy`, άνθρωπος στο
   * `SourceIdentity`. Έτσι ο χώρος δεν κρατά προσωπικό δεδομένο που κανένα αίτημα ΓΚΠΔ δεν θα έβρισκε.
   */
  readonly actor: SystemActorId;
}

/**
 * **Οι τύποι που ζουν στον χώρο συστήματος — κλειστός κατάλογος, με λόγο και διαχειριστή.** Νέα γραμμή = απόφαση, όχι σύμπτωση.
 */
export const SYSTEM_FILE_SPACE_CATALOG = {
  [ENTITY_TYPES.CATALOG_MEDIA_CONTENT]: {
    reason:
      'Αντίγραφο bytes τρίτου σε καραντίνα (ADR-934 §5.2.2): ανακτήσιμο από τον προμηθευτή, κανένας άνθρωπος δεν το διαχειρίζεται· στο Μ-δ γίνεται αντίγραφο στο αρχείο του μέσου.',
    actor: SYSTEM_IDENTITY.CATALOG_MEDIA_ID,
  },
} as const satisfies Readonly<Record<string, SystemFileSpaceDeclaration>>;

export type SystemFileEntityType = keyof typeof SYSTEM_FILE_SPACE_CATALOG;

export const SYSTEM_FILE_ENTITY_TYPES = Object.keys(SYSTEM_FILE_SPACE_CATALOG) as readonly SystemFileEntityType[];

/** **Ο διαχειριστής** ενός τύπου του χώρου — ο δράστης για κάθε πεδίο της εγγραφής του. */
export function systemSpaceActorOf(entityType: SystemFileEntityType): SystemActorId {
  return SYSTEM_FILE_SPACE_CATALOG[entityType].actor;
}

/**
 * Ο **χώρος** μιας εγγραφής αρχείου: του ανθρώπου (`files` / `files_personal`, κατά κάτοχο) ή του συστήματος (`files_system`).
 * Ορθογώνιο προς τον κάτοχο: ο χώρος λέει **ποιος τη διαχειρίζεται**, ο κάτοχος **σε ποιον ανήκει**.
 */
export type FileSpace = 'user' | 'system';

/** **Ο ένας κριτής**: ζει αυτός ο τύπος στον χώρο συστήματος; */
export function isSystemSpaceEntityType(entityType: unknown): entityType is SystemFileEntityType {
  return typeof entityType === 'string' && Object.prototype.hasOwnProperty.call(SYSTEM_FILE_SPACE_CATALOG, entityType);
}

// =============================================================================
// ΑΠΟΔΟΣΗ — η εγγραφή του χώρου δεν κρατά uid ανθρώπου (ADR-934 §5.2.2 Μ-β7)
// =============================================================================

/**
 * **Τα πεδία δράστη μιας εγγραφής αρχείου** — κλειστή λίστα (`types/file-record.ts` + `fileRestoreFields`). Ό,τι άλλο τελειώνει
 * σε `By` και κρατά άνθρωπο **δεν** ξαναγράφεται σιωπηλά: αναφέρεται (`unlisted-actor-field`) — ποτέ «δεν κοίταξα».
 */
export const SYSTEM_SPACE_ACTOR_FIELDS = [
  'createdBy', 'restoredBy', 'trashedBy', 'deletedBy', 'archivedBy', 'classifiedBy',
] as const satisfies readonly FileActorField[];

/** Η απόφαση για μία εγγραφή του χώρου — ονομασμένη, ποτέ boolean. */
export type SystemSpaceAttributionPlan =
  | { readonly kind: 'clean' }
  | { readonly kind: 'rewrite'; readonly fields: Readonly<Record<string, SystemActorId>>; readonly humans: readonly string[] }
  | {
      readonly kind: 'conflict';
      readonly why: 'not-system-type' | 'human-not-in-trail' | 'unlisted-actor-field';
      readonly humans: readonly string[];
    };

type RecordData = Readonly<Record<string, unknown>>;

/** Τιμή πεδίου δράστη που είναι **άνθρωπος**: μη κενό κείμενο που δεν είναι ταυτότητα μηχανής. */
const isHumanActor = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && !isSystemActorId(value);

/** Πεδία `…By` εκτός λίστας που κρατούν άνθρωπο. */
const unlistedHumanFields = (data: RecordData): string[] =>
  Object.keys(data).filter(
    (field) => field.endsWith('By') && !(SYSTEM_SPACE_ACTOR_FIELDS as readonly string[]).includes(field) && isHumanActor(data[field]),
  );

/**
 * **Τι πρέπει να γίνει** με τα πεδία δράστη μιας εγγραφής του χώρου συστήματος — καθαρό, χωρίς δίσκο.
 *
 * `trailPerformers` = οι `performedBy` του ίχνους **αυτού** του αρχείου. 🔴 Ένας άνθρωπος φεύγει από την εγγραφή **μόνο** αν
 * μένει στο ίχνος — αλλιώς η σύνδεση «ποιος το προκάλεσε» θα χανόταν. Καμία κατασκευασμένη γραμμή ίχνους: σύγκρουση, και αποφασίζει άνθρωπος.
 */
export function planSystemSpaceAttribution(data: RecordData, trailPerformers: ReadonlySet<string>): SystemSpaceAttributionPlan {
  const listed = SYSTEM_SPACE_ACTOR_FIELDS.filter((field) => isHumanActor(data[field]));
  const unlisted = unlistedHumanFields(data);
  const humans = [...new Set([...listed, ...unlisted].map((field) => String(data[field])))];
  if (humans.length === 0) return { kind: 'clean' };
  if (!isSystemSpaceEntityType(data.entityType)) return { kind: 'conflict', why: 'not-system-type', humans };
  if (unlisted.length > 0) return { kind: 'conflict', why: 'unlisted-actor-field', humans };
  if (humans.some((uid) => !trailPerformers.has(uid))) return { kind: 'conflict', why: 'human-not-in-trail', humans };
  const actor = systemSpaceActorOf(data.entityType);
  return { kind: 'rewrite', fields: Object.fromEntries(listed.map((field) => [field, actor])), humans };
}
