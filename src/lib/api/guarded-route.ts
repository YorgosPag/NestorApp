/**
 * ADR-245 — το **ένα** πρωτόγονο πίσω από κάθε προστατευμένο API route:
 * «όριο ρυθμού → auth → δικαίωμα → Admin Firestore → ο χειριστής σου».
 *
 * Ήταν ξαναγραμμένο σε **κάθε** verb κάθε route — και ήταν αυτό ακριβώς που
 * μπλόκαρε το CHECK 3.28 *εντός* των αρχείων: PATCH και DELETE του ίδιου route
 * μοιράζονταν 58 πανομοιότυπα tokens πριν καν αρχίσει η λογική τους.
 *
 * ⚠️ **Δεν κρύβει ποιο verb κάνει τι**: το route γράφει `export const PATCH = …`
 * και τον δικό του χειριστή. Εδώ ζει μόνο η αλυσίδα εξουσιοδότησης — ό,τι είναι
 * ίδιο *εξ ορισμού* για όλα τα verbs.
 *
 * @module lib/api/guarded-route
 */

import type { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionId } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';

/** Ο τύπος του Admin Firestore, χωρίς να σέρνει κανείς εξάρτηση από το firebase-admin. */
export type AdminFirestore = ReturnType<typeof requireAdminFirestore>;

export interface GuardedRouteArgs {
  readonly req: NextRequest;
  readonly ctx: AuthContext;
  /** Ήδη αρχικοποιημένο — αν αποτύγχανε, θα είχε πεταχτεί σφάλμα πριν φτάσει εδώ. */
  readonly adminDb: AdminFirestore;
}

/**
 * Τρέχει τον χειριστή πίσω από όριο ρυθμού + auth + δικαίωμα, με έτοιμο `adminDb`.
 *
 * Δέχεται το `request` αντί να επιστρέφει χειριστή, ώστε να μπορούν οι
 * εξειδικευμένες εκδοχές (κτήριο / οντότητα με id) να λύσουν πρώτα τα δικά τους
 * `params` και μετά να δώσουν τον δικό τους χειριστή.
 */
export function runGuarded<T>(
  request: NextRequest,
  permissions: PermissionId,
  handler: (args: GuardedRouteArgs) => Promise<NextResponse<T>>,
): Promise<Response> | Response {
  const guarded = withStandardRateLimit(
    withAuth<T>(async (req: NextRequest, ctx: AuthContext) =>
      handler({ req, ctx, adminDb: requireAdminFirestore() }),
      { permissions },
    ),
  );

  return guarded(request);
}
