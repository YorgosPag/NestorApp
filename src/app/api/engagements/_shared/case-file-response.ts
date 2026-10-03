/**
 * ADR-901 Φ4 · Φ4.4 — η ΜΙΑ μετάφραση «άνοιγμα τεκμηρίου υπόθεσης» → HTTP, για **τις δύο** εισόδους:
 * τον επαγγελματία (`/api/engagements/{id}/files/{fileId}`) και τον οικοδεσπότη (`/api/conveyance-cases/{id}/files/{fileId}`).
 *
 * - αρχείο εκτός των ορατών γραμμών του θεατή ⇒ 404, ίδιο με ανύπαρκτο (Α19 · Α23)
 * - δική μου συμμετοχή χωρίς πρόσβαση τώρα ⇒ 403 με **ονομασμένο** λόγο · «δεν μπόρεσα» ⇒ 503
 *
 * @module api/engagements/_shared/case-file-response
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import type { CaseFileOpening } from '@/services/conveyance/conveyance-case-file-access.service';

const STATUS: Readonly<Record<Exclude<Extract<CaseFileOpening, { ok: false }>['rejection'], 'denied'>, number>> = {
  'not-found': 404,
  unknown: 503,
  failed: 503,
};

export function caseFileResponse(outcome: CaseFileOpening) {
  if (outcome.ok) {
    return apiSuccess({ url: outcome.url, expiresAt: outcome.expiresAt, fileName: outcome.fileName, contentType: outcome.contentType });
  }
  if (outcome.rejection === 'denied') {
    return NextResponse.json({ success: false, error: 'ENGAGEMENT_NOT_ACTIVE', verdict: outcome.verdict }, { status: 403 });
  }
  return NextResponse.json({ success: false, error: outcome.rejection }, { status: STATUS[outcome.rejection] });
}
