/**
 * snap-state-persistence — pure, migration-safe merge for the persisted snap blob.
 *
 * A stored `dxfViewer.snap` blob keeps a POSITIVE list (`activeTypes`). On its own a
 * missing id is ambiguous: it may be explicitly-off, OR it may be a snap that shipped
 * AFTER the blob was written (so the user never had a chance to toggle it). `knownTypes`
 * records the modes the writing build knew about, which lets us tell the two apart:
 *   • id known to the blob   → honor the stored active/inactive value
 *   • id unknown/newer        → fall back to DEFAULT (never silently off)
 *
 * Legacy blobs predate `knownTypes`; there we treat the blob's own `activeTypes` as the
 * known set, so a default-on snap that shipped later (e.g. DIM_DEF_POINT / DIM_LINE,
 * ADR-362) REVIVES to its default instead of loading as `false`. Every fresh write stamps
 * `knownTypes`, so the schema self-heals to precise on the next round-trip.
 *
 * Kept pure + React-free so it is unit-testable in isolation.
 *
 * @see ADR-378 snap-system-master-architecture — §Changelog (migration-safe snap load)
 * @see snapping/context/SnapContext.tsx — sole consumer
 */

/**
 * Resolve the in-memory per-mode snap state from a persisted blob.
 *
 * @param allModes  every mode this build persists per-mode (the ALL_MODES SSoT)
 * @param defaults  default per-mode state (the getDefaultSnapState SSoT)
 * @param activeTypes  the blob's positive list of enabled ids
 * @param knownTypes   the ids the writing build knew about (undefined = legacy blob)
 */
export function resolvePersistedSnapState<T extends string>(
  allModes: readonly T[],
  defaults: Record<T, boolean>,
  activeTypes: readonly string[],
  knownTypes: readonly string[] | undefined,
): Record<T, boolean> {
  const next = {} as Record<T, boolean>;
  for (const mode of allModes) {
    const isKnownToBlob = knownTypes ? knownTypes.includes(mode) : activeTypes.includes(mode);
    next[mode] = isKnownToBlob ? activeTypes.includes(mode) : defaults[mode];
  }
  return next;
}
