/**
 * Firestore Rules Test Coverage — Operations & Outcomes
 *
 * Canonical operation + outcome enums used by the coverage manifest and the
 * matrix-driven test harness. See ADR-298 §3.2.
 *
 * @module tests/firestore-rules/_registry/operations
 * @since 2026-04-11 (ADR-298 Phase A)
 */

/** CRUD operations exercised against Firestore rules. */
export type Operation = 'read' | 'list' | 'create' | 'update' | 'delete';

/** Expected rule outcome for a (persona × operation) cell. */
export type Outcome = 'allow' | 'deny';

/**
 * Deterministic failure reason tag.
 *
 * Used to verify *why* a deny happened — a rule regression that still denies
 * but for the wrong reason (e.g. "immutable" instead of "cross_tenant") is a
 * silent contract break. Reason tags give the harness a lightweight way to
 * assert on intent, not just outcome.
 */
export type Reason =
  | 'missing_claim'         // unauthenticated or no companyId claim
  | 'cross_tenant'          // authed but wrong companyId
  | 'immutable'             // append-only rule blocks update/delete
  | 'field_not_allowlisted' // update with disallowed field
  | 'legacy_fallback'       // legacy doc with no companyId — fallback-leg test
  | 'enum_invalid'          // enum validation (channel/direction/status)
  | 'insufficient_role'     // authed + tenant OK but role below the rule's floor
  | 'server_only';          // client write forbidden (server SDK only)

/** All known operations — iteration helper for matrix loops. */
export const ALL_OPERATIONS: readonly Operation[] = [
  'read',
  'list',
  'create',
  'update',
  'delete',
] as const;

/** Operations that only affect existing documents. */
export const WRITE_OPERATIONS: readonly Operation[] = ['create', 'update', 'delete'] as const;

/** Operations that read documents without mutating. */
export const READ_OPERATIONS: readonly Operation[] = ['read', 'list'] as const;
