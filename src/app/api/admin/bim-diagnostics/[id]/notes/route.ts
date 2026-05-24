/**
 * =============================================================================
 * ADMIN BIM DIAGNOSTICS — INTERNAL NOTES ROUTE (ADR-366 §C.7.Q2)
 * =============================================================================
 *
 * PUT /api/admin/bim-diagnostics/[id]/notes
 *
 * Super-admin internal-notes editor for a performance_diagnostics record.
 * Single editable field (`internalNotes`) — never returned to the submitting
 * user. Each save replaces the field and emits an `internal_note_added`
 * audit entry capturing the before/after diff.
 *
 * @module api/admin/bim-diagnostics/[id]/notes
 * @see ADR-366 §C.7.Q2
 * @see ADR-195 — Entity Audit Trail
 * @rateLimit STANDARD (60 req/min)
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedHandler } from '@/lib/auth/middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import type { PerformanceDiagnostic } from '@/types/performance-diagnostic';

const logger = createModuleLogger('ADMIN_BIM_DIAGNOSTICS_NOTES');

const MAX_NOTE_LENGTH = 4000;

interface PutBody {
  note: string;
}

interface PutResponse {
  id: string;
  internalNotes: string | null;
}

interface ErrorBody {
  error: string;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateBody(raw: unknown): { ok: true; body: PutBody } | { ok: false; reason: string } {
  if (!isPlainObject(raw)) return { ok: false, reason: 'Body must be a JSON object' };
  const { note } = raw as Record<string, unknown>;
  if (typeof note !== 'string') return { ok: false, reason: 'note must be string' };
  if (note.length > MAX_NOTE_LENGTH) return { ok: false, reason: 'note too long' };
  return { ok: true, body: { note } };
}

const handlePut: AuthenticatedHandler<PutResponse | ErrorBody, RouteContext> = async (
  request,
  ctx,
  _cache,
  routeContext,
) => {
  if (ctx.globalRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: super-admin only' }, { status: 403 });
  }

  const params = await routeContext?.params;
  const diagId = params?.id;
  if (!diagId) {
    return NextResponse.json({ error: 'Missing diagnostic id' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateBody(raw);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const newNote = validation.body.note;
  const newNoteValue: string | null = newNote.length === 0 ? null : newNote;

  try {
    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.PERFORMANCE_DIAGNOSTICS).doc(diagId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const data = snap.data() as Partial<PerformanceDiagnostic> | undefined;
      if (!data) throw new Error('NOT_FOUND');

      const previousNote: string | null = data.internalNotes ?? null;
      const companyId = typeof data.companyId === 'string' ? data.companyId : '';

      if (previousNote === newNoteValue) {
        return { previousNote, newNote: newNoteValue, companyId, changed: false };
      }

      tx.update(docRef, { internalNotes: newNoteValue });
      return { previousNote, newNote: newNoteValue, companyId, changed: true };
    });

    if (result.changed) {
      await EntityAuditService.recordChange({
        entityType: 'performance_diagnostic',
        entityId: diagId,
        entityName: null,
        action: 'internal_note_added',
        changes: [{ field: 'internalNotes', oldValue: result.previousNote, newValue: result.newNote }],
        performedBy: ctx.uid,
        performedByName: ctx.email ?? null,
        companyId: result.companyId,
      });
    }

    return NextResponse.json({ id: diagId, internalNotes: result.newNote });
  } catch (err) {
    const msg = getErrorMessage(err);
    if (msg === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Diagnostic not found' }, { status: 404 });
    }
    logger.error('PUT bim-diagnostics notes failed', { diagId, error: msg });
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }
};

export const PUT = withStandardRateLimit(
  withAuth(handlePut as AuthenticatedHandler<PutResponse | ErrorBody>),
);
