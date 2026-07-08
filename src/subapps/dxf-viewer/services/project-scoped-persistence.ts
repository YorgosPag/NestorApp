/**
 * Generic project-scoped pub/sub persistence factory (ADR-358) — SSoT για τα
 * localStorage-backed per-project stores (layer filters Φ11, layer states Φ12).
 *
 * Οι δύο concrete stores (`layer-filter-persistence`, `layer-state-persistence`)
 * ήταν structural twins: ένα `Map<projectId, Set<listener>>` registry με
 * subscribe(+hydration) / save / delete / replace / emit / upsert-by-id / reset.
 * Οι **μόνες** διαφορές: το storage-key prefix, η read+validate συνάρτηση, ο
 * `id` accessor και ένα optional `replace` filter. Αυτά γίνονται factory params
 * → μηδέν παράλληλα twins (ADR-583 / CHECK 3.28).
 *
 * Storage layout ανά store: `{storagePrefix}:{projectId}` → JSON `T[]`.
 * Resilient σε SSR + private-mode failures μέσω των `storageGet/storageSet`.
 */

import { storageGet, storageSet } from '../utils/storage-utils';

/** Listener που δέχεται το τρέχον snapshot ενός project. */
export type ProjectScopedListener<T> = (items: ReadonlyArray<T>) => void;

/** Handle συνδρομής — `unsubscribe()` idempotent. */
export interface ProjectScopedHandle {
  readonly unsubscribe: () => void;
}

/** Παραμετροποίηση ενός concrete store (prefix + validation + id + replace hook). */
export interface ProjectScopedStoreConfig<T> {
  /** Storage-key prefix (`dxf:layerFilters`, `dxf:layerStates`, …). */
  readonly storagePrefix: string;
  /** Σταθερό id ενός item (για upsert/delete by id). */
  readonly idOf: (item: T) => string;
  /** Validate + coerce ένα parsed unknown array στο έγκυρο υποσύνολο. */
  readonly sanitize: (parsed: unknown[]) => ReadonlyArray<T>;
  /** Optional filter στο `replace` (π.χ. drop system-smart filters στο import). */
  readonly onReplace?: (items: ReadonlyArray<T>) => ReadonlyArray<T>;
}

/** Το πλήρες public surface ενός project-scoped store. */
export interface ProjectScopedStore<T> {
  readProject(projectId: string): ReadonlyArray<T>;
  subscribe(projectId: string, listener: ProjectScopedListener<T>): ProjectScopedHandle;
  save(projectId: string, item: T): void;
  remove(projectId: string, id: string): void;
  replace(projectId: string, items: ReadonlyArray<T>): void;
  /** @internal Clear all listeners. Tests only. */
  reset(): void;
}

export function createProjectScopedStore<T>(config: ProjectScopedStoreConfig<T>): ProjectScopedStore<T> {
  const listeners = new Map<string, Set<ProjectScopedListener<T>>>();
  const storageKey = (projectId: string): string => `${config.storagePrefix}:${projectId}`;

  const readProject = (projectId: string): ReadonlyArray<T> => {
    if (!projectId) return [];
    const parsed = storageGet<unknown>(storageKey(projectId), []);
    if (!Array.isArray(parsed)) return [];
    return config.sanitize(parsed);
  };

  const emit = (projectId: string, snapshot: ReadonlyArray<T>): void => {
    listeners.get(projectId)?.forEach((listener) => listener(snapshot));
  };

  const upsert = (current: ReadonlyArray<T>, item: T): ReadonlyArray<T> => {
    const id = config.idOf(item);
    const idx = current.findIndex((x) => config.idOf(x) === id);
    if (idx === -1) return [...current, item];
    const next = current.slice();
    next[idx] = item;
    return next;
  };

  return {
    readProject,

    subscribe(projectId, listener) {
      let bucket = listeners.get(projectId);
      if (!bucket) {
        bucket = new Set();
        listeners.set(projectId, bucket);
      }
      bucket.add(listener);
      // Initial hydration emit (race-free: listener sees current state before next event).
      listener(readProject(projectId));
      return {
        unsubscribe: () => {
          const current = listeners.get(projectId);
          if (!current) return;
          current.delete(listener);
          if (current.size === 0) listeners.delete(projectId);
        },
      };
    },

    save(projectId, item) {
      if (!projectId) return;
      const next = upsert(readProject(projectId), item);
      if (!storageSet(storageKey(projectId), next)) return;
      emit(projectId, next);
    },

    remove(projectId, id) {
      if (!projectId) return;
      const current = readProject(projectId);
      const next = current.filter((x) => config.idOf(x) !== id);
      if (next.length === current.length) return;
      if (!storageSet(storageKey(projectId), next)) return;
      emit(projectId, next);
    },

    replace(projectId, items) {
      if (!projectId) return;
      const sanitized = config.onReplace ? config.onReplace(items) : items;
      if (!storageSet(storageKey(projectId), sanitized)) return;
      emit(projectId, sanitized);
    },

    reset() {
      listeners.clear();
    },
  };
}
