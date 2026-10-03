/**
 * ADR-901 Φ4 · Φ4.4 — το ΕΝΑ στήσιμο ενός POST «μέσω της δικής μου συμμετοχής»: τμήματα διαδρομής → σώμα (zod) →
 * ποιος ζητά. Ο handler που επιστρέφεται τυλίγεται από το `withPersonalOrOrgAuth` στο route (σύνορο ιδεμποτίας
 * ADR-872 · ρυθμός ADR-855) — εδώ **μόνο** η μετάφραση αιτήματος → κλήσης υπηρεσίας, ώστε τα routes να μη γίνονται
 * δίδυμα (CHECK 3.28).
 *
 * @module api/engagements/_shared/engagement-post
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import type { z } from 'zod';

import { requireAdminFirestore } from '@/lib/api/admin-db';
import type { ApiActor } from '@/lib/auth/personal-scope-middleware';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { safeParseBody } from '@/lib/validation/shared-schemas';

interface EngagementPostCall<P, S extends z.ZodTypeAny> {
  readonly db: Firestore;
  readonly uid: string;
  readonly email: string | null;
  readonly engagementId: string;
  /** Ένα από τα υπόλοιπα τμήματα της διαδρομής, αποκωδικοποιημένο. */
  readonly param: (name: Exclude<keyof P, 'engagementId'> & string) => string;
  readonly body: z.infer<S>;
}

type Segment<P> = { params: Promise<P & { engagementId: string }> };

export function engagementPost<P extends Record<string, string>, S extends z.ZodTypeAny>(
  schema: S,
  run: (call: EngagementPostCall<P, S>) => Promise<NextResponse>,
) {
  return async (request: NextRequest, actor: ApiActor, segmentData?: Segment<P>): Promise<NextResponse> => {
    const params = await segmentData!.params;
    const parsed = safeParseBody(schema, await request.json());
    if (parsed.error) return parsed.error;
    return run({
      db: requireAdminFirestore(),
      uid: actor.ctx.uid,
      email: actor.ctx.email ?? null,
      engagementId: decodeRouteParam(params.engagementId),
      param: (name) => decodeRouteParam(params[name]),
      body: parsed.data,
    });
  };
}
