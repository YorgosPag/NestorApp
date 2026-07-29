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
 * Τα τρία πρώτα βήματα ζουν στο {@link runGuarded}· εδώ προστίθεται **μόνο** ο
 * έλεγχος κτηρίου, που είναι και ο λόγος ύπαρξης αυτού του module.
 *
 * @module lib/api/building-scoped-route
 */

import type { NextRequest, NextResponse } from 'next/server';
import { requireBuildingInTenant } from '@/lib/auth';
import type { PermissionId } from '@/lib/auth';
import { runGuarded, type AdminFirestore, type GuardedRouteArgs } from '@/lib/api/guarded-route';

export type { AdminFirestore };

export interface BuildingScopedArgs extends GuardedRouteArgs {
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

    return runGuarded<T>(request, permissions, async ({ req, ctx, adminDb }) => {
      await requireBuildingInTenant({ ctx, buildingId, path: routePath(buildingId) });
      return handler({ req, ctx, adminDb, buildingId });
    });
  };
}
