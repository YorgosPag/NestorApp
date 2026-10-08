/**
 * @fileoverview **Η ΑΡΧΕΙΟΘΕΤΗΣΗ ΕΙΝΑΙ ΠΡΑΞΗ ΜΕ ΚΡΙΤΗ** — ο ΕΝΑΣ γραφέας της χειροκίνητης αρχειοθέτησης.
 * @related ADR-845 §7.17 Α3 (κλάση Ο-35) · ADR-191 §3.2 · ADR-862 Φ0 Β10 (διαδοχή) · ADR-801 (ο ΕΝΑΣ κριτής)
 * @module services/file-record/file-archive.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΝΤΙΚΑΘΙΣΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως την Α3 η γραφή ζούσε **μέσα** στη διαδρομή (`api/files/archive/route.ts`), και:
 *
 * 1. φωτογραφία που αρχειοθετήθηκε **έμενε** στη δημόσια αγγελία — καμία επαναπροβολή δεν έτρεχε·
 * 2. το ίχνος γραφόταν **χωρίς `companyId`**, δηλαδή σε γραμμή που ο μόνος αναγνώστης δεν μπορεί
 *    να ρωτήσει — αόρατη σε κάθε άνθρωπο, για πάντα *(`file-audit-admin.service`, κεφαλή)*·
 * 3. το δικαίωμα δημοσίευσης της διαβάθμισης παρακαμπτόταν με **βαρύτερη** πράξη: όποιος δεν
 *    μπορούσε να σημάνει μια φωτογραφία «εσωτερικό» μπορούσε να την **αρχειοθετήσει**.
 *
 * ⚠️ **Δεν είναι ο γραφέας της ΔΙΑΔΟΧΗΣ.** Η αρχειοθέτηση της παλιάς έκδοσης όταν ανεβαίνει νέα
 * γράφεται **ατομικά** με την πράξη δοχείου *(`container-transitions` → `archivalFieldsOf`)*. Εδώ
 * ζει μόνο το *«ο άνθρωπος πάτησε Αρχειοθέτηση / Επαναφορά από το αρχείο»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΟΙΟΣ ΕΠΙΤΡΕΠΕΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | ερώτημα | ποιος απαντά |
 * |---|---|
 * | αρχείο `public` ⇒ δικαίωμα δημοσίευσης | `mayChangePublication` — αρχειοθέτηση = απόσυρση, επαναφορά = επαναδημοσίευση |
 * | αρχείο **στον κάδο** | άρνηση — ο κάδος έχει τον **δικό του** γραφέα και τη δική του «Επαναφορά» |
 * | επαναφορά **αντικατεστημένης** έκδοσης | άρνηση — γίνεται με προώθηση ως **νέα** έκδοση (ADR-862 Φ0 Β10) |
 *
 * Κάθε άλλο αρχείο: κάθε μέλος του μισθωτή, όπως πάντα. ⛔ **Κανένα όνομα ρόλου εδώ** (CHECK 3.68).
 */

import 'server-only';

import type { DocumentReference } from 'firebase-admin/firestore';

import { FILE_CLASSIFICATIONS, FILE_LIFECYCLE_STATES } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';
import { readContainerState } from '@/lib/files/file-record-read';
import { isInTrash } from '@/lib/files/file-trash-state';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import {
  mayChangePublication,
  type ClassificationActor,
} from '@/services/file-record/file-classification.service';

/** Οι δύο κατευθύνσεις — το λεξιλόγιο του σύρματος. */
export const FILE_ARCHIVE_ACTIONS = ['archive', 'unarchive'] as const;
export type FileArchiveAction = (typeof FILE_ARCHIVE_ACTIONS)[number];

/** Στενεύει `unknown → FileArchiveAction` — η πόρτα δεν εμπιστεύεται το σώμα του αιτήματος. */
export function isFileArchiveAction(value: unknown): value is FileArchiveAction {
  return FILE_ARCHIVE_ACTIONS.some((action) => action === value);
}

/**
 * Γιατί **όχι** — κλειστό σύνολο, ώστε η οθόνη να μπορεί να το πει (N.11).
 *
 * - `not-capable` — αρχείο `public` χωρίς δικαίωμα δημοσίευσης *(ίδιο όνομα με διαβάθμιση και κάδο)*
 * - `in-trash` — το αρχείο είναι στον κάδο· βγαίνει μόνο με την «Επαναφορά» του κάδου
 * - `superseded-restore-via-new-version` — αντικατεστημένη έκδοση δεν «ξαναγίνεται ενεργή»
 */
export const FILE_ARCHIVE_REFUSALS = [
  'not-capable',
  'in-trash',
  'superseded-restore-via-new-version',
] as const;
export type FileArchiveRefusal = (typeof FILE_ARCHIVE_REFUSALS)[number];

/** Ο αιτών — ίδια όψη με τη διαβάθμιση: ταυτότητα για το ίχνος, ρόλος για τον κριτή. */
export type FileArchiveActor = ClassificationActor;

type FileData = Readonly<Record<string, unknown>>;

