/**
 * @fileoverview **Ο ΣΚΕΛΕΤΟΣ ΚΑΘΕ ΜΑΖΙΚΗΣ ΠΡΑΞΗΣ ΑΡΧΕΙΩΝ** — ένα σώμα για όλες τις πόρτες δέσμης.
 * @related ADR-845 §7.17 (κλάση Ο-35) · app/api/files/classification · app/api/files/trash
 * @module app/api/files/_shared/file-batch-act
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η διαβάθμιση (Α1) και ο κάδος (Α2) κάνουν **την ίδια διαδρομή** με άλλον γραφέα στη μέση:
 * κρίνε το σώμα → για κάθε αρχείο *φόρτωσε · δικό μου; · γράψε* → μάζεψε τις αρνήσεις →
 * ξαναπρόβαλε **μία φορά ανά ακίνητο**. Δύο αντίγραφα θα ήταν δίδυμα *(N.18)*, και το τρίτο
 * *(αρχειοθέτηση)* έρχεται. Εδώ ζει το κοινό· κάθε πόρτα φέρνει **μόνο** τον γραφέα της.
 *
 * ⚠️ **Η επαναπροβολή είναι μέρος του σκελετού, όχι του γραφέα — επίτηδες.** Πόρτα που περνά
 * από εδώ **δεν μπορεί** να ξεχάσει να ξαναπροβάλει: είναι ακριβώς η παράλειψη της κλάσης Ο-35.
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

export interface FileBatchResult<T> {
  /** Όσα **άλλαξαν**, με τη σειρά του αιτήματος. */
  readonly changed: readonly { readonly file: OwnedBatchFile; readonly detail: T }[];
  readonly errors: readonly string[];
  readonly listings: readonly ListingRefreshReport[];
}

/** Το σώμα του αιτήματος ως αντικείμενο — ό,τι δεν είναι αντικείμενο διαβάζεται κενό. */
export async function readJsonBody(request: { json(): Promise<unknown> }): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}

/** Τα `fileIds`, κριμένα και χωρίς διπλά — ή η ονομασμένη άρνησή τους. */
export function readBatchFileIds(payload: Readonly<Record<string, unknown>>): readonly string[] | string {
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
export function fileActorOf(ctx: AuthContext): ClassificationActor {
  return {
    uid: ctx.uid,
    companyId: ctx.companyId,
    capability: { globalRole: ctx.globalRole, permissions: ctx.permissions, companyId: ctx.companyId },
  };
}

/** **Ένα αρχείο**: φόρτωσε → δικό μου; → δώσ' το στον γραφέα. Ξένο = ανύπαρκτο (κανένα μαντείο ύπαρξης). */
async function actOnOne<T>(
  fileId: string,
  spec: FileBatchSpec<T>,
): Promise<{ readonly changed: FileBatchResult<T>['changed'][number] } | { readonly error: string } | null> {
  const owned = await fileResource.load({
    docId: fileId,
    caller: spec.ctx,
    action: spec.action,
    refusal: () => `${fileId}: not found`,
    db: getAdminFirestore(),
  });
  if (owned.refusal !== undefined) return { error: owned.refusal };

  const file: OwnedBatchFile = { fileId, ref: owned.doc.ref, data: owned.doc.data ?? {} };
  const verdict = await spec.act(file);

  if (verdict === null) return null;
  if ('refused' in verdict) return { error: `${fileId}: ${verdict.refused}` };
  return { changed: { file, detail: verdict.changed } };
}

export interface FileBatchSpec<T> {
  readonly fileIds: readonly string[];
  readonly ctx: AuthContext;
  /** Το όνομα της πράξης στο ίχνος του PEP (`fileResource`). */
  readonly action: string;
  /** Ο γραφέας **αυτής** της πόρτας. */
  readonly act: (file: OwnedBatchFile) => Promise<FileActVerdict<T>>;
}

/**
 * **Τρέξε μια μαζική πράξη αρχείων** — σειριακά, μία αποτυχία δεν σταματά τα υπόλοιπα.
 *
 * 🔴 **Η επαναπροβολή ΤΕΛΕΥΤΑΙΑ, ΜΙΑ ΦΟΡΑ ΑΝΑ ΑΚΙΝΗΤΟ** (ADR-845 §7.17): η αγγελία βλέπει τον
 * κόσμο όπως **έμεινε**, και όποιος είδε επιτυχία δικαιούται να έχει **ήδη** αλλάξει.
 */
export async function runFileBatch<T>(spec: FileBatchSpec<T>): Promise<FileBatchResult<T>> {
  const changed: FileBatchResult<T>['changed'][number][] = [];
  const errors: string[] = [];

  for (const fileId of spec.fileIds) {
    try {
      const result = await actOnOne(fileId, spec);
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

/** Ο κοινός φάκελος μιας δέσμης που **εκτελέστηκε** — και με αρνήσεις ανά αρχείο είναι `success`. */
export function batchEnvelope<T>(result: FileBatchResult<T>): FileBatchActResponse {
  return {
    success: true,
    processedCount: result.changed.length,
    errors: result.errors,
    listings: result.listings,
  };
}
