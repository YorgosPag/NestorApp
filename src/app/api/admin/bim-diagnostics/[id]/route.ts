/**
 * =============================================================================
 * ADMIN BIM DIAGNOSTICS — TRIAGE PATCH ROUTE (ADR-366 §C.7.Q2)
 * =============================================================================
 *
 * PATCH /api/admin/bim-diagnostics/[id]
 *
 * Super-admin triage actions on a performance_diagnostics record:
 *   • status transition (validated against the FSM in triage-fsm.ts)
 *   • assignee change (assignedSuperAdminId, nullable to unassign)
 *
 * Atomic Firestore transaction so a combined status+assignee PATCH writes
 * exactly once with a single triageHistory append per status transition.
 * Audit trail (ADR-195) records one EntityAuditService entry per affected
 * field — `triage_status_changed` and/or `triage_assigned`.
 *
 * @module api/admin/bim-diagnostics/[id]
 * @see ADR-366 §C.7.Q2 — Admin Diagnostics Dashboard
 * @see ADR-195 — Entity Audit Trail
 * @rateLimit STANDARD (60 req/min)
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { withAuth, type AuthenticatedHandler } from '@/lib/auth/middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { canTransition, TRIAGE_STATUSES } from '@/app/admin/bim-diagnostics/lib/triage-fsm';
import type {
  PerformanceDiagnostic,
  TriageHistoryEntry,
  TriageStatus,
} from '@/types/performance-diagnostic';

const logger = createModuleLogger('ADMIN_BIM_DIAGNOSTICS_PATCH');

// ============================================================================
// TYPES
// ============================================================================

interface PatchBody {
  /** Target status (omit to skip status change). */
  status?: TriageStatus;
  /** Note attached to the status transition (only used when `status` set). */
  transitionNote?: string;
  /** New assignee UID, or null to clear. Omit to skip assignee change. */
  assignedSuperAdminId?: string | null;
}

interface PatchResponse {
  id: string;
  status: TriageStatus;
  assignedSuperAdminId: string | null;
  triageHistory: TriageHistoryEntry[];
}

