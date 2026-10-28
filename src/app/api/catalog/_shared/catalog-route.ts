/**
 * Τα **factories** των routes του σχήματος καταλόγου (ADR-923 §5.9) — ένα σύνορο για όλα:
 *
 * - `defineRoute` ⇒ `withAuth` ⇒ **ιδεμποτία** (CHECK 3.92) · zod σώμα.
 * - Η βαθμίδα ορίου ρυθμού **δηλώνεται στο ίδιο το `route.ts`** (`{ category: 'STANDARD' }`, CHECK 3.78):
 *   ο αναγνώστης της διαδρομής βλέπει ποιο όριο ισχύει χωρίς να ανοίξει το factory.
 * - Δικαίωμα ανά **αρχή** (ADR-923 §5.1 · §5.10): `schema` ⇒ `catalog:schema:manage` (η δομή — προεπιλογή)·
 *   `products` ⇒ `catalog:products:manage` (τα δεδομένα: μοντέλα, SKU, μέσα, επανυπολογισμός). Akeneo: «edit
 *   products» ≠ «manage catalog structure». `pricing` / `pricingPublish` (ADR-923 §5.11 «3β»): συντήρηση τιμών ≠
 *   δημοσίευση (SAP). Ο πίνακας ζει στο `vocabulary/catalog-authorities` — κοινός με τον πελάτη.
 * - `CatalogWriteError` ⇒ `ApiError` σε **ένα** σημείο (`toCatalogApiError`): ίδιο λάθος, ίδιος κωδικός, παντού.
 *
 * Οι αναγνώσεις του **σχήματος/δεδομένων** δεν περνούν από εδώ: ο πελάτης διαβάζει απευθείας τη Firestore (κανόνες:
 * `isInternalUserOfCompany`). ⚠️ **Εξαίρεση: οι ΤΙΜΕΣ** (ADR-923 §5.11 «3δ» Ζ) — `catalogReadRoute` με κριτή
 * `pricingView`, γιατί κανόνας Firestore δεν βλέπει τα δικαιώματα του ρόλου· ζωντανές με σήματα όψεων (ADR-905).
 * @module app/api/catalog/_shared/catalog-route
 */

import 'server-only';

import type { NextResponse } from 'next/server';
import type { z } from 'zod';

import { badRequest, created, defineRoute, ok, type RateLimitTier } from '@/lib/api/define-route';
import type { AuthContext } from '@/lib/auth';
import type { RateLimitCategory } from '@/lib/middleware/rate-limit-config';
import { CatalogWriteError, toCatalogApiError } from '@/server/catalog/catalog-write-error';
import { CURSOR_PARAM, EXPECTED_REVISION_PARAM } from '@/subapps/catalog/catalog-routes';
import { CATALOG_AUTHORITY_PERMISSIONS, type CatalogAuthority } from '@/subapps/catalog/vocabulary/catalog-authorities';
import { entityIdSchema, expectedRevisionSchema } from '@/subapps/catalog/schema/zod/common.schema';

/** Οι βαθμίδες που έχουν νόημα για εγγραφές σχήματος — ρητή δήλωση ανά διαδρομή. */
type CatalogRateCategory = Extract<RateLimitCategory, 'HIGH' | 'STANDARD' | 'SENSITIVE'>;

export interface CatalogRoutePolicy {
  readonly category: CatalogRateCategory;
  /** Προεπιλογή `schema` (οι διαδρομές της Φάσης 1). */
  readonly authority?: CatalogAuthority;
}

const TIER_OF: Readonly<Record<CatalogRateCategory, RateLimitTier>> = { HIGH: 'high', STANDARD: 'standard', SENSITIVE: 'sensitive' };
// Ποια εξουσία κρίνει τη διαδρομή — ο ΕΝΑΣ πίνακας δικαιοδοσία → δικαίωμα (κοινός με τον πελάτη).
const authOf = (policy: CatalogRoutePolicy) => ({ permissions: CATALOG_AUTHORITY_PERMISSIONS[policy.authority ?? 'schema'] });
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

/**
 * Διαδρομή **χωρίς** id με σώμα. Η δημιουργία και η πράξη διαφέρουν **μόνο** στο περίβλημα (201 ή 200) ⇒ ένα
 * εργοστάσιο, δύο εφαρμογές του (όχι δύο δίδυμες συναρτήσεις — CHECK 3.28).
 * 🔑 **Εξαγόμενο επίτηδες**: το CHECK 3.92 υπολογίζει τα σύνορα από **εξαγόμενες** συναρτήσεις που καλούν σύνορο·
 * μη εξαγόμενο, τα `catalogCreateRoute` / `catalogActionRoute` θα φαίνονταν εκτός συνόρου (ψευδώς θετικό Κ3).
 */
