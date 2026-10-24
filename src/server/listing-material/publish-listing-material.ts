import 'server-only';

/**
 * @fileoverview 🏆 **Ο ΚΙΝΗΤΗΡΑΣ ΤΗΣ ΔΗΜΟΣΙΕΥΣΗΣ ΥΛΙΚΟΥ ΑΓΓΕΛΙΑΣ** — ένα σώμα, κάθε κηδεμονία (ADR-909 Β1 · ADR-920 Β4.3).
 * @related app/api/properties/[id]/_shared/publish-property-material (το εταιρικό υποκείμενο) ·
 *   ./material-source-lookup · ./material-supersession
 * @module server/listing-material/publish-listing-material
 *
 * ```
 * [το υποκείμενο: κηδεμονία + δικαίωμα, ΗΔΗ κριμένα] → ανάγνωση αιτήματος → revisions σχεδίων → εγγραφή (PENDING)
 *   → προκάτοχοι → [φρουρός της πόρτας] → bytes → READY → διαδοχή → [δήλωση της πόρτας] → ΕΠΑΝΑΠΡΟΒΟΛΗ
 * ```
 *
 * 🔴 **ΓΙΑΤΙ ΕΝΑΣ ΚΙΝΗΤΗΡΑΣ ΚΑΙ ΟΧΙ ΔΕΥΤΕΡΟΣ ΚΟΡΜΟΣ ΓΙΑ ΤΟΝ ΙΔΙΟΚΤΗΤΗ.** Κάθε βήμα παραπάνω είναι απόφαση που
 * πληρώθηκε με περιστατικό: το *«ρωτάμε προκατόχους ΠΡΙΝ γράψουμε»* (Ο-27), το *«το δικαίωμα ΠΡΙΝ από κάθε
 * εγγραφή»* (Α3β), το *«η επαναπροβολή ΤΕΛΕΥΤΑΙΑ»* (Ο-35). Ένα αντίγραφο για τα αρχεία του φακέλου θα τα
 * κληρονομούσε **σήμερα** και θα τα έχανε στην πρώτη διόρθωση του ενός.
 *
 * 🔑 **ΤΙ ΔΙΑΦΕΡΕΙ ΑΝΑ ΚΗΔΕΜΟΝΙΑ ΖΕΙ ΣΤΟ ΥΠΟΚΕΙΜΕΝΟ** ({@link ListingMaterialSubject}), **τι διαφέρει ανά υλικό ζει
 * στην ΠΟΡΤΑ** ({@link ListingMaterialDoor}). Ο κινητήρας δεν ξέρει ούτε ποιος κατέχει το ακίνητο ούτε τι υλικό
 * δημοσιεύει — ξέρει μόνο τη **σειρά**.
 *
 * 🔒 **Η ΣΥΛΛΟΓΗ ΔΕΝ ΕΙΝΑΙ ΠΕΔΙΟ — ΠΡΟΚΥΠΤΕΙ ΑΠΟ ΤΟΝ ΔΡΑΣΤΗ.** Ο `transitionContainer` διαλέγει ήδη συλλογή και
 * κριτή από το `actor.custody`· εδώ η εγγραφή ρωτά το **ίδιο** πεδίο (`FILE_COLLECTION[custodyKindOfScope(…)]`).
 * Ένα χωριστό `filesCollection` θα ήταν δεύτερη απάντηση στο *«σε ποιον ανήκει;»*, ελεύθερη να αποκλίνει: το
 * υλικό θα γεννιόταν στο `files` και η διαδοχή θα έψαχνε τον προκάτοχο στο `files_personal`.
 *
 * 🔑 **Η επαναπροβολή είναι ΜΕΣΑ και ΥΠΟΧΡΕΩΤΙΚΗ** (`refresh`, όχι προαιρετικό): πόρτα που περνά από εδώ **δεν
 * μπορεί** να την ξεχάσει. Κάθε υποκείμενο την ονομάζει στατικά, ώστε το CHECK 3.76 να τη βλέπει.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_STATUS, type FileCategory } from '@/config/domain-constants';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { custodyKindOfScope } from '@/lib/workspace/custody-scope';
import {
  buildFinalizeFileRecordUpdate,
  type BuildPendingFileRecordResult,
  type FileRecordBase,
} from '@/services/file-record';
import type { ContainerActor } from '@/services/iso19650/container-transitions';
import type { ModelSourceRevision } from '@/lib/listings/model-source-revisions';
import { uploadPublicFile } from '@/services/storage-admin/public-upload.service';
import type { ListingMediaRefreshOutcome } from '@/services/listings/listing-media-refresh';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

import { archiveSuperseded } from './material-supersession';

const logger = createModuleLogger('ListingMaterialPublication');

/**
 * **Το ακίνητο ΚΑΙ ο κάτοχός του, ήδη κριμένα** — ό,τι διαφέρει ανά κηδεμονία, και τίποτα άλλο.
 *
 * ⚠️ Το υποκείμενο φτιάχνεται **μετά** τον φρουρό κηδεμονίας και το δικαίωμα δημοσίευσης: όποιος το κρατά, έχει
 * ήδη περάσει την πόρτα. Γι' αυτό ο κινητήρας δεν ξαναρωτά.
 */
