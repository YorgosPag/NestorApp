/**
 * ADR-370 — Armed-grip SSoT (module singleton).
 *
 * Holds the set of grips the user has CLICKED to select for a multi-grip move
 * (AutoCAD "hot grips"). Armed grips render orange ('armed' temperature) and stay
 * selected until cleared, supporting shift+click (toggle) and marquee (Slice 2)
 * multi-select, then a group move (Slice 3).
 *
 * Identity is the canonical {@link gripKey} (`${entityId}_${gripIndex}`); the full
 * {@link GripRef} is retained alongside so the group-move commit can resolve each
 * armed grip back to its entity + index without re-parsing the key (entity ids may
 * contain underscores).
 *
 * Pattern: imperative, zero React/DOM deps — event handlers read/write at event
 * time via plain functions (no stale closures), and the render path subscribes via
 * `useSyncExternalStore` so the canvas repaints when the armed set changes. Same
 * lifecycle/rationale as the other `systems/grip/*` stores (e.g. GripAltMoveStore,
 * BimRotateHotGripStore) but with a reactive `subscribe` because the colour is a
 * render concern. ADR-040 compliant — arming is a low-frequency click event, not a
 * 60fps drag subscription.
 *
 * @see rendering/grips/grip-temperature.ts — `armedKeys` → 'armed' (orange)
 * @see docs/centralized-systems/reference/adrs/ADR-370-dxf-grip-multi-arm-group-move.md
 */

import { gripKey, type GripRef } from '../../rendering/grips/grip-temperature';

type Listener = () => void;

const EMPTY_KEYS: ReadonlySet<string> = new Set<string>();
const EMPTY_REFS: readonly GripRef[] = [];

class GripArmedStoreImpl {
  private refs = new Map<string, GripRef>();
  private listeners = new Set<Listener>();
  /** Cached snapshots — rebuilt only on mutation so `getSnapshot` is referentially
   *  stable between changes (required by `useSyncExternalStore`). */
  private keysSnapshot: ReadonlySet<string> = EMPTY_KEYS;
  private refsSnapshot: readonly GripRef[] = EMPTY_REFS;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Stable Set of armed grip keys for `useSyncExternalStore` + temperature input. */
  getKeysSnapshot = (): ReadonlySet<string> => this.keysSnapshot;

  /** Stable array of armed grip refs for the group-move commit (Slice 3). */
  getRefsSnapshot = (): readonly GripRef[] => this.refsSnapshot;

  has(entityId: string, gripIndex: number): boolean {
    return this.refs.has(gripKey(entityId, gripIndex));
  }

  get size(): number {
    return this.refs.size;
  }

  /** Toggle one grip in/out of the armed set (shift+click). */
  toggle(ref: GripRef): void {
    const key = gripKey(ref.entityId, ref.gripIndex);
    if (this.refs.has(key)) this.refs.delete(key);
    else this.refs.set(key, { entityId: ref.entityId, gripIndex: ref.gripIndex });
    this.commit();
  }

  /** Replace the armed set with a single grip (plain click). No-op-safe. */
  setOnly(ref: GripRef): void {
    this.refs.clear();
    this.refs.set(gripKey(ref.entityId, ref.gripIndex), { entityId: ref.entityId, gripIndex: ref.gripIndex });
    this.commit();
  }

  /** Add many grips to the armed set (marquee, Slice 2). */
  armMany(refs: readonly GripRef[]): void {
    if (refs.length === 0) return;
    for (const ref of refs) {
      this.refs.set(gripKey(ref.entityId, ref.gripIndex), { entityId: ref.entityId, gripIndex: ref.gripIndex });
    }
    this.commit();
  }

  /** Clear the armed set. No-op (no notify) when already empty. */
  clear(): void {
    if (this.refs.size === 0) return;
    this.refs.clear();
    this.commit();
  }

  private commit(): void {
    this.keysSnapshot = this.refs.size === 0 ? EMPTY_KEYS : new Set(this.refs.keys());
    this.refsSnapshot = this.refs.size === 0 ? EMPTY_REFS : Array.from(this.refs.values());
    this.listeners.forEach((l) => l());
  }
}

export const GripArmedStore = new GripArmedStoreImpl();
