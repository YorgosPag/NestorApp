/**
 * =============================================================================
 * «ΑΓΝΟΗΣΗ» ΔΙΑΦΟΡΑΣ ΕΓΓΡΑΦΟΥ ↔ ΕΠΑΦΗΣ — ΜΙΑ διαδρομή, δύο πράξεις (ADR-950 §4.5)
 * =============================================================================
 *
 * `POST /api/files/{fileId}/evidence-dismissals`
 *   · `{ act: 'dismiss', row, reason }` — μόνιμη, ορατή σε όλο το γραφείο, δεμένη στην τιμή του εγγράφου
 *   · `{ act: 'restore', row }`         — η διαφορά ξαναζητά κρίση
 *
 * 🔑 **Η πράξη είναι δεδομένο, όχι διεύθυνση** — ίδιο σκεπτικό με το `hold/route.ts` (N.18).
 * 🔑 **Ο πελάτης ΔΕΝ στέλνει την τιμή** που αγνοεί: την υπολογίζει ο γραφέας από την αποθηκευμένη ανάγνωση.
 * 🔒 `crm:contacts:update` — η απόφαση αφορά τα **στοιχεία της επαφής**, ίδιο δικαίωμα με το
 *    `adopt-declared-credential`. Απομόνωση μισθωτή: PEP (`resolveContainerFile`) + ο γραφέας ξανακρίνει `companyId`.
 * 🔁 Ιδεμπότητα: από το σύνορο `withAuth` (CHECK 3.92) **και** εκ κατασκευής (μία απόφαση ανά γραμμή).
 * ⚡ `STANDARD` ρητά (CHECK 3.78): μικρή εγγραφή σε ένα έγγραφο.
 *
 * @module app/api/files/[fileId]/evidence-dismissals
 */

import { NextRequest, NextResponse } from 'next/server';

import { EVIDENCE_DISMISS_REASONS } from '@/config/contact-document-evidence';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { isEvidenceRowKey } from '@/lib/contacts/contact-evidence-dismissals';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { isOneOf, isPlainRecord } from '@/lib/type-guards';
import {
  applyEvidenceDismissal,
  type EvidenceDismissalCommand,
  type EvidenceDismissalOutcome,
} from '@/server/files/evidence-dismissals-writer';
import {
  fileNotFoundResponse,
  resolveContainerFile,
  type FileSegment,
} from '../../_shared/container-route-responses';

function commandOf(payload: unknown): EvidenceDismissalCommand | null {
  if (!isPlainRecord(payload) || !isEvidenceRowKey(payload.row)) return null;
  if (payload.act === 'restore') return { act: 'restore', row: payload.row };
  if (payload.act !== 'dismiss' || !isOneOf(EVIDENCE_DISMISS_REASONS, payload.reason)) return null;
  return { act: 'dismiss', row: payload.row, reason: payload.reason };
}

/** Η έκβαση ως σύρμα — το `kind` ταξιδεύει ως σταθερό αναγνωριστικό, η οθόνη το μεταφράζει (N.11). */
function toResponse(outcome: EvidenceDismissalOutcome): NextResponse {
  switch (outcome.kind) {
    case 'not-found':
      return fileNotFoundResponse();
    case 'not-a-contact-file':
    case 'nothing-to-dismiss':
      return NextResponse.json({ success: false, kind: outcome.kind }, { status: 409 });
    case 'dismissed':
    case 'restored':
      return NextResponse.json({ success: true, ...outcome }, { status: 200 });
  }
}

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
  segment?: FileSegment,
): Promise<NextResponse> {
  const resolved = await resolveContainerFile(segment, { custody: 'company', ctx }, 'evidence-dismissal');
  if (resolved.refusal) return resolved.refusal;

  const command = commandOf(await request.json().catch(() => null));
  if (command === null) {
    return NextResponse.json({ error: 'Invalid evidence dismissal command' }, { status: 400 });
  }

  const outcome = await applyEvidenceDismissal(getAdminFirestore(), {
    fileId: resolved.fileId,
    companyId: ctx.companyId,
    uid: ctx.uid,
    command,
  });
  return toResponse(outcome);
}

export const POST = withStandardRateLimit(
  withAuth<unknown, FileSegment>(handlePost, { permissions: 'crm:contacts:update' }),
);
