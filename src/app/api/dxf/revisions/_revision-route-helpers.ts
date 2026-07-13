/**
 * ADR-651 Φάση Η — κοινό wire parsing των δύο routes της αναθεώρησης (SSoT, N.18).
 *
 * Και τα δύο (`POST /api/dxf/revisions` = καταχώρηση, `POST /api/dxf/text-templates/ai/
 * revision-changelog` = «τι άλλαξε») δέχονται το ΙΔΙΟ untrusted ζεύγος `{ projectId, snapshot }`
 * και απορρίπτουν με τον ΙΔΙΟ τρόπο. Ζει εδώ μία φορά — το `jscpd:diff` έπιασε το δίδυμο και
 * εξήχθη (ακριβώς όπως το `_ai-route-helpers.ts` της Φάσης Δ).
 */
import { NextResponse } from 'next/server';
import type { RevisionSnapshot } from '@/subapps/dxf-viewer/text-engine/title-block/revisions/revision.types';

export interface RevisionRequestBody {
  readonly projectId?: unknown;
  readonly snapshot?: unknown;
  readonly description?: unknown;
  readonly locale?: unknown;
}

export interface RevisionRequest {
  readonly projectId: string;
  readonly snapshot: RevisionSnapshot;
}

/** Έγκυρο ζεύγος έργου + αποτυπώματος, ή `null` (⇒ 400). Το `digest` είναι το κλειδί ταυτότητας. */
export function readRevisionRequest(body: RevisionRequestBody): RevisionRequest | null {
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  const snapshot = body.snapshot as RevisionSnapshot | undefined;
  if (!projectId || !snapshot?.digest) return null;
  return { projectId, snapshot };
}

/** Η κοινή απόρριψη κακοσχηματισμένου αιτήματος. */
export function invalidRevisionRequest(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'projectId and snapshot are required', code: 'INVALID_INPUT' },
    { status: 400 },
  );
}
