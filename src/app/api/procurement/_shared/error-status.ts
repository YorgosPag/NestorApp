/**
 * =============================================================================
 * resolveProcurementErrorStatus — SSoT for procurement error→HTTP-status mapping
 * =============================================================================
 *
 * The procurement mutation routes (materials + framework-agreements, and their
 * `[id]` detail routes) each re-implemented the SAME `errorStatus` heuristic:
 * map a thrown service error to an HTTP status by its `name` (conflict /
 * validation) plus message substrings, with a route-family-specific fallback.
 *
 * This is that logic, once. It preserves the two DISTINCT behaviours the routes
 * had (byte-identical), selected via `mode`:
 *
 *  - `create`   (list-route POST): conflict→409, validation→400, else→**500**.
 *               Does NOT inspect the message. A bad-JSON `SyntaxError` → 500.
 *  - `mutation` (detail PATCH/DELETE): conflict→409, validation→400,
 *               message `not found`→404, `Forbidden`→403, else→**400**.
 *
 * `conflictName`/`validationName` are OPTIONAL: the RFQ-line and sourcing-event
 * mutation routes have no named conflict/validation error — they map purely on
 * message (`not found`→404, `Forbidden`→403, else→400), which is byte-identical
 * to their previous local `errorStatus` helper. When a name is `undefined` the
 * `error.name === name` guard is `false`, so the check is safely skipped
 * (backward-compatible with the material/framework-agreement callers).
 *
 * @module app/api/procurement/_shared/error-status
 * @see ADR-603 API Route-Handler Factory SSoT
 */

export interface ProcurementErrorStatusOptions {
  /** `error.name` that maps to 409 Conflict (e.g. `MaterialCodeConflictError`). */
  conflictName?: string;
  /** `error.name` that maps to 400 Bad Request (e.g. `MaterialValidationError`). */
  validationName?: string;
  /** Route family — decides message-inspection + fallback. */
  mode: 'create' | 'mutation';
}

export function resolveProcurementErrorStatus(
  error: unknown,
  { conflictName, validationName, mode }: ProcurementErrorStatusOptions,
): number {
  if (error instanceof Error) {
    if (error.name === conflictName) return 409;
    if (error.name === validationName) return 400;
    if (mode === 'mutation') {
      const msg = error.message;
      if (msg.includes('not found')) return 404;
      if (msg.includes('Forbidden')) return 403;
    }
  }
  return mode === 'mutation' ? 400 : 500;
}
