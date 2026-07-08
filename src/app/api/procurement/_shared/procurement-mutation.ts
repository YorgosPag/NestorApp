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
 *
 * @module app/api/procurement/_shared/procurement-mutation
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { httpError } from '@/lib/api/define-route';
import { resolveProcurementErrorStatus } from './error-status';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

/** Minimal structural view of the module logger (`error(message, ...args)`). */
interface MutationLogger {
  error(message: string, ...args: unknown[]): void;
}

export interface ProcurementMutationOptions<TSchema extends z.ZodTypeAny> {
  req: NextRequest;
  /** Optional body schema — omit for no-body mutations (archive / delete). */
  schema?: TSchema;
  logger: MutationLogger;
  /** Log message emitted on a thrown service error. */
  logMessage: string;
  /** Extra structured-log context (e.g. `{ rfqId }`). */
  logContext?: Record<string, unknown>;
  /** Fallback for `getErrorMessage` when the thrown value has no message. */
  fallbackError: string;
  /** Business step — returns the success (or early non-throwing) envelope. */
  run: (data: z.infer<TSchema>) => Promise<NextResponse>;
}

export async function runProcurementMutation<TSchema extends z.ZodTypeAny>(
  opts: ProcurementMutationOptions<TSchema>,
): Promise<NextResponse> {
  const { req, schema, logger, logMessage, logContext, fallbackError, run } = opts;
  try {
    let data = undefined as z.infer<TSchema>;
    if (schema) {
      const parsed = safeParseBody(schema, await req.json());
      if (parsed.error) return parsed.error;
      data = parsed.data;
    }
    return await run(data);
  } catch (error) {
    const message = getErrorMessage(error, fallbackError);
    logger.error(logMessage, { ...(logContext ?? {}), error: message });
    httpError(resolveProcurementErrorStatus(error, { mode: 'mutation' }), message);
  }
}
