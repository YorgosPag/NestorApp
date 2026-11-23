/**
 * @fileoverview **Ο ΚΑΔΟΣ ΤΩΝ ΑΡΧΕΙΩΝ ΕΙΝΑΙ ΠΡΑΞΗ ΔΙΑΚΟΜΙΣΤΗ** — ο ΕΝΑΣ γραφέας του, και στα δύο διαμερίσματα.
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
 * ⇒ Ο πελάτης **ζητά**· εδώ **κρίνεται, γράφεται και καταγράφεται**. Από το ADR-920 §14.11 Ζ3b το ίδιο ισχύει και
 * για τα **προσωπικά** αρχεία ({@link writePersonalFileTrashState}): ο φάκελος ακινήτου τροφοδοτεί την αγγελία
 * ιδιοκτήτη, άρα ο κάδος του έχει την ίδια διαρροή #1. Η ατομικότητα πράξης + γραμμής Δραστηριότητας που έδιναν
 * οι κανόνες (ADR-866 §2.6.11) τη δίνει πλέον η **δέσμη** του διακομιστή.
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
 * | **record** (αντίτυπο Πρωτοκόλλου εταιρείας) ⇒ ποτέ κάδος | ο ΕΝΑΣ κριτής `fileTrashBlockOf` — ίδιος με το κουμπί (ADR-916 Φ-Δ.6) |
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
import { fileTrashBlockOf } from '@/lib/files/file-hold';
import { calculatePurgeDate, isInTrash } from '@/lib/files/file-trash-state';
import { fileRestoreFields, fileTrashFields } from '@/lib/files/file-trash-fields';
import { FieldValue, getAdminFirestore } from '@/lib/firebaseAdmin';
import { isRetired } from '@/lib/firestore/trashed-status';
import { recordFileAudit, stagePairedFileActivity } from '@/services/file-audit-admin.service';
import {
  mayChangePublication,
  type ClassificationActor,
} from '@/services/file-record/file-classification.service';
import { AGENCY_ENTITY_TYPE } from '@/services/listings/agency-media-publication';
import { isGranted } from '@/types/capability-authority';
import { FILE_LAST_ACTIVITY_FIELD } from '@/types/file-audit';

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
 * - `record` — νομικό τεκμήριο (ADR-916 Φ-Δ.6): ούτε κάδος, για κανέναν ρόλο — ίδιο όνομα με το `FileTrashBlock`
 */
export const FILE_TRASH_REFUSALS = [
  'not-owner',
  'not-capable',
  'not-ready',
  'not-in-trash',
  'retired-property',
  'record',
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

  // 📜 ADR-916 Φ-Δ.6 — record: ο ίδιος κριτής που κρύβει το κουμπί. Η επαναφορά δεν αρνείται (record στον κάδο δεν υπάρχει
  //    ποτέ· αν υπήρχε από πριν τον κριτή, η επαναφορά το **σώζει** — Purview: ό,τι είναι record μένει διαθέσιμο).
  if (action === 'trash' && fileTrashBlockOf(data) !== null) return 'record';

  if (action === 'trash' && data.status !== READY_STATUS) return 'not-ready';
  return null;
}

/** Τα πεδία του κάδου — η ΜΙΑ δήλωση (`fileTrashFields`, κοινή με τα Functions), με χρόνους διακομιστή. */
function trashUpdates(uid: string, purgeAt: string): Record<string, unknown> {
  return fileTrashFields({
    trashedState: FILE_LIFECYCLE_STATES.TRASHED,
    by: uid,
    purgeAt,
    now: FieldValue.serverTimestamp(),
  });
}

/** Τα πεδία της επαναφοράς — η ΜΙΑ δήλωση (`fileRestoreFields`, κοινή με την ανάσταση καραντίνας, ADR-934 Μ-β5). */
function restoreUpdates(uid: string): Record<string, unknown> {
  return fileRestoreFields({ activeState: FILE_LIFECYCLE_STATES.ACTIVE, by: uid, now: FieldValue.serverTimestamp() });
}

/**
 * **Η μετάβαση που ΔΕΝ χρειάζεται κρίση** — κοινή στα δύο διαμερίσματα. Ήδη στον κάδο ⇒ `unchanged` (ο δεύτερος κάδος
 * δεν μεταθέτει το ρολόι εκκαθάρισης, ADR-866 §2.6.11 Β3)· επαναφορά αρχείου εκτός κάδου ⇒ ονομασμένη άρνηση.
 */
function settledTransition(action: FileTrashAction, data: FileData): FileTrashOutcome | null {
  const trashed = isInTrash(data);
  if (action === 'trash' && trashed) return { kind: 'unchanged' };
  if (action === 'restore' && !trashed) return { kind: 'refused', why: 'not-in-trash' };
  return null;
}

