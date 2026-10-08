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
import { fileResource } from './file-ownership';

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

/** **Ένα αρχείο**: φόρτωσε → δικό μου; → δώσ' το στον γραφέα. Ξένο = ανύπαρκτο (κανένα μαντείο ύπαρξης). */
async function actOnOne<T>(
  fileId: string,
  spec: FileBatchSpec<T, object>,
  actor: ClassificationActor,
): Promise<{ readonly changed: ChangedBatchFile<T> } | { readonly error: string } | null> {
  const owned = await fileResource.load({
    docId: fileId,
    caller: spec.ctx,
    action: spec.action,
    refusal: () => `${fileId}: not found`,
    db: getAdminFirestore(),
  });
  if (owned.refusal !== undefined) return { error: owned.refusal };

  const file: OwnedBatchFile = { fileId, ref: owned.doc.ref, data: owned.doc.data ?? {} };
  const verdict = await spec.act(file, actor);

  if (verdict === null) return null;
  if ('refused' in verdict) return { error: `${fileId}: ${verdict.refused}` };
  return { changed: { file, detail: verdict.changed } };
}

/** Σειριακά, μία αποτυχία δεν σταματά τα υπόλοιπα — και η επαναπροβολή **τελευταία**. */
async function actOnBatch<T>(
  fileIds: readonly string[],
  spec: FileBatchSpec<T, object>,
): Promise<FileBatchResult<T>> {
  const actor = fileActorOf(spec.ctx);
  const changed: ChangedBatchFile<T>[] = [];
  const errors: string[] = [];

  for (const fileId of fileIds) {
    try {
      const result = await actOnOne(fileId, spec, actor);
      if (result === null) continue;
      if ('error' in result) errors.push(result.error);
      else changed.push(result.changed);
    } catch (error) {
      errors.push(`${fileId}: ${getErrorMessage(error)}`);
      logger.error('Η πράξη αρχείου απέτυχε', { action: spec.action, fileId, error: getErrorMessage(error) });
    }
  }

  const listings = await refreshListingsAfterFileChanges(
    getAdminFirestore(),
    changed.map(({ file }) => file.data),
  );

  logger.info('Μαζική πράξη αρχείων', {
    action: spec.action, changed: changed.length, errors: errors.length, listings: listings.length,
  });

  return { changed, errors, listings };
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
export async function runFileBatch<T, E extends object>(
  spec: FileBatchSpec<T, E>,
): Promise<NextResponse<FileBatchActResponse & E>> {
  const fileIds = readBatchFileIds(spec.payload);
  if (typeof fileIds === 'string') return batchRefusal(400, fileIds, spec.extra([]));

  const result = await actOnBatch(fileIds, spec);

  return NextResponse.json({
    success: true,
    processedCount: result.changed.length,
    errors: result.errors,
    listings: result.listings,
    ...spec.extra(result.changed),
  });
}