export interface ListingMaterialSubject<TEnv, TBirth> {
  readonly adminDb: AdminFirestore;
  /** Το ακίνητο της αγγελίας: `properties/{id}` ή `owner_properties/{id}`. */
  readonly listingId: string;
  /** Ο **ΕΝΑΣ** δράστης: γράφει την εγγραφή (`createdBy`), αρχειοθετεί τους προκατόχους, ορίζει τη συλλογή. */
  readonly actor: ContainerActor;
  /** Ό,τι δίνεται στις αναγνώσεις και στους φρουρούς της πόρτας. */
  readonly env: TEnv;
  /** Η γέννηση της εγγραφής — **ανά κηδεμονία**, γιατί άλλα πεδία κατόχου γράφει το γραφείο, άλλα ο φάκελος. */
  readonly birthOf: (sourceRevisions: readonly ModelSourceRevision[]) => TBirth;
  /** Τα `revision` των σχεδίων της σκηνής, διαβασμένα από τον **διακομιστή** (ADR-845 Ο-25). Δεν πετά. */
  readonly readSourceRevisions: (sceneFileIds: readonly string[]) => Promise<readonly ModelSourceRevision[]>;
  /** Ποια ενεργά αρχεία δημοσιεύουν το ίδιο πράγμα — **στο ίδιο** διαμέρισμα με τον δράστη. Δεν πετά. */
  readonly findPredecessors: (category: FileCategory, newcomer: FileRecordBase) => Promise<readonly string[]>;
  /** 🔑 Η επαναπροβολή της αγγελίας — **τελευταία**, awaited, δεν πετά. */
  readonly refresh: () => Promise<ListingMediaRefreshOutcome>;
}

/** Η στιγμή ανάμεσα στην κρίση και στην πρώτη εγγραφή — η τελευταία ευκαιρία για άρνηση χωρίς ίχνος. */
export interface ListingMaterialVerdict {
  readonly fileId: string;
  readonly supersedes: readonly string[];
}

/**
 * **Ό,τι διαφέρει από υλικό σε υλικό** — και τίποτα από ό,τι είναι κοινό.
 *
 * ⚠️ Κάθε άρνηση της πόρτας είναι `ApiError` με **δικό της** κωδικό: ο άνθρωπος στην άλλη άκρη πρέπει
 * να μάθει *τι* να διορθώσει (ADR-844 §1).
 */
