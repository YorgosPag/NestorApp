import 'server-only';

/**
 * @fileoverview **Η ΑΝΑΓΝΩΣΗ ΓΙΑ ΟΠΟΙΟΝ ΔΙΑΒΑΖΕΙ ΗΔΗ** — το ένα σχήμα των διαδρομών «παρουσία» και «ονόματα».
 * @related ADR-867 Β5 (παρουσία) · Β7 (ονόματα) · `services/network-messaging/thread-reader.ts` (η μία πόρτα)
 * @module app/api/network/_shared/thread-reader-route
 *
 * 🔑 **Ένα νήμα, μια ερώτηση, μία απάντηση — ή το ΙΔΙΟ 404** (ADR-742): ξένο και ανύπαρκτο νήμα απαντούν ίδια,
 * αλλιώς η διαδρομή θα έλεγε σε αγνώστους «αυτό το νήμα υπάρχει». Δύο χειρόγραφες διαδρομές ήταν **δίδυμα**
 * (CHECK 3.28, μετρημένο στο Β7) που θα απέκλιναν την ημέρα που η μία άλλαζε μετάφραση σφάλματος.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { networkRefusal, networkServerError, type NetworkActor } from './network-door';
import { requireRouteParam } from './network-params';

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };

interface ThreadReaderSpec<T extends object> {
  /** `null` ⇒ ο καλών **δεν** διαβάζει το νήμα (ή δεν υπάρχει) — ίδια απάντηση. */
  readonly read: (adminDb: AdminFirestore, threadId: string, callerUid: string) => Promise<T | null>;
  readonly logger: { error(message: string, meta: Record<string, unknown>): void };
  readonly failure: string;
}

/** Ο handler μιας διαδρομής ανάγνωσης νήματος — `{ success: true, ...τιμή }`. */
export function threadReaderHandler<T extends object>(spec: ThreadReaderSpec<T>) {
  return async (_request: NextRequest, actor: NetworkActor, routeContext?: ThreadRoute) => {
    const thread = await requireRouteParam(routeContext, 'threadId');
    if (!thread.ok) return thread.response;
    const threadId = thread.value;

    try {
      const value = await spec.read(getAdminFirestore(), threadId, actor.uid);
      if (value === null) return networkRefusal('not-audience');
      return NextResponse.json({ success: true as const, ...value });
    } catch (error) {
      return networkServerError(spec.logger, spec.failure, error, { threadId });
    }
  };
}