export const bodyRouteWith =
  (envelope: (data: unknown) => NextResponse) =>
  <TSchema extends z.ZodTypeAny, TResult>(
    policy: CatalogRoutePolicy,
    schema: TSchema,
    run: (auth: AuthContext, body: z.infer<TSchema>) => Promise<TResult>,
  ) =>
    defineRoute<TSchema>({
      rateLimit: TIER_OF[policy.category],
      schema,
      auth: authOf(policy),
      fallbackError: FALLBACK_ERROR,
      handler: ({ auth, body }) => respond(envelope, () => run(auth, body)),
    });

/** `POST /api/catalog/<συλλογή>` — δημιουργία (201). */
export const catalogCreateRoute = bodyRouteWith(created);

/** `PUT /api/catalog/<singleton>` ή `POST /api/catalog/<πράξη>` — πράξη χωρίς id (ρυθμίσεις, εργασίες), 200. */
export const catalogActionRoute = bodyRouteWith(ok);

/** `PUT /api/catalog/<συλλογή>/[id]` ή `POST …/[id]/<πράξη>` — αλλαγή συγκεκριμένης οντότητας. */
export function catalogEntityRoute<TSchema extends z.ZodTypeAny, TResult>(
  policy: CatalogRoutePolicy,
  schema: TSchema,
  run: (auth: AuthContext, id: string, body: z.infer<TSchema>) => Promise<TResult>,
) {
  return defineRoute<TSchema, IdParams>({
    rateLimit: TIER_OF[policy.category],
    schema,
    auth: authOf(policy),
    fallbackError: FALLBACK_ERROR,
    handler: ({ auth, body, params }) => respond(ok, () => run(auth, params.id, body)),
  });
}

/**
 * `GET /api/catalog/<όψη>` — ανάγνωση που κρίνει ο **ΕΝΑΣ** κριτής (ADR-923 §5.11 «3δ» Ζ). Τα `params` είναι τα
 * τμήματα της διαδρομής, το `search` τα ερωτήματα (δρομέας σελίδας κ.λπ.) — η επικύρωσή τους ανήκει στον αναγνώστη.
 */
export function catalogReadRoute<TResult, TParams extends Record<string, string> = Record<string, never>>(
  policy: CatalogRoutePolicy,
  run: (auth: AuthContext, params: TParams, search: URLSearchParams) => Promise<TResult>,
) {
  return defineRoute<z.ZodTypeAny, TParams>({
    rateLimit: TIER_OF[policy.category],
    auth: authOf(policy),
    fallbackError: FALLBACK_ERROR,
    handler: ({ req, auth, params }) => respond(ok, () => run(auth, params, new URL(req.url).searchParams)),
  });
}

/** Ο δρομέας σελίδας (`?cursor=<id εγγράφου>`): απών ⇒ πρώτη σελίδα· άκυρος ⇒ 400, ποτέ σιωπηλά «από την αρχή». */
export function cursorParamOf(search: URLSearchParams): string | null {
  const raw = search.get(CURSOR_PARAM);
  if (raw === null) return null;
  const parsed = entityIdSchema.safeParse(raw);
  if (!parsed.success) badRequest(`${CURSOR_PARAM} is invalid`);
  return parsed.data;
}

/** `DELETE /api/catalog/<συλλογή>/[id]?expectedRevision=N` — soft delete με CAS. */
export function catalogDeleteRoute<TResult>(
  policy: CatalogRoutePolicy,
  run: (auth: AuthContext, id: string, expectedRevision: number) => Promise<TResult>,
) {
  return defineRoute<z.ZodTypeAny, IdParams>({
    rateLimit: TIER_OF[policy.category],
    auth: authOf(policy),
    fallbackError: FALLBACK_ERROR,
    handler: ({ req, auth, params }) => {
      const raw = new URL(req.url).searchParams.get(EXPECTED_REVISION_PARAM);
      const parsed = expectedRevisionSchema.safeParse(raw === null ? undefined : Number(raw));
      if (!parsed.success) badRequest(`${EXPECTED_REVISION_PARAM} is required`);
      return respond(ok, () => run(auth, params.id, parsed.data));
    },
  });
}
