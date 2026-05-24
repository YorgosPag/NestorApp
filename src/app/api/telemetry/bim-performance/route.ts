/**
 * =============================================================================
 * ANONYMOUS BIM PERFORMANCE TELEMETRY — ADR-366 §C.7.Q3
 * =============================================================================
 *
 * POST /api/telemetry/bim-performance
 *
 * Accepts a batch of GDPR-anonymized performance samples from the BIM 3D
 * viewer. No authentication — telemetry is fully anonymous; the only
 * identifier is the client-derived `session_id` (SHA-256 over a daily-rotated
 * device-local salt + userId). The server never sees the userId or salt.
 *
 * Rate limit: keyed on `x-bim-session-id` header (not companyId:userId).
 * Standard tier (60/min); a misbehaving session is bounded without blocking
 * the whole anonymous pool. Q3 decision document target was 1/min/session,
 * matched effectively by client-side 5-min flush cadence.
 *
 * Storage: top-level `bim_performance_telemetry` collection. No companyId
 * field, no projectId, no userId. 30-day TTL on `createdAt` (TODO: Firestore
 * TTL policy or nightly Cloud Function — deferred to Phase 3 Group D).
 *
 * @module api/telemetry/bim-performance
 * @see ADR-366 §C.7.Q3 (telemetry pipeline + GDPR contract)
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateBimTelemetryId } from '@/services/enterprise-id.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { FieldValue } from 'firebase-admin/firestore';

const logger = createModuleLogger('BIM_TELEMETRY_INGEST');

const SESSION_HEADER = 'x-bim-session-id';
const MAX_BATCH_SIZE = 20;
const SESSION_ID_REGEX = /^[a-f0-9]{64}$/;

// ============================================================================
// TYPES
// ============================================================================

interface TelemetrySample {
  sessionId: string;
  timestamp: number;
  renderMode: string;
  browser: { family: string; major: number | null };
  os: { family: string };
  gpuTier: number | null;
  metrics: Record<string, number | null>;
}

interface IngestBody {
  samples: TelemetrySample[];
}

interface IngestResponse {
  written: number;
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

function validateSample(raw: unknown, sessionId: string): TelemetrySample | null {
  if (!isPlainObject(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.sessionId !== sessionId) return null;
  if (typeof r.timestamp !== 'number') return null;
  if (typeof r.renderMode !== 'string') return null;
  if (!isPlainObject(r.browser) || !isPlainObject(r.os)) return null;
  if (!isPlainObject(r.metrics)) return null;
  return r as unknown as TelemetrySample;
}

function validateBody(raw: unknown, sessionId: string): TelemetrySample[] | null {
  if (!isPlainObject(raw)) return null;
  const samples = (raw as IngestBody).samples;
  if (!Array.isArray(samples) || samples.length === 0 || samples.length > MAX_BATCH_SIZE) {
    return null;
  }
  const validated: TelemetrySample[] = [];
  for (const s of samples) {
    const ok = validateSample(s, sessionId);
    if (!ok) return null;
    validated.push(ok);
  }
  return validated;
}

// ============================================================================
// HANDLER
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse<IngestResponse | ErrorBody>> {
  const sessionId = request.headers.get(SESSION_HEADER);
  if (!sessionId || !SESSION_ID_REGEX.test(sessionId)) {
    return NextResponse.json({ error: 'Missing or malformed session id' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const samples = validateBody(raw, sessionId);
  if (!samples) {
    return NextResponse.json({ error: 'Invalid sample batch' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const batch = db.batch();
    const col = db.collection(COLLECTIONS.BIM_PERFORMANCE_TELEMETRY);
    for (const sample of samples) {
      const docId = generateBimTelemetryId();
      batch.set(col.doc(docId), {
        id: docId,
        sessionId: sample.sessionId,
        timestamp: sample.timestamp,
        renderMode: sample.renderMode,
        browser: sample.browser,
        os: sample.os,
        gpuTier: sample.gpuTier,
        metrics: sample.metrics,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    return NextResponse.json({ written: samples.length });
  } catch (err) {
    logger.error('Telemetry ingest failed', {
      sessionId,
      batchSize: samples.length,
      error: getErrorMessage(err),
    });
    return NextResponse.json({ error: 'Failed to persist telemetry' }, { status: 500 });
  }
}

// Custom getKey so the rate limiter keys on the anonymous session id instead
// of the absent auth context (would otherwise fall back to hashed IP and
// share buckets across all anonymous traffic).
export const POST = withRateLimit(handlePost, {
  category: 'STANDARD',
  getKey: (req) => {
    const sid = req.headers.get(SESSION_HEADER);
    return sid && SESSION_ID_REGEX.test(sid) ? `telemetry:${sid}` : null;
  },
});
