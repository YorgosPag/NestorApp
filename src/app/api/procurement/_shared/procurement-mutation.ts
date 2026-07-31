/**
 * runProcurementMutation — SSoT for the procurement mutation handler envelope.
 *
 * Every procurement mutation route (RFQ-line create/update/delete/bulk/snapshot,
 * sourcing-event update/archive, RFQ link/unlink) repeated the SAME control
 * scaffold: optionally parse the body, run the service call, and on a thrown
 * error map it to an HTTP status via `resolveProcurementErrorStatus(mode:'mutation')`
 * with a route-specific fallback message + structured log. Hand-duplicated, that
 * scaffold is a token clone across (and within) the route files — jscpd flagged it.
 *
 * This is that scaffold, once. Divergences are injected via config/`run`:
 *  - `schema` (optional): when present the body is `safeParseBody`-validated inside
 *    the try (so a bad-JSON `SyntaxError` maps through the same 400 path the routes
 *    had); a validation failure short-circuits with the byte-identical 400 envelope.
 *    When absent (archive / delete) `run` receives `undefined`.
 *  - `run` returns the success envelope in whatever shape the route emits
 *    (`ok`/`created`, message-shaped `{success,message}`, or `{success,data,count}`);
 *    it may also return an early non-throwing response (e.g. a null-guard 500),
 *    which is passed through untouched.
 *  - `mode` selects the status heuristic for **untyped** errors: `'mutation'`
 *    (default, detail routes) or `'create'` (list-route POST, fallback 500).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ `auth` ΕΙΝΑΙ **ΥΠΟΧΡΕΩΤΙΚΟ** (ADR-742 Ομάδα 2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Εδώ κρέμεται **ολόκληρη** η απόφαση αποκάλυψης του πεδίου ορισμού από μία
 * μεταβλητή: το `auth.globalRole` που παραδίδεται στη χαρτογράφηση. Ένα
 * καρφωμένο `'super_admin'` σε αυτό το σημείο θα άνοιγε ξανά το μαντείο
 * ύπαρξης για **κάθε** διαδρομή μεταβολής, με όλα τα άλλα tests πράσινα — γι'
 * αυτό υπάρχει ξεχωριστό test που αποδεικνύει ότι φτάνει ο **σωστός** καλών,
 * όχι ένας ρόλος (ίδιο σχήμα με το `_domain-route.ts` της Φάσης Β, ADR-742 §7.8).
 *
 * Προαιρετική παράμετρος ασφαλείας είναι αυτή που ξεχνιέται στο επόμενο route.
 *
 * @module app/api/procurement/_shared/procurement-mutation
 * @see ADR-603 API Route-Handler Factory SSoT · ADR-742 §3.4, §7.8
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { httpError } from '@/lib/api/define-route';
import type { AuthContext } from '@/lib/auth';
import { resolveProcurementErrorOutcome } from './procurement-error-outcome';
import { safeParseBody } from '@/lib/validation/shared-schemas';

/** Minimal structural view of the module logger (`error(message, ...args)`). */
interface MutationLogger {
  error(message: string, ...args: unknown[]): void;
}

export interface ProcurementMutationOptions<TSchema extends z.ZodTypeAny> {
  req: NextRequest;
  /**
   * Ο ταυτοποιημένος καλών. **Υποχρεωτικός** — από εδώ βγαίνει το
   * `globalRole` που κρίνει αν η άρνηση φεύγει ειλικρινής ή μεταμφιεσμένη.
   */
  auth: AuthContext;
  /** Optional body schema — omit for no-body mutations (archive / delete). */
  schema?: TSchema;
  logger: MutationLogger;
  /** Log message emitted on a thrown service error. */
  logMessage: string;
  /** Extra structured-log context (e.g. `{ rfqId }`). */
  logContext?: Record<string, unknown>;
  /** Fallback message when the thrown value has none. */
  fallbackError: string;
  /** `error.name` που χαρτογραφείται σε 409 (π.χ. `MaterialCodeConflictError`). */
  conflictName?: string;
  /** `error.name` που χαρτογραφείται σε 400 (π.χ. `MaterialValidationError`). */
  validationName?: string;
  /** Route family για τα **μη τυποποιημένα** σφάλματα. Default: `'mutation'`. */
  mode?: 'create' | 'mutation';
  /** Business step — returns the success (or early non-throwing) envelope. */
  run: (data: z.infer<TSchema>) => Promise<NextResponse>;
}

export async function runProcurementMutation<TSchema extends z.ZodTypeAny>(
  opts: ProcurementMutationOptions<TSchema>,
): Promise<NextResponse> {
  const { req, auth, schema, logger, logMessage, logContext, run } = opts;
  try {
    let data = undefined as z.infer<TSchema>;
    if (schema) {
      const parsed = safeParseBody(schema, await req.json());
      if (parsed.error) return parsed.error;
      data = parsed.data;
    }
    return await run(data);
  } catch (error) {
    const outcome = resolveProcurementErrorOutcome(error, {
      callerGlobalRole: auth.globalRole,
      fallbackError: opts.fallbackError,
      conflictName: opts.conflictName,
      validationName: opts.validationName,
      mode: opts.mode ?? 'mutation',
    });
    // Το log κρατά την **αλήθεια** ακόμη κι όταν το σύρμα παίρνει τη μεταμφίεση.
    logger.error(logMessage, { ...(logContext ?? {}), error: outcome.logMessage });
    httpError(outcome.status, outcome.message);
  }
}
