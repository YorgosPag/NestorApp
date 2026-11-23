/**
 * @fileoverview **Ο ΣΚΕΛΕΤΟΣ ΚΑΘΕ ΜΑΖΙΚΗΣ ΠΡΑΞΗΣ ΑΡΧΕΙΩΝ** — ένα σώμα για όλες τις πόρτες δέσμης.
 * @related ADR-845 §7.17 (κλάση Ο-35) · app/api/files/classification · app/api/files/trash ·
 *   app/api/files/archive
 * @module app/api/files/_shared/file-batch-act
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η διαβάθμιση (Α1), ο κάδος (Α2) και η αρχειοθέτηση (Α3) κάνουν **την ίδια διαδρομή** με άλλον
 * γραφέα στη μέση: κρίνε το σώμα → για κάθε αρχείο *φόρτωσε · δικό μου; · γράψε* → μάζεψε τις
 * αρνήσεις → ξαναπρόβαλε **μία φορά ανά ακίνητο** → απάντησε. Τρία αντίγραφα θα ήταν τρίδυμα
 * *(N.18)*. Εδώ ζει το κοινό· κάθε πόρτα φέρνει **μόνο** τον γραφέα της.
 *
 * ⚠️ **Η επαναπροβολή είναι μέρος του σκελετού, όχι του γραφέα — επίτηδες.** Πόρτα που περνά
 * από εδώ **δεν μπορεί** να ξεχάσει να ξαναπροβάλει: είναι ακριβώς η παράλειψη της κλάσης Ο-35.
 *
 * 🔑 **Και η απάντηση είναι του σκελετού** *(Α3)*: με την τρίτη πόρτα το *«κρίνε τα `fileIds` →
 * φτιάξε τον αιτούντα → τρέξε → φάκελος»* **μετρήθηκε** ως κλώνος ανάμεσα σε διαδρομές
 * (CHECK 3.28). Η πόρτα δίνει πλέον μόνο τον γραφέα της και ό,τι **επιπλέον** θέλει στο σύρμα
 * *(`extra`)*.
 */

import 'server-only';

import { NextResponse } from 'next/server';
import type { DocumentReference } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import type { OwnedDocOutcome } from '@/lib/auth/owned-doc-loader';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import {
  MAX_FILES_PER_BATCH_ACT,
  type FileBatchActResponse,
} from '@/services/file-record/file-batch-act.types';
import type { ClassificationActor } from '@/services/file-record/file-classification.service';
import {
  refreshListingsAfterFileChanges,
  type ListingRefreshReport,
} from '@/services/listings/listing-media-refresh';
import { fileResource, personalFileResource } from './file-ownership';

const logger = createModuleLogger('FileBatchAct');

/** Ένα αρχείο της δέσμης, **ήδη φορτωμένο και κριμένο ως δικό του μισθωτή** (ADR-742). */
export interface OwnedBatchFile {
  readonly fileId: string;
  readonly ref: DocumentReference;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * Τι είπε ο γραφέας για **ένα** αρχείο: άλλαξε *(με ό,τι θέλει να θυμάται η πόρτα)* · αρνήθηκε
 * με όνομα · ή `null` όταν δεν είχε τίποτα να αλλάξει *(ιδεμποτία — ούτε σφάλμα, ούτε αλλαγή)*.
 */
export type FileActVerdict<T> = { readonly changed: T } | { readonly refused: string } | null;

/** Ένα αρχείο που **άλλαξε**, με ό,τι θέλησε να θυμάται η πόρτα του. */
export interface ChangedBatchFile<T> {
  readonly file: OwnedBatchFile;
  readonly detail: T;
}

interface FileBatchResult<T> {
  /** Όσα **άλλαξαν**, με τη σειρά του αιτήματος. */
  readonly changed: readonly ChangedBatchFile<T>[];
  readonly errors: readonly string[];
  readonly listings: readonly ListingRefreshReport[];
}

/**
 * Η έκβαση **κάθε** γραφέα αρχείου, όσο τη χρειάζεται ο σκελετός — τα τρία ονόματα που μοιράζονται
 * διαβάθμιση, κάδος και αρχειοθέτηση *(ό,τι επιπλέον φέρει η καθεμία το διαβάζει η πόρτα της)*.
 */
export type FileWriteOutcome =
  | { readonly kind: 'changed' }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly why: string };

