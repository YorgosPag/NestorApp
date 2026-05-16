/**
 * LinetypeRegistry — Runtime Linetype SSoT (ADR-358 §5.3.bis).
 *
 * Mutable singleton micro-leaf (ADR-040 pattern: useSyncExternalStore-compatible).
 * Owns the active linetype catalog: ISO baseline (pre-loaded, immutable) + custom
 * entries registered at runtime (`.lin` import — Phase 3+, user-created — Phase 6+,
 * DXF-import round-trip preservation — Phase 3).
 *
 * Phase 2 scope (foundation only):
 *   - Pre-loaded ISO baseline at module init.
 *   - Register / resolve / list / subscribe contract.
 *   - No `.lin` parser/exporter (Phase 3+ via `services/lin-parser.ts`).
 *   - No persistence (Phase 9 wires Firestore + localStorage).
 *
 * Pre-commit ratchet `linetype-iso-catalog` enforces resolve() usage at render +
 * DXF I/O sites; this registry is the only mutation surface.
 */

import {
  LINETYPE_ISO_NAMES,
  LINETYPE_ISO_CATALOG,
  type LinetypeDef,
} from '../config/linetype-iso-catalog';

type Listener = () => void;

interface LinetypeRegistrySnapshot {
  /** All linetypes in insertion order — ISO baseline first, then runtime registrations. */
  readonly linetypes: ReadonlyArray<LinetypeDef>;
}

function buildIsoSeed(): { byName: Map<string, LinetypeDef>; order: string[] } {
  const byName = new Map<string, LinetypeDef>();
  const order: string[] = [];
  for (const name of LINETYPE_ISO_NAMES) {
    byName.set(name, LINETYPE_ISO_CATALOG[name]);
    order.push(name);
  }
  return { byName, order };
}

let { byName: definitionsByName, order: insertionOrder } = buildIsoSeed();
let cachedSnapshot: LinetypeRegistrySnapshot = freezeSnapshot();

const subscribers = new Set<Listener>();

function freezeSnapshot(): LinetypeRegistrySnapshot {
  const list: LinetypeDef[] = [];
  for (const name of insertionOrder) {
    const def = definitionsByName.get(name);
    if (def) list.push(def);
  }
  return Object.freeze({
    linetypes: Object.freeze(list) as ReadonlyArray<LinetypeDef>,
  });
}

function rebuildSnapshot(): void {
  cachedSnapshot = freezeSnapshot();
}

function notify(): void {
  subscribers.forEach((cb) => cb());
}

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getLinetypeRegistrySnapshot(): LinetypeRegistrySnapshot {
  return cachedSnapshot;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeLinetypeRegistry(cb: Listener): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Resolve a linetype by name (case-sensitive, AutoCAD convention). */
export function resolveLinetype(name: string): LinetypeDef | null {
  return definitionsByName.get(name) ?? null;
}

/** All linetypes in registration order — ISO baseline first. */
export function listLinetypes(): ReadonlyArray<LinetypeDef> {
  return cachedSnapshot.linetypes;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Register a custom linetype. Skips silently if `name` already exists
 * (AutoCAD convention: first registration wins).
 *
 * @returns true if newly registered, false if name already taken.
 */
export function registerLinetype(def: LinetypeDef): boolean {
  if (definitionsByName.has(def.name)) return false;
  definitionsByName.set(def.name, def);
  insertionOrder.push(def.name);
  rebuildSnapshot();
  notify();
  return true;
}

/**
 * Register many definitions atomically — emits a single notify().
 *
 * @returns count of newly added definitions (existing names skipped).
 */
export function registerLinetypes(defs: ReadonlyArray<LinetypeDef>): number {
  let added = 0;
  for (const def of defs) {
    if (definitionsByName.has(def.name)) continue;
    definitionsByName.set(def.name, def);
    insertionOrder.push(def.name);
    added += 1;
  }
  if (added > 0) {
    rebuildSnapshot();
    notify();
  }
  return added;
}

// ─── Test-only reset (NOT exported from index — direct import only) ──────────

/** @internal Reset to ISO baseline only. Tests only. */
export function __resetLinetypeRegistryForTesting(): void {
  const seed = buildIsoSeed();
  definitionsByName = seed.byName;
  insertionOrder = seed.order;
  rebuildSnapshot();
  subscribers.clear();
}
