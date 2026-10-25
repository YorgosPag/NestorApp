/**
 * Τα **factories** των routes του σχήματος καταλόγου (ADR-923 §5.9) — ένα σύνορο για όλα:
 *
 * - `defineRoute` ⇒ `withAuth` ⇒ **ιδεμποτία** (CHECK 3.92) · zod σώμα.
 * - Η βαθμίδα ορίου ρυθμού **δηλώνεται στο ίδιο το `route.ts`** (`{ category: 'STANDARD' }`, CHECK 3.78):
 *   ο αναγνώστης της διαδρομής βλέπει ποιο όριο ισχύει χωρίς να ανοίξει το factory.
 * - Δικαίωμα **`catalog:schema:manage`** σε κάθε εγγραφή (ADR-923 §5.1).
 * - `CatalogWriteError` ⇒ `ApiError` σε **ένα** σημείο (`toCatalogApiError`): ίδιο λάθος, ίδιος κωδικός, παντού.
 *
 * Οι αναγνώσεις **δεν** περνούν από εδώ: ο πελάτης διαβάζει απευθείας τη Firestore (κανόνες:
 * `isInternalUserOfCompany`), όπως κάθε άλλη λίστα της εφαρμογής.
 * @module app/api/catalog/_shared/catalog-route
 */

import 'server-only';

import type { NextResponse } from 'next/server';
import type { z } from 'zod';

import { badRequest, created, defineRoute, ok, type RateLimitTier } from '@/lib/api/define-route';
import type { AuthContext } from '@/lib/auth';
import type { RateLimitCategory } from '@/lib/middleware/rate-limit-config';
import { CatalogWriteError, toCatalogApiError } from '@/server/catalog/catalog-write-error';
import { EXPECTED_REVISION_PARAM } from '@/subapps/catalog/catalog-routes';
import { expectedRevisionSchema } from '@/subapps/catalog/schema/zod/common.schema';

/** Οι βαθμίδες που έχουν νόημα για εγγραφές σχήματος — ρητή δήλωση ανά διαδρομή. */
type CatalogRateCategory = Extract<RateLimitCategory, 'STANDARD' | 'SENSITIVE'>;

export interface CatalogRoutePolicy {
  readonly category: CatalogRateCategory;
}

const TIER_OF: Readonly<Record<CatalogRateCategory, RateLimitTier>> = { STANDARD: 'standard', SENSITIVE: 'sensitive' };
const MANAGE = { permissions: 'catalog:schema:manage' } as const;
const FALLBACK_ERROR = 'Catalog schema write failed';

type IdParams = { id: string };

async function respond<T>(envelope: (data: T) => NextResponse, run: () => Promise<T>): Promise<NextResponse> {
  try {
    return envelope(await run());
  } catch (error) {
    if (error instanceof CatalogWriteError) throw toCatalogApiError(error);
    throw error;
  }
}

/** `POST /api/catalog/<συλλογή>` — δημιουργία. */
export function catalogCreateRoute<TSchema extends z.ZodTypeAny, TResult>(
  policy: CatalogRoutePolicy,
  schema: TSchema,
  run: (auth: AuthContext, body: z.infer<TSchema>) => Promise<TResult>,
) {
  return defineRoute<TSchema>({
    rateLimit: TIER_OF[policy.category],
    schema,
    auth: MANAGE,
    fallbackError: FALLBACK_ERROR,
    handler: ({ auth, body }) => respond(created, () => run(auth, body)),
  });
}

/** `PUT /api/catalog/<συλλογή>/[id]` ή `POST …/[id]/<πράξη>` — αλλαγή συγκεκριμένης οντότητας. */
export function catalogEntityRoute<TSchema extends z.ZodTypeAny, TResult>(
  policy: CatalogRoutePolicy,
  schema: TSchema,
  run: (auth: AuthContext, id: string, body: z.infer<TSchema>) => Promise<TResult>,
) {
  return defineRoute<TSchema, IdParams>({
    rateLimit: TIER_OF[policy.category],
    schema,
    auth: MANAGE,
    fallbackError: FALLBACK_ERROR,
    handler: ({ auth, body, params }) => respond(ok, () => run(auth, params.id, body)),
  });
}

/** `DELETE /api/catalog/<συλλογή>/[id]?expectedRevision=N` — soft delete με CAS. */
export function catalogDeleteRoute<TResult>(
  policy: CatalogRoutePolicy,
  run: (auth: AuthContext, id: string, expectedRevision: number) => Promise<TResult>,
) {
  return defineRoute<z.ZodTypeAny, IdParams>({
    rateLimit: TIER_OF[policy.category],
    auth: MANAGE,
    fallbackError: FALLBACK_ERROR,
    handler: ({ req, auth, params }) => {
      const raw = new URL(req.url).searchParams.get(EXPECTED_REVISION_PARAM);
      const parsed = expectedRevisionSchema.safeParse(raw === null ? undefined : Number(raw));
      if (!parsed.success) badRequest(`${EXPECTED_REVISION_PARAM} is required`);
      return respond(ok, () => run(auth, params.id, parsed.data));
    },
  });
}