/**
 * **Η έκβαση του γραφέα → η ετυμηγορία του σκελετού.** `unchanged` ⇒ `null`: ούτε σφάλμα, ούτε αλλαγή.
 *
 * @param detail — ό,τι θέλει να θυμάται η πόρτα για αρχείο που **άλλαξε** (αγνοείται αλλιώς).
 */
export function verdictOf<T>(outcome: FileWriteOutcome, detail: T): FileActVerdict<T> {
  if (outcome.kind === 'refused') return { refused: outcome.why };
  return outcome.kind === 'changed' ? { changed: detail } : null;
}

/** Το σώμα του αιτήματος ως αντικείμενο — ό,τι δεν είναι αντικείμενο διαβάζεται κενό. */
export async function readJsonBody(request: { json(): Promise<unknown> }): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}

/** Τα `fileIds`, κριμένα και χωρίς διπλά — ή η ονομασμένη άρνησή τους. */
function readBatchFileIds(payload: Readonly<Record<string, unknown>>): readonly string[] | string {
  const { fileIds } = payload;

  if (!Array.isArray(fileIds) || fileIds.length === 0) return 'fileIds array is required';
  if (fileIds.length > MAX_FILES_PER_BATCH_ACT) return `Maximum ${MAX_FILES_PER_BATCH_ACT} files per request`;
  if (!fileIds.every((id): id is string => typeof id === 'string' && id.length > 0)) {
    return 'fileIds must be non-empty strings';
  }

  // Το ίδιο αρχείο δύο φορές θα έγραφε μία φορά και θα ανέφερε «unchanged» τη δεύτερη — σιωπηλό.
  return [...new Set(fileIds)];
}

/** Η άρνηση **ολόκληρου** του αιτήματος *(άκυρο σώμα)* — ίδιος φάκελος με την επιτυχία. */
export function batchRefusal<E extends object>(
  status: number,
  message: string,
  extra: E,
): NextResponse<FileBatchActResponse & E> {
  return NextResponse.json(
    { success: false, processedCount: 0, errors: [message], listings: [], ...extra },
    { status },
  );
}

/** Ο αιτών όπως τον χρειάζονται οι γραφείς: ταυτότητα για το ίχνος, όψη ρόλου για τον κριτή. */
function fileActorOf(ctx: AuthContext): ClassificationActor {
  return {
    uid: ctx.uid,
    companyId: ctx.companyId,
    capability: { globalRole: ctx.globalRole, permissions: ctx.permissions, companyId: ctx.companyId },
  };
}

export interface FileBatchSpec<T, E extends object> {
  /** Το σώμα του αιτήματος, **ωμό** — ο σκελετός κρίνει τα `fileIds` του. */
  readonly payload: Readonly<Record<string, unknown>>;
  readonly ctx: AuthContext;
  /** Το όνομα της πράξης στο ίχνος του PEP (`fileResource`). */
  readonly action: string;
  /** Ο γραφέας **αυτής** της πόρτας — με τον αιτούντα έτοιμο για τον κριτή και το ίχνος. */
  readonly act: (file: OwnedBatchFile, actor: ClassificationActor) => Promise<FileActVerdict<T>>;
  /**
   * Ό,τι **επιπλέον** του κοινού φακέλου στέλνει η πόρτα, από όσα **άλλαξαν**. Καλείται και με
   * κενή λίστα για την άρνηση ολόκληρου του αιτήματος — ίδιο σχήμα σύρματος σε επιτυχία και άρνηση.
   */
  readonly extra: (changed: readonly ChangedBatchFile<T>[]) => E;
}

