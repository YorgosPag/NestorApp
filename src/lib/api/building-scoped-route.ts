/**
 * ADR-245 — «τρέξε αυτόν τον χειριστή, αλλά **μόνο** για καλούντα εξουσιοδοτημένο
 * στο συγκεκριμένο κτήριο».
 *
 * Το ίδιο τετράπτυχο —όριο ρυθμού → auth με δικαίωμα → `requireAdminFirestore()`
 * → `requireBuildingInTenant()`— ήταν γραμμένο **δέκα φορές** μέσα στα τρία
 * `construction-*` routes, με μόνη διαφορά τη διαδρομή και το δικαίωμα. Ήταν και
 * ο λόγος που το CHECK 3.28 τα μπλόκαρε ακόμα και σε χωριστά commits: ο κλώνος
 * ήταν *εντός* του κάθε αρχείου, ανάμεσα στα verbs του.
 *
 * ⚠️ **Δεν κρύβει ποιο HTTP verb κάνει τι** — το `export async function POST(...)`
 * μένει ορατό στο route και ο χειριστής του γράφεται εκεί. Εδώ ζει μόνο η αλυσίδα
 * εξουσιοδότησης. Αυτή είναι η διαφορά από ένα HOF που θα τύλιγε το ίδιο το verb
 * (το οποίο, κατά ADR-245, **δεν** πρέπει να γίνει).
 *
 * @module lib/api/building-scoped-route
 */

import type { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireBuildingInTenant } from '@/lib/auth';
import type { AuthContext, PermissionId } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';

/** Ο τύπος του Admin Firestore, χωρίς να σέρνει κανείς εξάρτηση από το firebase-admin. */
export type AdminFirestore = ReturnType<typeof requireAdminFirestore>;

export interface BuildingScopedArgs {
  readonly req: NextRequest;
  readonly ctx: AuthContext;
  /** Ήδη αρχικοποιημένο — αν αποτύγχανε, ο φύλακας θα είχε πετάξει πριν φτάσει εδώ. */
  readonly adminDb: AdminFirestore;
  readonly buildingId: string;
}

/** Το `segmentData` που δίνει το Next.js σε route κάτω από `[buildingId]`. */
export type BuildingSegment = { params: Promise<{ buildingId: string }> };

export interface BuildingScopedParams<T> {
  /** Η διαδρομή για το audit trail του `requireBuildingInTenant`, ανά κτήριο. */
  readonly routePath: (buildingId: string) => string;
  readonly permissions: PermissionId;
  readonly handler: (args: BuildingScopedArgs) => Promise<NextResponse<T>>;
}

/**
 * Φτιάχνει έναν χειριστή Next.js που τρέχει **μόνο** αφού περάσουν όριο ρυθμού,
 * auth, δικαίωμα και έλεγχος ότι το κτήριο ανήκει στον tenant — με αυτή τη σειρά.
 *
 * Χρήση: `export const POST = buildingScopedRoute<Resp>({ … })` — το verb μένει
 * ρητό στο route, μόνο η αλυσίδα εξουσιοδότησης φεύγει από τα μάτια.
 */
export function buildingScopedRoute<T>(
  params: BuildingScopedParams<T>,
): (request: NextRequest, segmentData: BuildingSegment) => Promise<Response> {
  const { routePath, permissions, handler } = params;

  return async (request: NextRequest, segmentData: BuildingSegment): Promise<Response> => {
    const { buildingId } = await segmentData.params;

    const guarded = withStandardRateLimit(
      withAuth<T>(
        async (req: NextRequest, ctx: AuthContext) => {
          const adminDb = requireAdminFirestore();
          await requireBuildingInTenant({ ctx, buildingId, path: routePath(buildingId) });
          return handler({ req, ctx, adminDb, buildingId });
        },
        { permissions },
      ),
    );

    return guarded(request);
  };
}
