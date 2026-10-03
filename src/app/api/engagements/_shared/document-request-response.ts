/**
 * ADR-901 Φ4.5 — η ΜΙΑ μετάφραση «Ζήτησε έγγραφο» → HTTP, για **τις δύο** εισόδους: τον επαγγελματία
 * (`/api/engagements/{id}/document-requests`) και τον οικοδεσπότη (`/api/conveyance-cases/{id}/document-requests`).
 *
 * - **ένα** σχήμα σώματος: `{ checklistItemIds: [1..DOCUMENT_REQUEST_BATCH_MAX] }` — «Ζήτησε» και «Ζήτησε όλα» είναι
 *   το ίδιο αίτημα με άλλο πλήθος
 * - αποτέλεσμα **ανά γραμμή** (`requested` · `already-requested` · `refused`) — 200 ακόμη κι αν κάποιες αρνήθηκαν:
 *   το «Ζήτησε όλα» δεν αποτυγχάνει ολόκληρο επειδή μία γραμμή δεν είχε παραλήπτη
 * - υπόθεση κλειστή ⇒ 409 · δική μου συμμετοχή χωρίς πρόσβαση ⇒ 403 με ονομασμένο λόγο · «δεν ξέρω» ⇒ 503
 *
 * @module api/engagements/_shared/document-request-response
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { DOCUMENT_REQUEST_BATCH_MAX } from '@/config/engagement-policy';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import type { RequestDocumentsOutcome } from '@/services/conveyance/conveyance-document-request.service';
import type { EngagedCaseResolution } from '@/services/conveyance/conveyance-engagement-access.service';

export const documentRequestBody = z.object({
  checklistItemIds: z.array(z.string().min(1).max(100)).min(1).max(DOCUMENT_REQUEST_BATCH_MAX),
});

type ResolutionFailure = Extract<EngagedCaseResolution, { ok: false }>;

export function documentRequestResponse(outcome: RequestDocumentsOutcome | ResolutionFailure) {
  if (outcome.ok) return apiSuccess({ items: outcome.items });
  switch (outcome.rejection) {
    case 'case-closed':
      return NextResponse.json({ success: false, error: 'case-closed' }, { status: 409 });
    case 'denied':
      return NextResponse.json({ success: false, error: 'ENGAGEMENT_NOT_ACTIVE', verdict: outcome.verdict }, { status: 403 });
    case 'not-found':
      return NextResponse.json({ success: false, error: 'not-found' }, { status: 404 });
    default:
      return NextResponse.json({ success: false, error: 'unknown' }, { status: 503 });
  }
}