export interface ListingMaterialDoor<TParsed, TDeclared, TEnv, TBirth> {
  /** Ο κάδος του υλικού — στενεύει το ερώτημα των προκατόχων. */
  readonly category: FileCategory;
  readonly codes: { readonly uploadFailed: string };
  /** Το αίτημα → ό,τι έστειλε ο άνθρωπος, **κριμένο**. Πετά `ApiError` για κάθε άρνηση. */
  readonly read: (formData: FormData, env: TEnv) => Promise<TParsed>;
  readonly fileOf: (parsed: TParsed) => File;
  /** Ποια αρχεία σκηνής παρήγαγαν το υλικό — ο διακομιστής διαβάζει το `revision` τους. */
  readonly sceneFileIdsOf: (parsed: TParsed) => readonly string[];
  /** **Ο ΕΝΑΣ κατασκευαστής της πόρτας.** Πετά `ApiError` αν η εγγραφή δεν επιτρέπεται να γεννηθεί. */
  readonly recordOf: (parsed: TParsed, birth: TBirth) => BuildPendingFileRecordResult;
  /** Ό,τι ταξιδεύει **μέσα στο ίδιο `save()`** με τα bytes. */
  readonly customMetadataOf?: (parsed: TParsed) => Record<string, string>;
  /** Φρουρός **πριν** από κάθε εγγραφή, όταν οι προκάτοχοι είναι γνωστοί. */
  readonly beforeWrite?: (parsed: TParsed, verdict: ListingMaterialVerdict, env: TEnv) => void;
  /**
   * Η δήλωση της πόρτας, **μετά** τη διαδοχή και **πριν** την επαναπροβολή — ώστε η αγγελία να
   * προβληθεί με τη δήλωση ήδη γραμμένη. ⚠️ Δεν επιτρέπεται να ρίξει τη δημοσίευση: επιστρέφει.
   */
  readonly afterSuccession?: (parsed: TParsed, verdict: ListingMaterialVerdict, env: TEnv) => Promise<TDeclared>;
}

export interface ListingMaterialPublication<TParsed, TDeclared> {
  readonly listingId: string;
  readonly fileId: string;
  readonly storagePath: string;
  /** Ποιους διαδέχεται — ταυτοποιητικά· κενό = πρώτη δημοσίευση αυτής της ταυτότητας. */
  readonly supersedes: readonly string[];
  /** Ποιοι από αυτούς αρχειοθετήθηκαν **πράγματι**. */
  readonly archived: readonly string[];
  /** Τι έγινε στην αγγελία — το υλικό ανέβηκε σε **κάθε** τιμή. */
  readonly listing: ListingMediaRefreshOutcome;
  readonly parsed: TParsed;
  readonly sourceRevisions: readonly ModelSourceRevision[];
  readonly bytes: number;
  readonly declared: TDeclared | undefined;
}

/**
 * **Έγγραφο σε αναμονή → bytes (+ ό,τι ταξιδεύει μαζί τους) → έτοιμο.**
 *
 * ⚠️ **Ο κύκλος ζωής είναι ο ΥΠΑΡΧΩΝ**: ο αναγνώστης της δημοσίευσης φιλτράρει `status === READY`,
 * άρα ένα ημιτελές ανέβασμα είναι **αόρατο** αντί για επικίνδυνο.
 * ⚠️ **Η αποτυχία σημαδεύεται, δεν σιωπά**: ένα `FAILED` έγγραφο λέει *«κάτι ανέβηκε και δεν
 * ολοκληρώθηκε»*, ενώ η διαγραφή του θα άφηνε **μόνο** ορφανά bytes και καμία εξήγηση.
 */