interface ErrorBody {
  error: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isTriageStatus(v: unknown): v is TriageStatus {
  return typeof v === 'string' && (TRIAGE_STATUSES as ReadonlyArray<string>).includes(v);
}

function validateBody(raw: unknown): { ok: true; body: PatchBody } | { ok: false; reason: string } {
  if (!isPlainObject(raw)) return { ok: false, reason: 'Body must be a JSON object' };
  const { status, transitionNote, assignedSuperAdminId } = raw as Record<string, unknown>;

  const body: PatchBody = {};

  if (status !== undefined) {
    if (!isTriageStatus(status)) return { ok: false, reason: 'Invalid status' };
    body.status = status;
  }

  if (transitionNote !== undefined) {
    if (typeof transitionNote !== 'string') return { ok: false, reason: 'transitionNote must be string' };
    if (transitionNote.length > 2000) return { ok: false, reason: 'transitionNote too long' };
    body.transitionNote = transitionNote;
  }

  if (assignedSuperAdminId !== undefined) {
    if (assignedSuperAdminId !== null && typeof assignedSuperAdminId !== 'string') {
      return { ok: false, reason: 'assignedSuperAdminId must be string|null' };
    }
    body.assignedSuperAdminId = assignedSuperAdminId;
  }

  if (body.status === undefined && body.assignedSuperAdminId === undefined) {
    return { ok: false, reason: 'Body must include at least one of: status, assignedSuperAdminId' };
  }

  return { ok: true, body };
}

// ============================================================================
// HANDLER
// ============================================================================

interface RouteContext {
  params: Promise<{ id: string }>;
}

const handlePatch: AuthenticatedHandler<PatchResponse | ErrorBody, RouteContext> = async (
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

  const { status: targetStatus, transitionNote, assignedSuperAdminId: targetAssignee } = validation.body;
  const performerUid = ctx.uid;

  try {
    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.PERFORMANCE_DIAGNOSTICS).doc(diagId);

    interface TransactionResult {
      previousStatus: TriageStatus;
      previousAssignee: string | null;
      newStatus: TriageStatus;
      newAssignee: string | null;
      newHistory: TriageHistoryEntry[];
      companyId: string;
      statusChanged: boolean;
      assigneeChanged: boolean;
    }

    const result = await db.runTransaction<TransactionResult>(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) {
        throw new Error('NOT_FOUND');
      }
      const data = snap.data() as Partial<PerformanceDiagnostic> | undefined;
      if (!data) throw new Error('NOT_FOUND');

      const previousStatus: TriageStatus = (data.status as TriageStatus | undefined) ?? 'new';
      const previousAssignee: string | null = data.assignedSuperAdminId ?? null;
      const previousHistory: TriageHistoryEntry[] = Array.isArray(data.triageHistory)
        ? (data.triageHistory as TriageHistoryEntry[])
        : [];
      const companyId = typeof data.companyId === 'string' ? data.companyId : '';

      let newStatus = previousStatus;
      let newHistory = previousHistory;
      let statusChanged = false;

      if (targetStatus !== undefined && targetStatus !== previousStatus) {
        if (!canTransition(previousStatus, targetStatus)) {
          throw new Error('INVALID_TRANSITION');
        }
        newStatus = targetStatus;
        statusChanged = true;
        const historyEntry: TriageHistoryEntry = {
          from: previousStatus,
          to: targetStatus,
          by: performerUid,
          at: nowISO(),
          ...(transitionNote ? { note: transitionNote } : {}),
        };
        newHistory = [...previousHistory, historyEntry];
      }

      let newAssignee = previousAssignee;
      let assigneeChanged = false;
      if (targetAssignee !== undefined && targetAssignee !== previousAssignee) {
        newAssignee = targetAssignee;
        assigneeChanged = true;
      }

      if (!statusChanged && !assigneeChanged) {
        return {
          previousStatus,
          previousAssignee,
          newStatus,
          newAssignee,
          newHistory,
          companyId,
          statusChanged: false,
          assigneeChanged: false,
        };
      }

      const update: Record<string, unknown> = {};
      if (statusChanged) {
        update.status = newStatus;
        update.triageHistory = newHistory;
      }
      if (assigneeChanged) {
        update.assignedSuperAdminId = newAssignee;
      }
      tx.update(docRef, update);

      return {
        previousStatus,
        previousAssignee,
        newStatus,
        newAssignee,
        newHistory,
        companyId,
        statusChanged,
        assigneeChanged,
      };
    });

    if (result.statusChanged) {
      await EntityAuditService.recordChange({
        entityType: 'performance_diagnostic',
        entityId: diagId,
        entityName: null,
        action: 'triage_status_changed',
        changes: [{ field: 'status', oldValue: result.previousStatus, newValue: result.newStatus }],
        performedBy: performerUid,
        performedByName: ctx.email ?? null,
        companyId: result.companyId,
      });
    }

    if (result.assigneeChanged) {
      await EntityAuditService.recordChange({
        entityType: 'performance_diagnostic',
        entityId: diagId,
        entityName: null,
        action: 'triage_assigned',
        changes: [{ field: 'assignedSuperAdminId', oldValue: result.previousAssignee, newValue: result.newAssignee }],
        performedBy: performerUid,
        performedByName: ctx.email ?? null,
        companyId: result.companyId,
      });
    }

    return NextResponse.json({
      id: diagId,
      status: result.newStatus,
      assignedSuperAdminId: result.newAssignee,
      triageHistory: result.newHistory,
    });
  } catch (err) {
    const msg = getErrorMessage(err);
    if (msg === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Diagnostic not found' }, { status: 404 });
    }
    if (msg === 'INVALID_TRANSITION') {
      return NextResponse.json({ error: 'Invalid triage transition' }, { status: 409 });
    }
    logger.error('PATCH bim-diagnostics failed', { diagId, error: msg });
    return NextResponse.json({ error: 'Failed to update diagnostic' }, { status: 500 });
  }
};

export const PATCH = withStandardRateLimit(
  withAuth(handlePatch as AuthenticatedHandler<PatchResponse | ErrorBody>),
);
