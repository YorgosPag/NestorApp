/**
 * =============================================================================
 * TRIGGER RUNTIME PROFILES — one declaration per profile (ADR-873 Φ1 · S0.8)
 * =============================================================================
 *
 * `TRIGGER_RUNTIME` was declared **twice**, in two sibling modules, under the same
 * name — and with **different values**:
 *
 *   `search/indexTriggers.ts`          → timeoutSeconds: 60
 *   `aggregation/floorUnitsAggregation.ts` → timeoutSeconds: 120
 *
 * 🔴 That is the trap worth naming. Two constants sharing a name invite exactly one
 * mistake: "it's duplicated, collapse it into one" — which would silently halve the
 * aggregation's budget, or double the search triggers' cost, and no test would fail.
 * The duplication was real; the **sameness** was not. So this file keeps **two named
 * profiles** and the names say what the difference is for.
 *
 * ⛔ Do not add a profile without a reason a reader can check. A third value that
 * differs by 10 seconds from an existing one is drift wearing a name.
 *
 * @module functions/config/runtime
 * @enterprise ADR-873 Φάση 1 (N.0.2 Boy Scout)
 */

/** Node's `RuntimeOptions` subset these profiles set — kept structural, no SDK import. */
interface TriggerRuntimeProfile {
  readonly timeoutSeconds: number;
  readonly memory: '256MB';
}

/**
 * Per-document reaction: read one entity, write one derived document.
 *
 * Used by the 11 search index triggers. They fire on **every** entity write, so the
 * budget is deliberately tight — a trigger that needs longer than a minute here is
 * doing something it should not be doing in a per-write path.
 */
export const REACTIVE_TRIGGER_RUNTIME: TriggerRuntimeProfile = {
  timeoutSeconds: 60,
  memory: '256MB',
};

/**
 * Fan-in recomputation: read **many** siblings to recompute one aggregate.
 *
 * Used by `onPropertyWriteFloorUnits`, which queries every property of a building
 * and every floor of it. The cost grows with the building, not with the change —
 * hence twice the budget of {@link REACTIVE_TRIGGER_RUNTIME}.
 */
export const AGGREGATION_TRIGGER_RUNTIME: TriggerRuntimeProfile = {
  timeoutSeconds: 120,
  memory: '256MB',
};