/** Πότε εκκαθαρίζεται — μόνο για κάδο· η επαναφορά το μηδενίζει. */
function purgeAtOf(action: FileTrashAction, data: FileData): string | null {
  return action === 'trash' ? calculatePurgeDate(data.category as FileCategory).toISOString() : null;
}

/** Τα πεδία της πράξης — κάδος όταν υπάρχει `purgeAt`, αλλιώς επαναφορά. */
function stateUpdates(uid: string, purgeAt: string | null): Record<string, unknown> {
  return purgeAt === null ? restoreUpdates(uid) : trashUpdates(uid, purgeAt);
}

/** Το όνομα της πράξης στο βιβλίο — το λεξιλόγιο του ιστορικού, όχι του σύρματος. */
function auditActionOf(action: FileTrashAction): 'delete' | 'restore' {
  return action === 'trash' ? 'delete' : 'restore';
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
  const settled = settledTransition(action, data);
  if (settled !== null) return settled;

  const refusal = judgeFileTrash(action, data, actor);
  if (refusal !== null) return { kind: 'refused', why: refusal };
  if (!(await params.propertyIsLive(data))) return { kind: 'refused', why: 'retired-property' };

  const purgeAt = purgeAtOf(action, data);
  await ref.update(stateUpdates(actor.uid, purgeAt));

  await recordFileAudit({
    fileId,
    action: auditActionOf(action),
    performedBy: actor.uid,
    companyId: actor.companyId,
  });

  return { kind: 'changed', purgeAt };
}

// =============================================================================
// ΤΟ ΠΡΟΣΩΠΙΚΟ ΔΙΑΜΕΡΙΣΜΑ — ΙΔΙΑ ΠΡΑΞΗ, ΑΛΛΟΣ ΚΑΤΟΧΟΣ (ADR-845 §7.17 · ADR-866 §2.6.11)
// =============================================================================

export interface WritePersonalFileTrashParams {
  readonly fileId: string;
  /** Το έγγραφο, **ήδη κριμένο ως δικό του** (`personalFileResource`: `userId == uid`, αλλιώς 404). */
  readonly ref: DocumentReference;
  readonly data: FileData;
  readonly action: FileTrashAction;
  /** Ο αιτών — **και** κάτοχος του αρχείου και του βιβλίου του (το απέδειξε ο PEP). */
  readonly uid: string;
}

/**
 * **Πέτα ή επανάφερε ένα ΠΡΟΣΩΠΙΚΟ αρχείο** — μετάβαση, γραφή και γραμμή Δραστηριότητας **σε μία δέσμη**.
 *
 * 🔴 **Γιατί ήρθε εδώ** (ADR-920 §14.11 Ζ3b): ως τότε ο κάδος του `files_personal` γραφόταν από τον browser. Τα
 * αρχεία του **φακέλου ακινήτου** (φωτογραφίες · ΠΕΑ · τοπογραφικό σχέδιο) τροφοδοτούν την αγγελία ιδιοκτήτη, και
 * ο browser δεν έχει πώς να την ξαναπροβάλει ⇒ ό,τι πεταγόταν **έμενε δημόσιο**. Ίδια κλάση Ο-35 με την εταιρική.
 *
 * 🔑 **Η κρίση είναι η ιδιοκτησία, και μόνο** (Google Drive «Ο Δίσκος μου»): κανένα δικαίωμα ρόλου, καμία διαβάθμιση.
 * ⚠️ **Χωρίς κριτή record** — επίτηδες, ίδιο με τον κανόνα (`fileIsNotDeclaredRecord`, «ΜΟΝΟ στο `files`»): το
 * αντίτυπο του αγοραστή κουβαλά το σημάδι αλλά μένει **δικό του**. ⚠️ Χωρίς ανιχνευτή αποσυρμένου ακινήτου: προσωπικό
 * αρχείο δεν κρέμεται ποτέ από εταιρικό ακίνητο.
 * ⛔ **ΔΕΝ ξαναπροβάλλει** — όπως ο εταιρικός αδελφός, το κάνει ο σκελετός μία φορά ανά αγγελία.
 */
export async function writePersonalFileTrashState(params: WritePersonalFileTrashParams): Promise<FileTrashOutcome> {
  const { fileId, ref, data, action, uid } = params;
  const settled = settledTransition(action, data);
  if (settled !== null) return settled;
  if (action === 'trash' && data.status !== READY_STATUS) return { kind: 'refused', why: 'not-ready' };

  const purgeAt = purgeAtOf(action, data);
  const batch = getAdminFirestore().batch();
  const activityId = stagePairedFileActivity(batch, {
    fileId,
    action: auditActionOf(action),
    performedBy: uid,
    userId: uid,
  });
  batch.update(ref, { ...stateUpdates(uid, purgeAt), [FILE_LAST_ACTIVITY_FIELD]: activityId });
  await batch.commit();

  return { kind: 'changed', purgeAt };
}