async function writeMaterial(params: {
  adminDb: AdminFirestore;
  actor: ContainerActor;
  fileId: string;
  storagePath: string;
  recordBase: FileRecordBase;
  file: File;
  customMetadata: Record<string, string> | undefined;
  uploadFailed: string;
}): Promise<number> {
  const kind = custodyKindOfScope(params.actor.custody);
  const filesRef = params.adminDb.collection(COLLECTIONS[FILE_COLLECTION[kind]]).doc(params.fileId);
  await filesRef.set({ ...params.recordBase, createdAt: FieldValue.serverTimestamp() });

  try {
    const buffer = Buffer.from(await params.file.arrayBuffer());
    const { url: downloadUrl } = await uploadPublicFile({
      storagePath: params.storagePath,
      buffer,
      contentType: params.file.type,
      createdBy: params.actor.uid,
      // 🏆 **«ΜΙΑ ΕΓΓΡΑΦΗ»** — ό,τι δηλώνει η πόρτα μπαίνει στο ίδιο `save()` με τα bytes.
      ...(params.customMetadata === undefined ? {} : { customMetadata: params.customMetadata }),
    });

    await filesRef.update({
      ...buildFinalizeFileRecordUpdate({ sizeBytes: buffer.length, downloadUrl, nextStatus: FILE_STATUS.READY }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return buffer.length;
  } catch (error) {
    try {
      await filesRef.update({ status: FILE_STATUS.FAILED, updatedAt: FieldValue.serverTimestamp() });
    } catch { /* το αρχικό σφάλμα είναι το χρήσιμο — μην το σκεπάσεις */ }
    logger.error('Το ανέβασμα υλικού απέτυχε', { fileId: params.fileId, custody: kind, error: getErrorMessage(error) });
    throw new ApiError(500, params.uploadFailed);
  }
}

/**
 * 🏆 **Η ΔΗΜΟΣΙΕΥΣΗ** — ένα σώμα για κάθε πόρτα που γεννά υλικό αγγελίας, σε κάθε κηδεμονία.
 *
 * 🔑 **Οι προκάτοχοι ρωτιούνται ΠΡΙΝ γραφτεί το νέο έγγραφο** *(Ο-27)*: μετά, ο νεοφερμένος θα ήταν
 * μέσα στο αποτέλεσμα και θα έπρεπε να **εξαιρεθεί** — μια γραμμή που, αν ξεχαστεί, κάνει το υλικό να
 * διαδεχθεί τον εαυτό του την ίδια στιγμή που δημοσιεύεται.
 * 🔴 **Η επαναπροβολή είναι ΤΕΛΕΥΤΑΙΑ** *(Ο-35)*, ώστε να δει τον κόσμο όπως έμεινε — νέο `ready`,
 * προκάτοχοι στο αρχείο, δήλωση γραμμένη.
 */
export async function publishListingMaterial<TParsed, TDeclared, TEnv, TBirth>(
  formData: FormData,
  subject: ListingMaterialSubject<TEnv, TBirth>,
  door: ListingMaterialDoor<TParsed, TDeclared, TEnv, TBirth>,
): Promise<ListingMaterialPublication<TParsed, TDeclared>> {
  const { adminDb, actor, env, listingId } = subject;

  const parsed = await door.read(formData, env);
  const sourceRevisions = await subject.readSourceRevisions(door.sceneFileIdsOf(parsed));
  const { fileId, storagePath, recordBase } = door.recordOf(parsed, subject.birthOf(sourceRevisions));

  const supersedes = await subject.findPredecessors(door.category, recordBase);
  const verdict: ListingMaterialVerdict = { fileId, supersedes };
  door.beforeWrite?.(parsed, verdict, env);

  const bytes = await writeMaterial({
    adminDb, actor, fileId, storagePath, recordBase, file: door.fileOf(parsed),
    customMetadata: door.customMetadataOf?.(parsed), uploadFailed: door.codes.uploadFailed,
  });
  const archived = await archiveSuperseded(actor, supersedes, fileId);
  const declared = await door.afterSuccession?.(parsed, verdict, env);
  const listing = await subject.refresh();

  return { listingId, fileId, storagePath, supersedes, archived, listing, parsed, sourceRevisions, bytes, declared };
}