/**
 * Η πόρτα που δεν στέλνει τίποτα πέρα από τον κοινό φάκελο.
 *
 * ⚠️ `object`, **όχι** `Record<string, never>`: το δεύτερο, σε τομή με τον φάκελο, θα έκανε
 * **κάθε** πεδίο του `never`.
 */
export const noBatchExtra = (): object => ({});

/**
 * **Το ζευγάρι μιας πόρτας**: πώς φορτώνεται ένα αρχείο ως **δικό** του αιτούντος, και ποιος γραφέας το δέχεται.
 *
 * 🔑 Ό,τι διαφέρει ανά διαμέρισμα ζει **μόνο** εδώ (ADR-866 2β.3β — «το πρώτο βήμα διαφέρει ανά κάτοχο, η σειρά είναι
 * μία»): εταιρεία ⇒ `fileResource` (μισθωτής) · άνθρωπος ⇒ `personalFileResource` (`userId == uid`). Η σειρά, οι
 * αρνήσεις, η επαναπροβολή και ο φάκελος της απάντησης είναι **ένας** δρόμος.
 */
interface BatchCustody<T> {
  readonly label: string;
  /** Το έγγραφο ως δικό του αιτούντος — ή το κείμενο άρνησης («δεν βρέθηκε», ίδιο για ξένο και ανύπαρκτο). */
  readonly load: (fileId: string) => Promise<OwnedBatchFile | string>;
  readonly act: (file: OwnedBatchFile) => Promise<FileActVerdict<T>>;
}

/** Το κείμενο άρνησης φόρτωσης — ένα για τα δύο διαμερίσματα, ώστε να μη γίνει μαντείο διαμερίσματος. */
const notFound = (fileId: string) => () => `${fileId}: not found`;

/** Ό,τι φόρτωσε ο PEP, ως αρχείο της δέσμης — ή η άρνησή του. */
function ownedOrRefusal(fileId: string, owned: OwnedDocOutcome<string>): OwnedBatchFile | string {
  if (owned.refusal !== undefined) return owned.refusal;
  return { fileId, ref: owned.doc.ref, data: owned.doc.data ?? {} };
}

/** **Ένα αρχείο**: φόρτωσε → δικό μου; → δώσ' το στον γραφέα. Ξένο = ανύπαρκτο (κανένα μαντείο ύπαρξης). */
async function actOnOne<T>(
  fileId: string,
  custody: BatchCustody<T>,
): Promise<{ readonly changed: ChangedBatchFile<T> } | { readonly error: string } | null> {
  const file = await custody.load(fileId);
  if (typeof file === 'string') return { error: file };

  const verdict = await custody.act(file);

  if (verdict === null) return null;
  if ('refused' in verdict) return { error: `${fileId}: ${verdict.refused}` };
  return { changed: { file, detail: verdict.changed } };
}

/** Σειριακά, μία αποτυχία δεν σταματά τα υπόλοιπα — και η επαναπροβολή **τελευταία**. */
async function actOnBatch<T>(
  fileIds: readonly string[],
  custody: BatchCustody<T>,
): Promise<FileBatchResult<T>> {
  const changed: ChangedBatchFile<T>[] = [];
  const errors: string[] = [];

  for (const fileId of fileIds) {
    try {
      const result = await actOnOne(fileId, custody);
      if (result === null) continue;
      if ('error' in result) errors.push(result.error);
      else changed.push(result.changed);
    } catch (error) {
      errors.push(`${fileId}: ${getErrorMessage(error)}`);
      logger.error('Η πράξη αρχείου απέτυχε', { action: custody.label, fileId, error: getErrorMessage(error) });
    }
  }

  const listings = await refreshListingsAfterFileChanges(
    getAdminFirestore(),
    changed.map(({ file }) => file.data),
  );

  logger.info('Μαζική πράξη αρχείων', {
    action: custody.label, changed: changed.length, errors: errors.length, listings: listings.length,
  });

  return { changed, errors, listings };
}

