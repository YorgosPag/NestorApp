/**
 * =============================================================================
 * «ΔΙΟΡΘΩΣΗ ΑΝΑΓΝΩΣΗΣ» ΕΓΓΡΑΦΟΥ ΕΠΑΦΗΣ — ΜΙΑ διαδρομή, δύο πράξεις (ADR-950 §10)
 * =============================================================================
 *
 * `POST /api/files/{fileId}/evidence-corrections`
 *   · `{ act: 'correct', row, values }` — ο άνθρωπος διάβασε ο ίδιος τη γραμμή· μόνιμο, ορατό σε όλο το γραφείο
 *   · `{ act: 'clear', row }`           — πίσω στην ανάγνωση της μηχανής
 *
 * 🔑 **Η πράξη είναι δεδομένο, όχι διεύθυνση** — ίδιο σκεπτικό με το `evidence-dismissals`.
 * 🔑 **Γράφει στο ΑΡΧΕΙΟ, ποτέ στην επαφή**: η διόρθωση είναι ανάγνωση. Η επαφή αλλάζει μόνο από «Καταχώριση» /
 *    «Αποθήκευση». Η τιμή ξανακρίνεται από τον γραφέα με τους ίδιους ελεγκτές (422 αν δεν περνά).
 * 🔒 `crm:contacts:update` — αφορά τα **στοιχεία της επαφής**. Απομόνωση μισθωτή: PEP (`resolveContainerFile`) + ο
 *    γραφέας ξανακρίνει `companyId`.
 * 🔁 Ιδεμπότητα: από το σύνορο `withAuth` (CHECK 3.92) **και** εκ κατασκευής (μία διόρθωση ανά γραμμή).
 * ⚡ `STANDARD` ρητά (CHECK 3.78): μικρή εγγραφή σε ένα έγγραφο.
 *
 * @module app/api/files/[fileId]/evidence-corrections
 */

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { isEvidenceRowKey } from '@/lib/contacts/contact-evidence-dismissals';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { isPlainRecord } from '@/lib/type-guards';
import {
  applyEvidenceCorrection,
  type EvidenceCorrectionCommand,
  type EvidenceCorrectionOutcome,
} from '@/server/files/evidence-corrections-writer';
import {
  fileNotFoundResponse,
  resolveContainerFile,
  type FileSegment,
} from '../../_shared/container-route-responses';

function commandOf(payload: unknown): EvidenceCorrectionCommand | null {
  if (!isPlainRecord(payload) || !isEvidenceRowKey(payload.row)) return null;
  if (payload.act === 'clear') return { act: 'clear', row: payload.row };
  if (payload.act !== 'correct' || !isPlainRecord(payload.values)) return null;
  return { act: 'correct', row: payload.row, values: payload.values };
}

const STATUS: Readonly<Record<Exclude<EvidenceCorrectionOutcome['kind'], 'not-found'>, number>> = {
  corrected: 200,
  cleared: 200,
  'not-a-contact-file': 409,
  'no-such-row': 409,
  'invalid-value': 422,
};

/** Η έκβαση ως σύρμα — το `kind` ταξιδεύει ως σταθερό αναγνωριστικό, η οθόνη το μεταφράζει (N.11). */
function toResponse(outcome: EvidenceCorrectionOutcome): NextResponse {
  if (outcome.kind === 'not-found') return fileNotFoundResponse();
  const status = STATUS[outcome.kind];
  return NextResponse.json({ success: status === 200, ...outcome }, { status });
}

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
  segment?: FileSegment,
): Promise<NextResponse> {
  const resolved = await resolveContainerFile(segment, { custody: 'company', ctx }, 'evidence-correction');
  if (resolved.refusal) return resolved.refusal;

  const command = commandOf(await request.json().catch(() => null));
  if (command === null) {
    return NextResponse.json({ error: 'Invalid evidence correction command' }, { status: 400 });
  }

  const { companyId, uid } = ctx;
  return toResponse(await applyEvidenceCorrection(getAdminFirestore(), { fileId: resolved.fileId, companyId, uid, command }));
}

export const POST = withStandardRateLimit(
  withAuth<unknown, FileSegment>(handlePost, { permissions: 'crm:contacts:update' }),
);
