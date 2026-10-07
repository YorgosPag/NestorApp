/**
 * Το **ένα** κέλυφος των διαδρομών κάτω από `/api/properties/[id]/…` (ADR-281 · ADR-329 §3.9).
 *
 * Κάθε τέτοια διαδρομή έκανε με το χέρι τα ίδια τέσσερα βήματα — `params` → `withAuth` →
 * φρουρός ακινήτου → `try/catch` σε 500 — και το Στάδιο 3β πρόσθεσε πέμπτο: τη δήλωση
 * πρόθεσης. Είκοσι αντίγραφα ενός κελύφους είναι είκοσι σημεία όπου το πέμπτο βήμα ξεχνιέται.
 *
 * 🔑 Ο φρουρός τρέχει **έξω** από το `try`: η άρνησή του (404 ξένου μισθωτή · 409
 *    `ENTITY_RETIRED`) φτάνει στο `withAuth` με τον κωδικό της, δεν γίνεται 500.
 * 🔑 Το `intent` είναι υποχρεωτικό εδώ όπως και στον φρουρό — το CHECK 3.100 διαβάζει το
 *    κυριολεκτικό του **στο `route.ts`**, όχι εδώ.
 *
 * @module api/properties/_shared/property-route
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import {
  requirePropertyInTenantScope,
  type PropertyAccessIntent,
  type TenantProperty,
} from '@/lib/auth/tenant-isolation';

export interface PropertyRouteParams {
  id: string;
}

/** Ό,τι παίρνει ο χειριστής μιας διαδρομής ακινήτου — το ακίνητο είναι ήδη κριμένο. */
export interface PropertyRouteCall<P extends PropertyRouteParams> {
  readonly req: NextRequest;
  readonly ctx: AuthContext;
  readonly cache: PermissionCache;
  readonly params: P;
  readonly propertyId: string;
  readonly property: TenantProperty;
}

export interface PropertyRouteConfig<P extends PropertyRouteParams> {
  /** Το πρότυπο της διαδρομής, όπως γράφεται στο ιστορικό του φρουρού. */
  readonly path: string;
  readonly intent: PropertyAccessIntent;
  /** Μήνυμα του 500 όταν ο χειριστής ρίξει κάτι χωρίς δικό του μήνυμα. */
  readonly failure: string;
  readonly handle: (call: PropertyRouteCall<P>) => Promise<NextResponse>;
}

/** `{ success: false, error }` — προεπιλογή 409: η υπηρεσία αρνήθηκε την πράξη. */
export function failure(error: string | undefined, status = 409): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

export function propertyRoute<P extends PropertyRouteParams = PropertyRouteParams>(
  config: PropertyRouteConfig<P>
): (request: NextRequest, segmentData?: { params: Promise<P> }) => Promise<NextResponse> {
  return async (request, segmentData) => {
    const params = await segmentData!.params;

    const handler = withAuth(
      async (req: NextRequest, ctx: AuthContext, cache: PermissionCache): Promise<NextResponse> => {
        const property = await requirePropertyInTenantScope({
          ctx,
          propertyId: params.id,
          path: config.path,
          intent: config.intent,
        });
        try {
          return await config.handle({ req, ctx, cache, params, propertyId: params.id, property });
        } catch (error) {
          return failure(getErrorMessage(error, config.failure), 500);
        }
      }
    );

    return handler(request);
  };
}
