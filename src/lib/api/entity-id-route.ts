/**
 * ADR-245 — routes που κλειδώνονται σε **μία οντότητα με id**.
 *
 * Ο πρόλογος «όριο ρυθμού → auth → `adminDb` → βγάλε το id → 400 αν λείπει» ήταν
 * αντιγραμμένος ανάμεσα στα verbs του ίδιου αρχείου (PATCH ≡ DELETE στο
 * `properties/[id]`, POST ≡ DELETE στο `showcase/generate`) — δηλαδή ο κλώνος που
 * μπλόκαρε το CHECK 3.28 *εντός* του αρχείου, όπου κανένα σπάσιμο commit δεν βοηθά.
 *
 * Δύο εκδοχές, γιατί το id έρχεται από δύο διαφορετικά μέρη:
 *  - {@link entityIdRoute} — τελευταίο τμήμα του URL (`/api/properties/[id]`)
 *  - {@link segmentIdRoute} — `segmentData.params` (`/api/properties/[id]/…/generate`)
 *
 * @module lib/api/entity-id-route
 */

import type { NextRequest, NextResponse } from 'next/server';
import type { PermissionId } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { extractIdFromUrl } from '@/lib/api/route-helpers';
import { runGuarded, type GuardedRouteArgs } from '@/lib/api/guarded-route';

export interface EntityIdArgs extends GuardedRouteArgs {
  readonly id: string;
}

export interface EntityIdRouteParams<T> {
  readonly permissions: PermissionId;
  /** Μήνυμα του 400 όταν λείπει το id (π.χ. `'Property ID is required'`). */
  readonly missingIdMessage: string;
  readonly handler: (args: EntityIdArgs) => Promise<NextResponse<T>>;
}

export type IdSegment = { params: Promise<{ id: string }> };

function guardId(id: string | null | undefined, missingIdMessage: string): string {
  if (!id || id.trim().length === 0) throw new ApiError(400, missingIdMessage);
  return id;
}

/** Το id είναι το τελευταίο τμήμα της διαδρομής. */
export function entityIdRoute<T>(
  params: EntityIdRouteParams<T>,
): (request: NextRequest) => Promise<Response> | Response {
  const { permissions, missingIdMessage, handler } = params;

  return (request: NextRequest) =>
    runGuarded<T>(request, permissions, async ({ req, ctx, adminDb }) =>
      handler({ req, ctx, adminDb, id: guardId(extractIdFromUrl(req.url), missingIdMessage) }),
    );
}

/**
 * Το id έρχεται από τα `params` του Next — για φωλιασμένα routes κάτω από `[id]`.
 *
 * ⚠️ Ο έλεγχος του id γίνεται πλέον **μετά** το auth (πριν γινόταν πριν, σε ένα
 * σημείο). Σκόπιμο: ένας ανώνυμος καλών δεν πρέπει να μαθαίνει τη διαφορά
 * «κακό id» από «δεν έχεις δικαίωμα». Στην πράξη το id δεν αδειάζει ποτέ — αν
 * άδειαζε, το Next δεν θα ταίριαζε καν τη διαδρομή.
 */
export function segmentIdRoute<T>(
  params: EntityIdRouteParams<T>,
): (request: NextRequest, segmentData: IdSegment) => Promise<Response> {
  const { permissions, missingIdMessage, handler } = params;

  return async (request: NextRequest, segmentData: IdSegment): Promise<Response> => {
    const { id } = await segmentData.params;

    return runGuarded<T>(request, permissions, async ({ req, ctx, adminDb }) =>
      handler({ req, ctx, adminDb, id: guardId(id, missingIdMessage) }),
    );
  };
}
