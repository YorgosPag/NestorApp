/**
 * @fileoverview **Ο ΚΑΔΟΣ ΤΩΝ ΕΤΑΙΡΙΚΩΝ ΑΡΧΕΙΩΝ ΕΙΝΑΙ ΠΡΑΞΗ ΔΙΑΚΟΜΙΣΤΗ** — ο ΕΝΑΣ γραφέας του.
 * @related ADR-845 §7.17 Α2 (κλάση Ο-35) · ADR-032 (κάδος) · ADR-801 (ο ΕΝΑΣ κριτής) · ADR-281
 * @module services/file-record/file-trash.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΝΤΙΚΑΘΙΣΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως την Α2 ο κάδος και η επαναφορά γράφονταν από τον **browser** (`updateDoc`):
 *
 * 1. φωτογραφία που πετάχτηκε **έμενε** στη δημόσια αγγελία ώσπου κάποια **άλλη** πράξη να την
 *    ξαναπροβάλει — ίδια διαρροή με τη διαβάθμιση *(μετρημένη ζωντανά 2026-10-08)*·
 * 2. το ίχνος ήταν fire-and-forget: μπορούσε να λείπει·
 * 3. το δικαίωμα δημοσίευσης της διαβάθμισης παρακαμπτόταν με **βαρύτερη** πράξη.
 *
 * ⇒ Ο πελάτης **ζητά**· εδώ **κρίνεται, γράφεται και καταγράφεται**. Τα **προσωπικά** αρχεία
 * μένουν στον πελάτη *(ατομική δέσμη ζευγαρωμένη από κανόνες, ADR-866 §2.6.11)* — άλλο διαμέρισμα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΟΙΟΣ ΕΠΙΤΡΕΠΕΤΑΙ — Ο ADMIN SDK ΠΑΡΑΚΑΜΠΤΕΙ ΤΟΥΣ ΚΑΝΟΝΕΣ, ΑΡΑ Η ΚΡΙΣΗ ΤΟΥΣ ΖΕΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | ερώτημα | ποιος απαντά |
 * |---|---|
 * | **δικό του;** `createdBy === uid` | σύγκριση ταυτότητας — **ιδιοκτησία**, όχι εξουσιοδότηση |
 * | **αλλιώς** `dxf:files:delete` | ο ΕΝΑΣ κριτής (`decideCapability`) |
 * | αρχείο `public` ⇒ **και** δικαίωμα δημοσίευσης | `mayChangePublication` — κάδος = απόσυρση, επαναφορά = επαναδημοσίευση |
 * | κάδος μόνο για `status: 'ready'` | όπως ο κανόνας |
 * | αρχείο **αποσυρμένου** ακινήτου κλειδωμένο | όπως το `fileStaysUnderLiveProperty()` (ADR-281) |
 *
 * 🌐 **Η πρακτική**: Procore — ο απλός χρήστης σβήνει ό,τι ανέβασε, ο διαχειριστής οτιδήποτε.
 * ⛔ **Κανένα όνομα ρόλου εδώ** (CHECK 3.68).
 */

import 'server-only';

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import {
  FILE_CLASSIFICATIONS,
  FILE_LIFECYCLE_STATES,
  type FileCategory,
} from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { decideCapability } from '@/lib/auth/authority';
import { calculatePurgeDate, isInTrash } from '@/lib/files/file-trash-state';
import { FieldValue } from '@/lib/firebaseAdmin';
import { isRetired } from '@/lib/firestore/trashed-status';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import {
  mayChangePublication,
  type ClassificationActor,
} from '@/services/file-record/file-classification.service';
import { AGENCY_ENTITY_TYPE } from '@/services/listings/agency-media-publication';
import { isGranted } from '@/types/capability-authority';

/** Οι δύο πράξεις — το λεξιλόγιο του σύρματος. */
export const FILE_TRASH_ACTIONS = ['trash', 'restore'] as const;
export type FileTrashAction = (typeof FILE_TRASH_ACTIONS)[number];

/** Στενεύει `unknown → FileTrashAction` — η πόρτα δεν εμπιστεύεται το σώμα του αιτήματος. */
export function isFileTrashAction(value: unknown): value is FileTrashAction {
  return FILE_TRASH_ACTIONS.some((action) => action === value);
}

