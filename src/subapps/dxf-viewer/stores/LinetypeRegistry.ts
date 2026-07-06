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
import { createExternalStore } from './createExternalStore';

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

// ─── User-created linetype persistence (ADR-362, Path B) ─────────────────────
// Lightweight localStorage durability for USER-CREATED patterns only — mirrors
// `LinetypeScaleStore`. Without it, a dim style keeps a custom linetype NAME
// across reload while the registry forgets the pattern → the dim renders solid
// (a real correctness bug, not just lost UX). Firestore/`.lin` sync stays the
// registry's later phase; this is the in-browser SSoT layer.

const LS_CUSTOM_LINETYPES = 'dxf:custom-linetypes';

/** Deterministic, ASCII, RNG-free id from a (unique) name — `ltp_<base36 hash>`. */
function userLinetypeId(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return `ltp_${Math.abs(h).toString(36)}`;
}

function loadPersistedUserLinetypes(): LinetypeDef[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_CUSTOM_LINETYPES);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: LinetypeDef[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const { name, description, pattern } = entry as Record<string, unknown>;
      if (typeof name !== 'string' || name.length === 0) continue;
      if (!Array.isArray(pattern) || !pattern.every((v) => typeof v === 'number' && Number.isFinite(v))) continue;
      out.push(Object.freeze({
        id: userLinetypeId(name),
        name,
        description: typeof description === 'string' ? description : '',
        pattern: Object.freeze([...pattern]) as ReadonlyArray<number>,
        origin: 'user-created',
      }));
    }
    return out;
  } catch {
    return [];
  }
}

function persistUserLinetypes(): void {
  if (typeof localStorage === 'undefined') return;
  const customs: Array<Pick<LinetypeDef, 'name' | 'description' | 'pattern'>> = [];
  for (const name of insertionOrder) {
    const def = definitionsByName.get(name);
    if (def && def.origin === 'user-created') {
      customs.push({ name: def.name, description: def.description, pattern: [...def.pattern] });
    }
  }
  try {
    if (customs.length === 0) localStorage.removeItem(LS_CUSTOM_LINETYPES);
    else localStorage.setItem(LS_CUSTOM_LINETYPES, JSON.stringify(customs));
  } catch {
    // localStorage full / disabled — non-fatal (in-memory registry still holds it).
  }
}

// Hydrate persisted customs on top of the ISO seed, BEFORE the snapshot store is
// built, so the very first `listLinetypes()` already exposes them.
for (const def of loadPersistedUserLinetypes()) {
  if (!definitionsByName.has(def.name)) {
    definitionsByName.set(def.name, def);
    insertionOrder.push(def.name);
  }
}

// SSoT pub/sub via createExternalStore (WAVE 2.6). The Map/array above stay as
// mutation accelerators; `cachedSnapshot`/`subscribers`/`notify()` collapse into
// this single composite-snapshot store — `rebuildSnapshot()` still builds the
// derived object, but commits it via `store.set(...)` (always-notify, no `equals`).
const store = createExternalStore<LinetypeRegistrySnapshot>(freezeSnapshot());

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
  store.set(freezeSnapshot());
}

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getLinetypeRegistrySnapshot(): LinetypeRegistrySnapshot {
  return store.get();
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeLinetypeRegistry(cb: Listener): () => void {
  return store.subscribe(cb);
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Resolve a linetype by name (case-sensitive, AutoCAD convention). */
export function resolveLinetype(name: string): LinetypeDef | null {
  return definitionsByName.get(name) ?? null;
}

/** All linetypes in registration order — ISO baseline first. */
export function listLinetypes(): ReadonlyArray<LinetypeDef> {
  return store.get().linetypes;
}

/** ByLayer sentinel — entity inherits its linetype from the active layer (AutoCAD convention). */
export const BYLAYER_LINETYPE = 'ByLayer';

/**
 * Canonical ordered list of **selectable** linetype names for any picker
 * (ribbon combobox, radial-ring drop-down, …): `ByLayer` + every registered
 * linetype (ISO baseline + custom), live. SSoT for the "ByLayer + registry"
 * enumeration — consumers map this to their own option shape, never re-derive it.
 */
export function listSelectableLinetypeNames(): readonly string[] {
  return [BYLAYER_LINETYPE, ...store.get().linetypes.map((d) => d.name)];
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
  if (def.origin === 'user-created') persistUserLinetypes();
  return true;
}

/**
 * Create + register a USER-CREATED linetype from an editor-authored mm pattern
 * (ADR-362 Path B). Assigns a deterministic id + `origin: 'user-created'` and
 * persists it (localStorage) so it survives reload. Caller validates name/pattern
 * first (`validateLinePattern`); this still returns false on a name collision
 * (AutoCAD "first registration wins").
 *
 * @returns the registered def, or null if the name was already taken.
 */
export function registerUserLinetype(
  name: string,
  pattern: ReadonlyArray<number>,
  description = '',
): LinetypeDef | null {
  const trimmed = name.trim();
  if (definitionsByName.has(trimmed)) return null;
  const def: LinetypeDef = Object.freeze({
    id: userLinetypeId(trimmed),
    name: trimmed,
    description,
    pattern: Object.freeze([...pattern]) as ReadonlyArray<number>,
    origin: 'user-created',
  });
  registerLinetype(def);
  return def;
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
    if (defs.some((d) => d.origin === 'user-created')) persistUserLinetypes();
  }
  return added;
}

// ─── Test-only reset (NOT exported from index — direct import only) ──────────

/** @internal Reset to ISO baseline only. Tests only. */
export function __resetLinetypeRegistryForTesting(): void {
  const seed = buildIsoSeed();
  definitionsByName = seed.byName;
  insertionOrder = seed.order;
  // Drop any persisted user-created customs so tests start from a clean slate.
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(LS_CUSTOM_LINETYPES); } catch { /* noop */ }
  }
  // NOTE: goes through `store.reset()` (no notify, drops all listeners) — NOT
  // `rebuildSnapshot()`/`store.set()`, which would notify still-attached test
  // listeners before clearing them (byte-identical to the original silent
  // `rebuildSnapshot(); subscribers.clear();` pairing).
  store.reset(freezeSnapshot());
}