/** Κρίνε τα `fileIds`, τρέξε, απάντησε — ο **ένας** φάκελος σύρματος για κάθε πόρτα και κάθε διαμέρισμα. */
async function respondBatch<T, E extends object>(
  payload: Readonly<Record<string, unknown>>,
  custody: BatchCustody<T>,
  extra: (changed: readonly ChangedBatchFile<T>[]) => E,
): Promise<NextResponse<FileBatchActResponse & E>> {
  const fileIds = readBatchFileIds(payload);
  if (typeof fileIds === 'string') return batchRefusal(400, fileIds, extra([]));

  const result = await actOnBatch(fileIds, custody);

  return NextResponse.json({
    success: true,
    processedCount: result.changed.length,
    errors: result.errors,
    listings: result.listings,
    ...extra(result.changed),
  });
}

/**
 * **Τρέξε μια μαζική πράξη αρχείων και απάντησε** — η ΜΙΑ είσοδος κάθε πόρτας δέσμης.
 *
 * Άκυρα `fileIds` ⇒ 400 με όνομα. Αλλιώς ο κοινός φάκελος *(και με αρνήσεις ανά αρχείο είναι
 * `success` — μερική επιτυχία είναι νόμιμη έκβαση)* συν το `extra` της πόρτας.
 *
 * 🔴 **Η επαναπροβολή ΤΕΛΕΥΤΑΙΑ, ΜΙΑ ΦΟΡΑ ΑΝΑ ΑΚΙΝΗΤΟ** (ADR-845 §7.17): η αγγελία βλέπει τον
 * κόσμο όπως **έμεινε**, και όποιος είδε επιτυχία δικαιούται να έχει **ήδη** αλλάξει.
 */
export function runFileBatch<T, E extends object>(
  spec: FileBatchSpec<T, E>,
): Promise<NextResponse<FileBatchActResponse & E>> {
  const actor = fileActorOf(spec.ctx);
  return respondBatch(spec.payload, {
    label: spec.action,
    load: async (fileId) => ownedOrRefusal(fileId, await fileResource.load({
      docId: fileId, caller: spec.ctx, action: spec.action, refusal: notFound(fileId), db: getAdminFirestore(),
    })),
    act: (file) => spec.act(file, actor),
  }, spec.extra);
}

/** Η ίδια πόρτα για **προσωπικά** αρχεία — ο αιτών είναι μόνο `uid`, ο κάτοχος που ελέγχεται είναι ο ίδιος. */
export interface PersonalFileBatchSpec<T, E extends object> {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly uid: string;
  /** Το όνομα της πράξης στο ίχνος του PEP (`personalFileResource`). */
  readonly action: string;
  readonly act: (file: OwnedBatchFile) => Promise<FileActVerdict<T>>;
  readonly extra: (changed: readonly ChangedBatchFile<T>[]) => E;
}

/**
 * **Το ίδιο, στο ΠΡΟΣΩΠΙΚΟ διαμέρισμα** (ADR-920 §14.11 Ζ3b) — ίδιος σκελετός, ίδια επαναπροβολή.
 *
 * 🔑 Ο φρουρός είναι το `personalFileResource`: `userId == uid`, αλλιώς το **ίδιο** «δεν βρέθηκε». Καμία παράκαμψη
 * super admin — ο κανόνας του `files_personal` τον αποκλείει, και ο διακομιστής δεν γίνεται χαλαρότερος από αυτόν.
 */
export function runPersonalFileBatch<T, E extends object>(
  spec: PersonalFileBatchSpec<T, E>,
): Promise<NextResponse<FileBatchActResponse & E>> {
  return respondBatch(spec.payload, {
    label: spec.action,
    load: async (fileId) => ownedOrRefusal(fileId, await personalFileResource.load({
      docId: fileId, uid: spec.uid, action: spec.action, refusal: notFound(fileId), db: getAdminFirestore(),
    })),
    act: spec.act,
  }, spec.extra);
}
