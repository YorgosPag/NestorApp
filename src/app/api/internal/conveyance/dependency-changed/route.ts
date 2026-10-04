/**
 * POST /api/internal/conveyance/dependency-changed — ADR-905 §6 (Στάδιο 3, CDC).
 *
 * Καλείται **μόνο** από το Cloud Function `onConveyanceDependencyWrite`, υπογεγραμμένα. Λεπτό: η πόρτα κρίνει
 * υπογραφή + ιδεμποτία, η υπηρεσία κρίνει ποιες όψεις άλλαξαν και ζητά σήμα από τον ΕΝΑ γραφέα.
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { parseDependencyChangeEvent } from '@/lib/conveyance/dependency-change-event';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import { withSignedInternalWebhook } from '@/server/internal-webhooks/signed-webhook-door';
import { relayDependencyChange } from '@/services/conveyance/conveyance-dependency-relay.server';

export const dynamic = 'force-dynamic';

async function handleDependencyChange(body: unknown): Promise<NextResponse> {
  const event = parseDependencyChangeEvent(body);
  if (!event) return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400 });
  const outcome = await relayDependencyChange(getAdminFirestore(), event);
  return NextResponse.json({ ok: true, ...outcome });
}

export const POST = withWebhookRateLimit(withSignedInternalWebhook({ source: 'conveyance-dependency' }, handleDependencyChange));
