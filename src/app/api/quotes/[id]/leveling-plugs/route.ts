/**
 * PUT /api/quotes/[id]/leveling-plugs — ο PM ορίζει (`amount`) ή αφαιρεί (`amount: null`) την κάλυψη ενός κενού
 * της προσφοράς σε μια γραμμή RFQ (ADR-327 §8.5 — BuildingConnected «plug»). Ιδεμποτικό.
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §8.5
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { quoteIdRoute, quoteBadRequest } from '@/app/api/quotes/_shared/quote-id-route';
import { setQuoteLevelingPlug } from '@/subapps/procurement/services/quote-leveling-plug-service';

/** Ανώτατο ποσό: ίδιο σύνορο με τις τιμές γραμμών (καθαρό ποσό σε €). */
const PLUG_AMOUNT_MAX = 1_000_000_000;

const LevelingPlugSchema = z.object({
  rfqLineId: z.string().min(1).max(200),
  amount: z.number().finite().min(0).max(PLUG_AMOUNT_MAX).nullable(),
  note: z.string().max(500).nullable().default(null),
}).strict();

const handlePut = quoteIdRoute(async (req, ctx, id) => {
  try {
    const parsed = safeParseBody(LevelingPlugSchema, await req.json());
    if (parsed.error) return parsed.error;
    const plugs = await setQuoteLevelingPlug(ctx, id, parsed.data);
    return NextResponse.json({ success: true, data: plugs });
  } catch (error) {
    return quoteBadRequest(error);
  }
});

export const PUT = withSensitiveRateLimit(handlePut);
