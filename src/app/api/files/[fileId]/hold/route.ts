/**
 * =============================================================================
 * ΔΕΣΜΕΥΣΗ ΔΙΑΤΗΡΗΣΗΣ ΑΡΧΕΙΟΥ — ΜΙΑ διαδρομή, δύο πράξεις (ADR-864 §21)
 * =============================================================================
 *
 * `POST /api/files/{fileId}/hold`
 *   · `{ act: 'place', holdType: 'legal' | 'regulatory' | 'admin', reason }`
 *   · `{ act: 'release' }`
 *
 * 🔑 **Η πράξη είναι δεδομένο, όχι διεύθυνση** — ίδιο σκεπτικό με το `cde/route.ts`: δύο
 * αρχεία `place/` · `release/` θα διέφεραν σε ένα literal (N.18, CHECK 3.28).
 *
 * 🔒 **Το δικαίωμα δηλώνεται στο σύνορο** (`legal:holds:manage`, ADR-801): και οι δύο πράξεις
 * θέλουν την **ίδια** ικανότητα, άρα δεν υπάρχει λόγος να κριθεί ανά πράξη όπως στο CDE.
 * Το **ίδιο** δικαίωμα κρίνει και τη δικαστική δέσμευση αποδεικτικού (`mandate-evidence/.../legal-hold`).
 *
 * ⚠️ **ΣΚΟΠΙΜΑ χωρίς `containerVisibilityRefusal`**: η δέσμευση διατήρησης πρέπει να φτάνει
 * **κάθε** αρχείο του μισθωτή — και το WIP ομάδας που ο διαχειριστής δεν βλέπει. Στο Google
 * Vault η δέσμευση δεν απαιτεί πρόσβαση στο περιεχόμενο· και η απάντηση **δεν** αποκαλύπτει
 * περιεχόμενο (μόνο ids). Η απομόνωση μισθωτή μένει: PEP (`resolveOwnedFile`) + ο γραφέας
 * διαβάζει τη στοίβα **μόνο** του μισθωτή.
 *
 * ⚡ `SENSITIVE` ρητά (CHECK 3.78): αλλάζει **τι μπορεί να σβηστεί ποτέ** — βαθμίδα ταυτότητας.
 *
 * @module app/api/files/[fileId]/hold
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { holdReasonOf, isPlaceableHoldType, type PlaceableHoldType } from '@/lib/files/file-hold';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  placeFileHold,
  releaseFileHold,
  type FileHoldOutcome,
} from '@/services/file-record/file-hold.service';
import {
  fileNotFoundResponse,
  resolveOwnedFile,
  type FileSegment,
} from '../../_shared/container-route-responses';

/** Το σώμα, κριμένο — ή `null` (⇒ 400). */
type HoldCommand =
  | { readonly act: 'place'; readonly holdType: PlaceableHoldType; readonly reason: string }
  | { readonly act: 'release' };

function commandOf(payload: Record<string, unknown>): HoldCommand | null {
  if (payload.act === 'release') return { act: 'release' };
  if (payload.act !== 'place' || !isPlaceableHoldType(payload.holdType)) return null;
  const reason = holdReasonOf(payload.reason);
  return reason === null ? null : { act: 'place', holdType: payload.holdType, reason };
}

/** Η έκβαση ως σύρμα — το `kind` ταξιδεύει ως σταθερό αναγνωριστικό, η οθόνη το μεταφράζει (N.11). */
function toResponse(outcome: FileHoldOutcome): NextResponse {
  switch (outcome.kind) {
    case 'not-found':
      return fileNotFoundResponse();
    case 'already-held':
      return NextResponse.json({ success: false, kind: outcome.kind, holdType: outcome.holdType }, { status: 409 });
    case 'failed':
      return NextResponse.json({ success: false, kind: outcome.kind }, { status: 500 });
    default:
      return NextResponse.json({ success: true, ...outcome }, { status: 200 });
  }
}

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
  segment?: FileSegment,
): Promise<NextResponse> {
  const resolved = await resolveOwnedFile(segment, ctx, 'hold');
  if (resolved.refusal) return resolved.refusal;

  const body: unknown = await request.json().catch(() => null);
  const command = commandOf((body ?? {}) as Record<string, unknown>);
  if (command === null) {
    return NextResponse.json({ error: 'Invalid hold command' }, { status: 400 });
  }

  const actor = { uid: ctx.uid, companyId: ctx.companyId };
  const outcome = command.act === 'place'
    ? await placeFileHold({ actor, fileId: resolved.fileId, holdType: command.holdType, reason: command.reason })
    : await releaseFileHold({ actor, fileId: resolved.fileId });
  return toResponse(outcome);
}

export const POST = withSensitiveRateLimit(
  withAuth<unknown, FileSegment>(handlePost, { permissions: 'legal:holds:manage' }),
);
