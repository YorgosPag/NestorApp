/**
 * @fileoverview **Η απάντηση μιας πράξης που μπορεί να αρνηθεί** (ADR-923 §5.13 · §16): κοινή για τα routes επιβεβαίωσης και μάρκας.
 * @related lib/api/json-body.ts (η γενική ανάγνωση σώματος) · server/catalog/supplier-review.server.ts · supplier-brand-claim.server.ts
 * @module lib/api/refusable-outcome-route
 *
 * 🔑 Άρνηση του κανόνα ⇒ 409 με τον λόγο της. Βλάβη ⇒ 503 και log: «δεν μπόρεσα» δεν είναι ποτέ «όχι».
 * ⚠️ Κρατά το υπάρχον συμβόλαιο `MALFORMED`. Το `readJsonBody` απαντά `MALFORMED_BODY` με πεδία, άρα η μετάβαση είναι χωριστή απόφαση.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';

import type { AuthContext } from '@/lib/auth';

interface RouteLogger {
  readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
}

export interface UnavailableBody {
  readonly error: 'UNAVAILABLE';
}

export function refusableOutcomeResponse<TOutcome extends { readonly kind: string }>(outcome: TOutcome, headers?: HeadersInit): NextResponse<TOutcome> {
  return NextResponse.json(outcome, { status: outcome.kind === 'refused' ? 409 : 200, headers });
}

/** Τρέχει τη δουλειά ενός route: ό,τι ρίξει γίνεται 503 με γραμμή στο log, και η λεπτομέρεια δεν φεύγει στον πελάτη. */
export async function orRouteUnavailable<TBody>(logger: RouteLogger, message: string, work: () => Promise<NextResponse<TBody>>): Promise<NextResponse<TBody | UnavailableBody>> {
  try {
    return await work();
  } catch (error) {
    logger.error(message, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

/** Ο οργανισμός έρχεται από το `ctx.companyId`, ποτέ από το σώμα. Κενό ⇒ 403. */
export function routeOrganizationOf(ctx: AuthContext): string | NextResponse<{ readonly error: 'NO_ORGANIZATION' }> {
  const companyId = ctx.companyId?.trim() ?? '';
  return companyId === '' ? NextResponse.json({ error: 'NO_ORGANIZATION' }, { status: 403 }) : companyId;
}

/** Το σώμα κατά το σχήμα, ή 400 `MALFORMED`. */
export async function parsedRouteBody<TSchema extends z.ZodTypeAny>(request: NextRequest, schema: TSchema): Promise<z.infer<TSchema> | NextResponse<{ readonly error: 'MALFORMED' }>> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  return parsed.success ? parsed.data : NextResponse.json({ error: 'MALFORMED' }, { status: 400 });
}