/**
 * **Τι έγινε** — ονομασμένα, ποτέ boolean *(ADR-844 §1)*.
 *
 * 🔑 Το `unchanged` είναι **δηλωμένη** απάντηση: αρχείο που είναι ήδη στη ζητούμενη κατάσταση δεν
 * γράφεται, δεν καταγράφεται και **δεν** ξαναπροβάλλει αγγελία.
 */
export type FileArchiveOutcome =
  | { readonly kind: 'changed' }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly why: FileArchiveRefusal };

/** Είναι ήδη εκεί που ζητήθηκε; — αρχειοθετημένο για `archive`, **μη** αρχειοθετημένο για `unarchive`. */
function isAlreadyThere(action: FileArchiveAction, data: FileData): boolean {
  const archived = data.lifecycleState === FILE_LIFECYCLE_STATES.ARCHIVED;
  return action === 'archive' ? archived : !archived;
}

/**
 * **Η κρίση, καθαρή** — ώστε κάθε σκέλος να δοκιμάζεται χωρίς βάση. `null` = επιτρέπεται.
 *
 * ⚠️ Η σειρά είναι συμβόλαιο, ίδια με τον κάδο: πρώτα *«τι θα έβλεπε ο κόσμος»* (ποιος είσαι),
 * μετά η κατάσταση του ίδιου του αρχείου — ο άνθρωπος μαθαίνει τον λόγο που τον αφορά.
 */
export function judgeFileArchive(
  action: FileArchiveAction,
  data: FileData,
  actor: FileArchiveActor,
): FileArchiveRefusal | null {
  const isPublic = data.classification === FILE_CLASSIFICATIONS.PUBLIC;
  if (isPublic && !mayChangePublication(actor.capability)) return 'not-capable';

  // Αρχείο του κάδου με `lifecycleState: 'archived'` θα έμενε `isDeleted` — δύο καταστάσεις μαζί,
  // και η εκκαθάριση θα το έσβηνε ενώ ο άνθρωπος το βλέπει «αρχειοθετημένο».
  if (action === 'archive' && isInTrash(data)) return 'in-trash';

  // 🔴 Β10 — δύο ενεργές εκδόσεις της ίδιας θέσης είναι ψέμα για το ποια ισχύει. Κατά Autodesk
  //    Docs η επαναφορά παλιάς έκδοσης είναι **αντίγραφο που προωθείται** ως νέα — ποτέ ανάσταση.
  if (action === 'unarchive' && readContainerState(data).phase === 'SUPERSEDED') {
    return 'superseded-restore-via-new-version';
  }
  return null;
}

/**
 * Τα πεδία της γραφής.
 *
 * ⚠️ Η επαναφορά **καθαρίζει** το `archivedAt` / `archivedBy` — η διαδρομή τα άφηνε, και ενεργό
 * αρχείο έφερε για πάντα *«αρχειοθετήθηκε στις…»* *(μετρημένο ζωντανά 2026-10-08)*. Ίδιο ιδίωμα
 * με την επαναφορά από τον κάδο: `null`, ποτέ `undefined`.
 */
function archiveUpdates(action: FileArchiveAction, uid: string): Record<string, string | null> {
  const now = nowISO();
  return action === 'archive'
    ? { lifecycleState: FILE_LIFECYCLE_STATES.ARCHIVED, archivedAt: now, archivedBy: uid, updatedAt: now }
    : { lifecycleState: FILE_LIFECYCLE_STATES.ACTIVE, archivedAt: null, archivedBy: null, updatedAt: now };
}

export interface WriteFileArchiveParams {
  readonly fileId: string;
  /** Το έγγραφο, **ήδη φορτωμένο και κριμένο ως δικό του μισθωτή** από τον PEP της διαδρομής (ADR-742). */
  readonly ref: DocumentReference;
  readonly data: FileData;
  readonly action: FileArchiveAction;
  readonly actor: FileArchiveActor;
}

/**
 * **Αρχειοθέτησε ή επανάφερε από το αρχείο ένα εταιρικό αρχείο** — κρίση, γραφή, ίχνος.
 *
 * ⛔ **ΔΕΝ ξαναπροβάλλει αγγελία.** Το κάνει ο **καλών**, μία φορά ανά ακίνητο για όλη τη δέσμη
 * *(`runFileBatch`)* — ίδιο συμβόλαιο με το `writeFileClassification` και το `writeFileTrashState`.
 *
 * ⚠️ **Το ίχνος φέρει `companyId`** (ο αιτών): χωρίς αυτό η γραμμή δεν διαβάζεται από κανέναν.
 */
export async function writeFileArchiveState(params: WriteFileArchiveParams): Promise<FileArchiveOutcome> {
  const { fileId, ref, data, action, actor } = params;

  if (isAlreadyThere(action, data)) return { kind: 'unchanged' };

  const refusal = judgeFileArchive(action, data, actor);
  if (refusal !== null) return { kind: 'refused', why: refusal };

  await ref.update(archiveUpdates(action, actor.uid));

  await recordFileAudit({
    fileId,
    action: 'archive',
    performedBy: actor.uid,
    companyId: actor.companyId,
    metadata: { archiveAction: action },
  });

  return { kind: 'changed' };
}
