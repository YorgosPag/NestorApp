/**
 * =============================================================================
 * «ΟΡΙΣΜΟΣ ΩΣ ΤΡΕΧΟΥΣΑΣ» — Ο ΕΝΟΡΧΗΣΤΡΩΤΗΣ (ADR-862 Φ0 · ανοιχτό του Β10)
 * =============================================================================
 *
 * **Η ροή** (η πολιτική στο `version-promotion-policy.ts`):
 *
 *   1. πηγή του μισθωτή, με bytes;               ⇒ `not-found` / `source-not-ready`
 *   2. η κεφαλή είναι αυτή που είδε ο αιτών;     ⇒ `head-moved`   (AIP-154 etag)
 *   3. η πηγή είναι ήδη η κεφαλή;                ⇒ `noop`
 *   4. ντετερμινιστικό id διαδόχου               ⇒ επανάληψη = ίδιο αποτέλεσμα
 *   5. αντιγραφή bytes (claim πρώτα)             ⇒ `copyPublicFile`
 *   6. **ΜΙΑ συναλλαγή**: κρίση + γέννηση διαδόχου + αρχειοθέτηση κεφαλής
 *                                                 ⇒ `transitionContainer({ successorBirth })`
 *   7. άρνηση στο (6) ⇒ **αντιστάθμιση** του (5)  ⇒ `discardPublicCopy`
 *
 * ⚠️ **Η ικανότητα κρίνεται από τον γραφέα**, όχι εδώ (`iso19650:containers:supersede`):
 * δεύτερος έλεγχος εδώ θα ήταν δεύτερος κριτής που μπορεί να διαφωνήσει με τον πρώτο.
 * Κόστος: μια άρνηση ικανότητας έρχεται **μετά** την αντιγραφή — και αντισταθμίζεται.
 *
 * @module services/iso19650/version-promotion
 */

import 'server-only';

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { generateDeterministicFileId } from '@/services/enterprise-id.service';
import { buildPendingFileRecordData } from '@/services/file-record/file-record-core';
import { copyPublicFile, discardPublicCopy } from '@/services/storage-admin/public-upload.service';
import { FILE_STATUS } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';

import {
  transitionContainer,
  type ContainerActor,
  type ContainerRefusalReason,
} from './container-transitions';
import {
  promotedSuccessorRecord,
  promotionSeed,
  successorBuilderInput,
  type PromotionPreflightRefusal,
} from './version-promotion-policy';
import { readVersionStack } from './version-stack';

const logger = createModuleLogger('VersionPromotion');

export interface VersionPromotionRequest {
  readonly actor: ContainerActor;
  /** Η **παλιά** έκδοση που γίνεται ξανά τρέχουσα. */
  readonly sourceFileId: string;
  /** Η κεφαλή που **είδε** ο αιτών — η προϋπόθεση (AIP-154). */
  readonly expectedHeadFileId: string;
}

export type VersionPromotionOutcome =
  | { readonly kind: 'promoted'; readonly successorId: string; readonly previousHeadFileId: string }
  | { readonly kind: 'noop'; readonly why: 'already-current' | 'already-promoted' }
  | { readonly kind: 'refused'; readonly why: PromotionPreflightRefusal | ContainerRefusalReason };

/** (4) Ο διάδοχος αυτής της αίτησης — ίδια (μισθωτής, πηγή, κεφαλή) ⇒ ίδιο id. */
function successorIdOf(request: VersionPromotionRequest): string {
  return generateDeterministicFileId(
    promotionSeed(request.actor.companyId, request.sourceFileId, request.expectedHeadFileId),
  );
}

/** (1)-(3) Η προετοιμασία — μόνο αναγνώσεις. */
async function preflight(
  request: VersionPromotionRequest,
): Promise<VersionPromotionOutcome | { readonly kind: 'ready'; readonly source: FileRecord; readonly head: FileRecord }> {
  const stack = await readVersionStack(request.actor.companyId, request.sourceFileId);
  if (stack.kind === 'not-found') return { kind: 'refused', why: 'not-found' };
  // ♻️ Επανάληψη της ΙΔΙΑΣ αίτησης που ήδη πέτυχε: η κεφαλή ΕΙΝΑΙ ο ντετερμινιστικός διάδοχος.
  const successorId = successorIdOf(request);
  if (stack.headFileId === successorId) {
    return { kind: 'promoted', successorId, previousHeadFileId: request.expectedHeadFileId };
  }
  if (stack.headFileId !== request.expectedHeadFileId) return { kind: 'refused', why: 'head-moved' };
  if (stack.headFileId === request.sourceFileId) return { kind: 'noop', why: 'already-current' };

  const source = stack.versions.find(version => version.id === request.sourceFileId);
  const head = stack.versions.find(version => version.id === stack.headFileId);
  if (!source || !head) return { kind: 'refused', why: 'not-found' };
  if (source.status !== FILE_STATUS.READY || !source.storagePath) {
    return { kind: 'refused', why: 'source-not-ready' };
  }
  return { kind: 'ready', source, head };
}

/**
 * **Η παλιά έκδοση γίνεται ξανά τρέχουσα** — ως **νέα** έκδοση στην κορυφή.
 *
 * @example
 * const outcome = await promoteVersion({ actor, sourceFileId: 'file_v2', expectedHeadFileId: 'file_v3' });
 */
export async function promoteVersion(request: VersionPromotionRequest): Promise<VersionPromotionOutcome> {
  const prepared = await preflight(request);
  if (prepared.kind !== 'ready') return prepared;
  const { source, head } = prepared;

  const successorId = successorIdOf(request);
  const { storagePath, recordBase } = buildPendingFileRecordData(
    successorBuilderInput({ source, head, successorId, companyId: request.actor.companyId, actorUid: request.actor.uid }),
  );

  const copy = await copyPublicFile({
    sourcePath: source.storagePath,
    storagePath,
    contentType: source.contentType,
    sizeBytes: source.sizeBytes ?? 0,
    createdBy: request.actor.uid,
  });

  const outcome = await transitionContainer({
    fileId: head.id,
    act: 'supersede',
    actor: request.actor,
    supersededByFileId: successorId,
    successorBirth: promotedSuccessorRecord({ base: { ...recordBase }, source, head, downloadUrl: copy.url }),
  });

  if (outcome.kind === 'transitioned') {
    return { kind: 'promoted', successorId, previousHeadFileId: head.id };
  }
  // Άρνηση ή noop: η γέννηση ΔΕΝ γράφτηκε ⇒ το αντίγραφο μένει claim ⇒ αντιστάθμιση.
  await compensate(storagePath, successorId);
  return outcome.kind === 'noop'
    ? { kind: 'noop', why: 'already-promoted' }
    : { kind: 'refused', why: outcome.why };
}

/** (7) Η αντιστάθμιση — αποτυχία της **δεν** κρύβει την άρνηση που την προκάλεσε. */
async function compensate(storagePath: string, successorId: string): Promise<void> {
  try {
    await discardPublicCopy(storagePath);
  } catch (error: unknown) {
    logger.error('Η αντιστάθμιση αντιγράφου απέτυχε — μένει ορφανό αντίγραφο χωρίς FileRecord', {
      successorId,
      storagePath,
      error: getErrorMessage(error),
    });
  }
}
