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
import { isPlainRecord } from '@/lib/type-guards';
import { readSessionRequest, sessionRateLimitKey } from '../_session-request';

const logger = createModuleLogger('BIM_TELEMETRY_ERASE');

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

/**
 * Page through and delete every telemetry doc for the session. Returns
 * the total count actually removed.
 */
async function deleteAllForSession(sessionId: string): Promise<number> {
  const db = getAdminFirestore();
  // tenant-scope-exempt: **ανώνυμο** endpoint διαγραφής (GDPR) — δεν υπάρχει συνδεδεμένος
  // χρήστης, άρα δεν υπάρχει μισθωτής να φιλτραριστεί. Ο άξονας απομόνωσης είναι το
  // `sessionId`, που ο καλών πρέπει να **κατέχει** και το οποίο επαληθεύεται δύο φορές
  // (κεφαλίδα ⟷ σώμα) πριν φτάσει εδώ. ⚠️ **Η ΣΥΝΘΗΚΗ**: το μόνο που επιτρέπει ένα
  // μαντεμένο `sessionId` είναι **διαγραφή** ξένης τηλεμετρίας — μη αυθεντικών δεδομένων
  // απόδοσης, και προς την κατεύθυνση της ιδιωτικότητας. Αν αυτή η συλλογή αποκτήσει ποτέ
  // δεδομένα που κάποιος θα ήθελε να **διαβάσει**, η εξαίρεση παύει να ισχύει.
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
  const preamble = await readSessionRequest(request);
  if (!preamble.ok) {
    return preamble.response;
  }
  const { sessionId: headerSession, raw } = preamble;

  if (!isPlainRecord(raw) || (raw as unknown as EraseBody).sessionId !== headerSession) {
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
  getKey: sessionRateLimitKey('telemetry-erase'),
});