/**
 * Γιατί **όχι** — κλειστό σύνολο, ώστε η οθόνη να μπορεί να το πει (N.11).
 *
 * - `not-owner` — ούτε το ανέβασε, ούτε έχει `dxf:files:delete`
 * - `not-capable` — αρχείο `public` χωρίς δικαίωμα δημοσίευσης *(ίδιο όνομα με τη διαβάθμιση)*
 * - `not-ready` — κάδος σε αρχείο που δεν ολοκλήρωσε το ανέβασμα
 * - `not-in-trash` — επαναφορά αρχείου που δεν είναι στον κάδο
 * - `retired-property` — το ακίνητό του είναι στο αρχείο ή στον κάδο
 */
export const FILE_TRASH_REFUSALS = [
  'not-owner',
  'not-capable',
  'not-ready',
  'not-in-trash',
  'retired-property',
] as const;
export type FileTrashRefusal = (typeof FILE_TRASH_REFUSALS)[number];

/** Το δικαίωμα πάνω σε αρχείο **άλλου** — ο δημιουργός δεν το χρειάζεται. */
const TRASH_OTHERS_CAPABILITY = 'dxf:files:delete' as const;

/** Η κατάσταση που γράφει η οριστικοποίηση του ανεβάσματος — μόνο τέτοιο αρχείο πετιέται. */
const READY_STATUS = 'ready';

/** Ο αιτών — ίδια όψη με τη διαβάθμιση: ταυτότητα για το ίχνος, ρόλος για τον κριτή. */
export type FileTrashActor = ClassificationActor;

type FileData = Readonly<Record<string, unknown>>;

/**
 * **Τι έγινε** — ονομασμένα, ποτέ boolean *(ADR-844 §1)*.
 *
 * 🔑 Το `unchanged` είναι **δηλωμένη** απάντηση: δεύτερος κάδος δεν ξαναγράφει `purgeAt`
 * *(ADR-866 §2.6.11 Β3 — μετρημένα μετέθετε το ρολόι εκκαθάρισης)*, δεν καταγράφει και δεν
 * ξαναπροβάλλει αγγελία.
 */
export type FileTrashOutcome =
  | { readonly kind: 'changed'; readonly purgeAt: string | null }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly why: FileTrashRefusal };

/** «Ζει ακόμη το ακίνητο αυτού του αρχείου;» — μία ανάγνωση ανά ακίνητο για όλη τη δέσμη. */
export type LivePropertyProbe = (data: FileData) => Promise<boolean>;

/**
 * **Φτιάξε τον ανιχνευτή αποσυρμένου ακινήτου μιας δέσμης.**
 *
 * 🔑 Ίδια απάντηση με το `parentPropertyIsLive()` των κανόνων, **σκέλος προς σκέλος**: αρχείο που
 * δεν είναι ακινήτου, ή χωρίς `entityId`, ή του οποίου το ακίνητο **δεν υπάρχει πια**, είναι
 * *ζωντανό* — κλειδωμένο είναι μόνο ό,τι κρέμεται από ακίνητο **στο αρχείο ή στον κάδο**.
 * ⚠️ Γι' αυτό **όχι** `requirePropertyInTenantScope`: εκείνο απαντά 404 στο ανύπαρκτο ακίνητο,
 * δηλαδή θα κλείδωνε για πάντα τα ορφανά αρχεία που ο κανόνας άφηνε να πεταχτούν.
 */
export function createLivePropertyProbe(db: Firestore): LivePropertyProbe {
  const verdicts = new Map<string, Promise<boolean>>();

  const readVerdict = async (propertyId: string): Promise<boolean> => {
    const snapshot = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
    return !snapshot.exists || !isRetired(snapshot.data());
  };

  return async (data) => {
    if (data.entityType !== AGENCY_ENTITY_TYPE) return true;
    const propertyId = data.entityId;
    if (typeof propertyId !== 'string' || propertyId.length === 0) return true;

    const known = verdicts.get(propertyId) ?? readVerdict(propertyId);
    verdicts.set(propertyId, known);
    return known;
  };
}

/** Δικό του, ή έχει το δικαίωμα πάνω σε ξένο; */
function ownsOrMayTrashOthers(data: FileData, actor: FileTrashActor): boolean {
  if (data.createdBy === actor.uid) return true;
  const decision = decideCapability({ subject: actor.capability, action: TRASH_OTHERS_CAPABILITY });
  return isGranted(decision.verdict);
}

