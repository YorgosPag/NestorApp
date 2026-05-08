/**
 * UserSettings — stable hash helper for echo-loop prevention.
 *
 * The repository's `subscribeSlice` listener fires both for genuine remote
 * updates AND for the writer's own echo (synchronous optimistic notification
 * + Firestore round-trip echo). Without a content-based check, a writer that
 * also subscribes will dispatch its own write back into local state, which
 * re-triggers the writer effect, which writes again — infinite loop.
 *
 * Each sync hook tracks its `lastWrittenHash` and skips listener callbacks
 * whose payload matches it.
 *
 * @module services/user-settings/user-settings-hash
 */

/** Stable JSON serialization (sorted keys, cycle-safe). */
export function stableHash(value: unknown): string {
  const seen = new WeakSet<object>();
  const ser = (v: unknown): string => {
    if (v === null || v === undefined) return 'null';
    if (typeof v !== 'object') return JSON.stringify(v);
    if (seen.has(v as object)) return '"[CYCLE]"';
    seen.add(v as object);
    if (Array.isArray(v)) return `[${v.map(ser).join(',')}]`;
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return `{${keys.map(k => `"${k}":${ser((v as Record<string, unknown>)[k])}`).join(',')}}`;
  };
  return ser(value);
}
