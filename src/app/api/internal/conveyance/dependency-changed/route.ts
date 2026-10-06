/**
 * POST /api/internal/conveyance/dependency-changed — ADR-905 §6 (Στάδιο 3, CDC).
 *
 * Καλείται **μόνο** από τα Cloud Functions `onConveyance{File,Property,Project}Write`, υπογεγραμμένα. Λεπτό: η πόρτα κρίνει
 * υπογραφή + ιδεμποτία, η υπηρεσία κρίνει ποιες όψεις άλλαξαν και ζητά σήμα από τον ΕΝΑ γραφέα.
 *
 * Ρυθμός (§8 Ε3) — δύο κάδοι: ανάχωμα ανά IP **πριν** την υπογραφή (`INTERNAL_WEBHOOK`) · προϋπολογισμός ανά **πηγή**
 * **μετά** την υπογραφή (`INTERNAL_WEBHOOK_SOURCE_QUOTA`, μέσα στην πόρτα).
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { parseDependencyChangeEvent } from '@/lib/conveyance/dependency-change-event';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { INTERNAL_WEBHOOK_SOURCE_QUOTA } from '@/lib/middleware/rate-limit-config';
import { withInternalWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import { withSignedInternalWebhook } from '@/server/internal-webhooks/signed-webhook-door';
import { relayDependencyChange } from '@/services/conveyance/conveyance-dependency-relay.server';

export const dynamic = 'force-dynamic';

async function handleDependencyChange(body: unknown): Promise<NextResponse> {
  const event = parseDependencyChangeEvent(body);
  if (!event) return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400 });
  const outcome = await relayDependencyChange(getAdminFirestore(), event);
  return NextResponse.json({ ok: true, ...outcome });
}

export const POST = withInternalWebhookRateLimit(
  withSignedInternalWebhook({ source: 'conveyance-dependency', quota: INTERNAL_WEBHOOK_SOURCE_QUOTA }, handleDependencyChange),
);