/**
 * **Η κρίση, καθαρή** — ώστε κάθε σκέλος να δοκιμάζεται χωρίς βάση. `null` = επιτρέπεται.
 *
 * ⚠️ Η σειρά είναι συμβόλαιο: πρώτα *«ποιος είσαι για αυτό το αρχείο»*, μετά *«τι θα έβλεπε ο
 * κόσμος»*, μετά η κατάσταση του ίδιου του αρχείου — ο άνθρωπος μαθαίνει τον λόγο που τον αφορά.
 */
export function judgeFileTrash(
  action: FileTrashAction,
  data: FileData,
  actor: FileTrashActor,
): FileTrashRefusal | null {
  if (!ownsOrMayTrashOthers(data, actor)) return 'not-owner';

  const isPublic = data.classification === FILE_CLASSIFICATIONS.PUBLIC;
  if (isPublic && !mayChangePublication(actor.capability)) return 'not-capable';

  if (action === 'trash' && data.status !== READY_STATUS) return 'not-ready';
  return null;
}

/** Τα πεδία του κάδου — τα **ίδια** που έγραφε ο πελάτης, με χρόνους διακομιστή. */
function trashUpdates(uid: string, purgeAt: string): Record<string, unknown> {
  const now = FieldValue.serverTimestamp();
  return {
    lifecycleState: FILE_LIFECYCLE_STATES.TRASHED,
    trashedAt: now,
    trashedBy: uid,
    purgeAt,
    isDeleted: true,
    deletedAt: now,
    deletedBy: uid,
    updatedAt: now,
  };
}

function restoreUpdates(uid: string): Record<string, unknown> {
  const now = FieldValue.serverTimestamp();
  return {
    lifecycleState: FILE_LIFECYCLE_STATES.ACTIVE,
    isDeleted: false,
    trashedAt: null,
    trashedBy: null,
    purgeAt: null,
    deletedAt: null,
    deletedBy: null,
    restoredAt: now,
    restoredBy: uid,
    updatedAt: now,
  };
}

export interface WriteFileTrashParams {
  readonly fileId: string;
  /** Το έγγραφο, **ήδη φορτωμένο και κριμένο ως δικό του μισθωτή** από τον PEP της διαδρομής (ADR-742). */
  readonly ref: DocumentReference;
  readonly data: FileData;
  readonly action: FileTrashAction;
  readonly actor: FileTrashActor;
  readonly propertyIsLive: LivePropertyProbe;
}

/**
 * **Πέτα ή επανάφερε ένα εταιρικό αρχείο** — κρίση, γραφή, ίχνος.
 *
 * ⛔ **ΔΕΝ ξαναπροβάλλει αγγελία.** Το κάνει ο **καλών**, μία φορά ανά ακίνητο για όλη τη δέσμη
 * *(`refreshListingsAfterFileChanges`)* — ίδιο συμβόλαιο με το `writeFileClassification`.
 *
 * ⚠️ **Το `trashedBy` είναι ο αιτών του αιτήματος**, ποτέ τιμή από τον πελάτη: ο παλιός δρόμος
 * δεχόταν ό,τι του έδιναν *(ένας καλών έγραφε `'system'`)*, δηλαδή το ίχνος μπορούσε να μη λέει ποιος.
 */
export async function writeFileTrashState(params: WriteFileTrashParams): Promise<FileTrashOutcome> {
  const { fileId, ref, data, action, actor } = params;
  const trashed = isInTrash(data);

  if (action === 'trash' && trashed) return { kind: 'unchanged' };
  if (action === 'restore' && !trashed) return { kind: 'refused', why: 'not-in-trash' };

  const refusal = judgeFileTrash(action, data, actor);
  if (refusal !== null) return { kind: 'refused', why: refusal };
  if (!(await params.propertyIsLive(data))) return { kind: 'refused', why: 'retired-property' };

  const purgeAt = action === 'trash'
    ? calculatePurgeDate(data.category as FileCategory).toISOString()
    : null;
  await ref.update(purgeAt === null ? restoreUpdates(actor.uid) : trashUpdates(actor.uid, purgeAt));

  await recordFileAudit({
    fileId,
    action: action === 'trash' ? 'delete' : 'restore',
    performedBy: actor.uid,
    companyId: actor.companyId,
  });

  return { kind: 'changed', purgeAt };
}
