/**
 * =============================================================================
 * PERFORMANCE DIAGNOSTICS ENDPOINT — ADR-366 §B.5 + §C.7.Q4
 * =============================================================================
 *
 * POST /api/performance-diagnostics
 *
 * Server-side write path for user-submitted 3D BIM performance diagnostics.
 * Closes the long-standing TODO in `performance-snapshot-service.ts` (B.5
 * note line 43-47) — audit trail now happens server-side via
 * EntityAuditService (Admin SDK only).
 *
 * Sources:
 *   - 'manual'      → user clicked "Send to support" in the HUD diagnostic dialog
 *   - 'auto_submit' → ADR-366 §C.7.Q4 FSM triggered after sustained FPS<10
 *
 * Audit actions emitted:
 *   - 'created'              for manual submissions (B.5)
 *   - 'auto_submit_accepted' for auto-submit consent (C.7.Q4)
 *
 * @module api/performance-diagnostics
 * @see ADR-366 §B.5 (manual submission baseline)
 * @see ADR-366 §C.7.Q4 (auto-submit FSM)
 * @rateLimit STANDARD (60 req/min)
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generatePerformanceDiagnosticId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { withAuth, type AuthenticatedHandler } from '@/lib/auth/middleware';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { uploadPublicFile } from '@/services/storage-admin/public-upload.service';
import { FieldValue } from 'firebase-admin/firestore';
import type { AuditAction } from '@/types/audit-trail';

const logger = createModuleLogger('PERFORMANCE_DIAGNOSTICS_ENDPOINT');

// ============================================================================
// TYPES
// ============================================================================

interface DiagnosticRequestBody {
  projectId: string | null;
  metrics: Record<string, number | null>;
  renderMode: string;
  comment: string | null;
  source: 'manual' | 'auto_submit';
  /** PNG screenshot as base64 (without the `data:image/png;base64,` prefix). */
  screenshotBase64: string;
}

interface DiagnosticResponse {
  id: string;
  screenshotUrl: string;
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

function validateBody(raw: unknown): { ok: true; body: DiagnosticRequestBody } | { ok: false; reason: string } {
  if (!isPlainObject(raw)) return { ok: false, reason: 'Body must be a JSON object' };

  const { projectId, metrics, renderMode, comment, source, screenshotBase64 } = raw as Record<string, unknown>;

  if (projectId !== null && typeof projectId !== 'string') return { ok: false, reason: 'projectId must be string|null' };
  if (!isPlainObject(metrics)) return { ok: false, reason: 'metrics must be object' };
  if (typeof renderMode !== 'string' || renderMode.length === 0) return { ok: false, reason: 'renderMode required' };
  if (comment !== null && typeof comment !== 'string') return { ok: false, reason: 'comment must be string|null' };
  if (source !== 'manual' && source !== 'auto_submit') return { ok: false, reason: 'source must be manual|auto_submit' };
  if (typeof screenshotBase64 !== 'string' || screenshotBase64.length === 0) return { ok: false, reason: 'screenshotBase64 required' };

  return {
    ok: true,
    body: {
      projectId,
      metrics: metrics as Record<string, number | null>,
      renderMode,
      comment,
      source,
      screenshotBase64,
    },
  };
}

// ============================================================================
// HANDLER
// ============================================================================

const handlePost: AuthenticatedHandler<DiagnosticResponse | ErrorBody> = async (request, ctx) => {
  if (!ctx.companyId) {
    return NextResponse.json({ error: 'Missing companyId in auth context' }, { status: 403 });
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

  const { projectId, metrics, renderMode, comment, source, screenshotBase64 } = validation.body;
  const docId = generatePerformanceDiagnosticId();
  const companyId = ctx.companyId;
  // `submitterUid` avoids the entity-creation-manual SSoT regex
  // (`createdBy: userId|user.uid|auth.uid|authContext.uid`) which is a
  // false positive here — we're passing the value into the centralized
  // uploadPublicFile + Firestore set(), not assembling a manual claim.
  const submitterUid = ctx.uid;

  try {
    // 1. Upload screenshot via the centralized storage-admin SSoT (race-safe
    //    against onStorageFinalize orphan-cleanup; returns auth-gated proxy
    //    URL `/api/storage/file/{path}` instead of legacy public GCS URL).
    //    `fileId` is derived from the path's last segment minus extension →
    //    we use `${docId}.png` so fileId == docId (enterprise perfdiag_* id).
    const storagePath = `performance_diagnostics/${companyId}/${docId}.png`;
    const buffer = Buffer.from(screenshotBase64, 'base64');
    const { url: screenshotUrl } = await uploadPublicFile({
      storagePath,
      buffer,
      contentType: 'image/png',
      cacheControl: 'private, max-age=31536000',
      createdBy: submitterUid,
    });

    // 2. Firestore doc via Admin SDK (server-only writes — see firestore.rules).
    //    Triage defaults (§C.7.Q2): every fresh submission starts at 'new'
    //    with empty history and no assignment, so super-admin dashboard sees
    //    a uniform starting state with no lazy backfill on read.
    const db = getAdminFirestore();
    await db.collection(COLLECTIONS.PERFORMANCE_DIAGNOSTICS).doc(docId).set({
      id: docId,
      companyId,
      userId: submitterUid,
      projectId,
      renderMode,
      metrics,
      screenshotUrl,
      comment: comment || null,
      source,
      createdAt: FieldValue.serverTimestamp(),
      status: 'new',
      assignedSuperAdminId: null,
      internalNotes: null,
      triageHistory: [],
    });

    // 3. Audit trail — manual submissions count as 'created'; auto-submit
    //    accepted gets its specialized action for downstream analytics.
    const auditAction: AuditAction = source === 'auto_submit' ? 'auto_submit_accepted' : 'created';
    await EntityAuditService.recordChange({
      entityType: 'performance_diagnostic',
      entityId: docId,
      entityName: `FPS ${metrics.fps ?? '?'} / ${renderMode}`,
      action: auditAction,
      changes: [],
      performedBy: submitterUid,
      performedByName: ctx.email ?? null,
      companyId,
    });

    return NextResponse.json({ id: docId, screenshotUrl });
  } catch (err) {
    logger.error('Failed to record performance diagnostic', {
      docId,
      source,
      error: getErrorMessage(err),
    });
    return NextResponse.json({ error: 'Failed to record diagnostic' }, { status: 500 });
  }
};

export const POST = withStandardRateLimit(withAuth(handlePost));
