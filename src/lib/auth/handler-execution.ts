/**
 * @module lib/auth/handler-execution
 * @description **Η κλήση ενός route handler από ένα σύνορο** — ΜΙΑ, για κάθε σύνορο (`withAuth` και οι δύο
 * κλάδοι του · `withPersonalOrOrgAuth`). ADR-853 Ε3 Φάση 2.
 *
 * 🏢 Κεντρικός χειρισμός σφαλμάτων + μέτρηση χρόνου: κανένα per-endpoint wrapper. Εξήχθη από το `withAuth`
 * όταν το δεύτερο σύνορο χρειάστηκε το ίδιο — δύο αντίγραφα θα απαντούσαν διαφορετικά στο «τι γίνεται όταν
 * ο handler σκάσει».
 *
 * 🔑 Το `thrown` ταξιδεύει ως το σύνορο ιδεμποτίας, γιατί **«επέστρεψε 503»** (τίποτα δεν άλλαξε ⇒ το κλειδί
 * ελευθερώνεται) και **«έσκασε»** (μπορεί να είχε γράψει ⇒ το αποτέλεσμα αποθηκεύεται) είναι **αντίθετες**
 * αποφάσεις.
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';

import { apiErrorHandler } from '@/lib/api/ApiErrorHandler';
import type { IdempotentExecution } from '@/lib/api/idempotency/with-idempotency';

/** Ό,τι γράφεται στο ίχνος σφάλματος — ποιος και σε ποιον χώρο. */
export interface HandlerErrorContext {
  readonly userId?: string;
  readonly metadata?: Record<string, unknown>;
}

/** 🏢 Performance tracking — ειδοποίηση όταν ένα route ξεπερνά τα 5s (μόνο production, server). */
function reportSlowRoute(request: NextRequest, duration: number): void {
  if (duration < 5000 || typeof window !== 'undefined' || process.env.NODE_ENV !== 'production') return;
  import('@/lib/telemetry/telegram-alert-service')
    .then(({ sendTelegramAlert }) => {
      void sendTelegramAlert('slow', 'API', `${request.method} ${request.nextUrl.pathname} — ${(duration / 1000).toFixed(1)}s`, {
        duration: `${duration}ms`,
        method: request.method,
      });
    })
    .catch(() => { /* swallow */ });
}

/** Τρέχει τον handler· σφάλμα ⇒ η απάντηση του κεντρικού χειριστή, με `thrown: true`. */
export async function executeHandler(
  request: NextRequest,
  run: () => Promise<NextResponse>,
  errorContext: HandlerErrorContext,
): Promise<IdempotentExecution> {
  const requestStart = Date.now();
  try {
    const response = await run();
    reportSlowRoute(request, Date.now() - requestStart);
    return { response, thrown: false };
  } catch (error) {
    const response = await apiErrorHandler.handleError(error, request, {
      operation: request.nextUrl.pathname,
      userId: errorContext.userId,
      endpoint: request.nextUrl.pathname,
      metadata: errorContext.metadata,
    });
    return { response, thrown: true };
  }
}
