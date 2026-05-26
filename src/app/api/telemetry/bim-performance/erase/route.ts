/**
 * =============================================================================
 * TELEMETRY ERASURE — ADR-366 §C.7.Q3 (GDPR Article 17)
 * =============================================================================
 *
 * POST /api/telemetry/bim-performance/erase
 *
 * Right-to-erasure endpoint. Deletes every `bim_performance_telemetry` doc
 * tied to the caller's `session_id`.
 *
 * Ownership proof: the session_id is `SHA-256(daily_salt + userId)` where
 * `daily_salt` only lives client-side in LocalStorage. Possession of the
 * matching salt + userId is the implicit proof — replay attacks are
 * bounded by the rate limiter (HEAVY tier, 10/min/session).
 *
 * Audit: one `EntityAuditService.recordChange({ action: 'erased' })` entry
 * per call (with the redacted batch count, no userId leaked).
 *
 * @module api/telemetry/bim-performance/erase
 * @see ADR-366 §C.7.Q3 (Article 17 obligations)
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EntityAuditService } from '@/services/entity-audit.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('BIM_TELEMETRY_ERASE');

const SESSION_HEADER = 'x-bim-session-id';
const SESSION_ID_REGEX = /^[a-f0-9]{64}$/;
const DELETE_PAGE_SIZE = 200;

interface EraseBody {
  sessionId: string;
}

interface EraseResponse {
  deleted: number;
}

interface ErrorBody {
  error: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Page through and delete every telemetry doc for the session. Returns
 * the total count actually removed.
 */
async function deleteAllForSession(sessionId: string): Promise<number> {
  const db = getAdminFirestore();
  const col = db.collection(COLLECTIONS.BIM_PERFORMANCE_TELEMETRY);
  let total = 0;
  while (true) {
    const snap = await col
      .where('sessionId', '==', sessionId)
      .limit(DELETE_PAGE_SIZE)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    total += snap.size;
    if (snap.size < DELETE_PAGE_SIZE) break;
  }
  return total;
}

async function handlePost(request: NextRequest): Promise<NextResponse<EraseResponse | ErrorBody>> {
  const headerSession = request.headers.get(SESSION_HEADER);
  if (!headerSession || !SESSION_ID_REGEX.test(headerSession)) {
    return NextResponse.json({ error: 'Missing or malformed session id' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isPlainObject(raw) || (raw as unknown as EraseBody).sessionId !== headerSession) {
    return NextResponse.json({ error: 'Session id mismatch' }, { status: 400 });
  }

  try {
    const deleted = await deleteAllForSession(headerSession);

    // Audit. companyId is not available (anonymous endpoint); use a stable
    // sentinel so the audit trail row still satisfies tenant-required reads.
    await EntityAuditService.recordChange({
      entityType: 'performance_telemetry',
      entityId: headerSession,
      entityName: `telemetry session (${deleted} samples)`,
      action: 'erased',
      changes: [],
      performedBy: 'anonymous',
      performedByName: null,
      companyId: 'system',
    });

    return NextResponse.json({ deleted });
  } catch (err) {
    logger.error('Telemetry erase failed', {
      sessionId: headerSession,
      error: getErrorMessage(err),
    });
    return NextResponse.json({ error: 'Failed to erase telemetry' }, { status: 500 });
  }
}

export const POST = withRateLimit(handlePost, {
  category: 'HEAVY',
  getKey: (req) => {
    const sid = req.headers.get(SESSION_HEADER);
    return sid && SESSION_ID_REGEX.test(sid) ? `telemetry-erase:${sid}` : null;
  },
});
