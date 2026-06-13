/**
 * Per-entity-id persist serializer (ADR-401 / N.7 race-free auto-attach).
 *
 * WHY: structural auto-attach (wall→beam, column→beam) re-persists an entity
 * SYNCHRONOUSLY during its own creation tick — before the first async `setDoc`
 * resolves and updates the "last saved params" baseline. Without serialization
 * the second `persist()` still observes an empty baseline → it treats the entity
 * as new again, emitting a DUPLICATE `created` audit entry + a redundant `setDoc`
 * (instead of the correct single `created` followed by an `updated` diff).
 *
 * FIX: chain every `persist()` for a given id onto the previous one. The second
 * call runs only after the first has committed its baseline, so it routes through
 * the update path (one `created`, then `updated` with a real
 * `topBinding: storey-ceiling → attached` diff). This is the Revit-grade lifecycle:
 * create once, then amend — never create twice.
 *
 * SSoT: one serializer shared by all BIM entity persistence hooks (wired into
 * useWallPersistence + useColumnPersistence; other hooks adopt on-touch).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 */

export interface PersistSerializer {
  /**
   * Run `task` after any in-flight task for the same `id` has settled.
   * Calls for DIFFERENT ids never block each other. Returns the promise for
   * THIS task so callers can await their own completion.
   */
  run(id: string, task: () => Promise<void>): Promise<void>;
}

export function createPersistSerializer(): PersistSerializer {
  const inFlight = new Map<string, Promise<void>>();

  return {
    run(id, task) {
      const prior = inFlight.get(id);
      const next = (async () => {
        if (prior) {
          // The prior persist surfaces its own errors (each persist() has an
          // internal try/catch); we only need ordering, so swallow here.
          try {
            await prior;
          } catch {
            /* prior failure already handled by its own persist */
          }
        }
        await task();
      })();

      inFlight.set(id, next);
      const release = () => {
        // Only clear if no newer task has replaced us as the tail for this id.
        if (inFlight.get(id) === next) inFlight.delete(id);
      };
      next.then(release, release);
      return next;
    },
  };
}
