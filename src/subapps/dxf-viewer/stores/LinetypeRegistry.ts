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
import type { ComplexLinetypeDef } from '../config/complex-linetype-types';
import { createExternalStore } from './createExternalStore';
import { createPersistedValue } from './createPersistedValue';
import { storageRemove } from '../utils/storage-utils';

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
//
// SSoT persistence primitive (createPersistedValue = createExternalStore +
// storage-utils, WAVE 2.6 migration). The persisted shape is the picked
// `{ name, description, pattern }` triple ONLY — `id`/`origin` are re-derived
// on hydrate, byte-identical to the hand-rolled loader. `removeOnDefault` is
// intentionally OMITTED: it compares via `Object.is`, which never matches a
// fresh `[]` literal against the `[]` default reference, so an always-persist
// (`set([])` writes `"[]"` instead of removing the key) is the correct,
// documented behaviour here — not a regression.

const LS_CUSTOM_LINETYPES = 'dxf:custom-linetypes';

// ADR-642 Φ2 — a text/symbol/compound linetype is not expressible as `pattern`; the full
// `complex` def is persisted alongside so an authored `──GAS──` survives reload (the
// `pattern` still holds the geometry-only fallback for the simple render/DXF fast-path).
type PersistedUserLinetype = Pick<LinetypeDef, 'name' | 'description' | 'pattern'> & {
  readonly complex?: ComplexLinetypeDef;
};

/** Deterministic, ASCII, RNG-free id from a (unique) name — `ltp_<base36 hash>`. */
function userLinetypeId(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return `ltp_${Math.abs(h).toString(36)}`;
}

/** Light structural guard for a persisted complex def (ADR-642 Φ2) — object with ≥1 layer. */
function isPlausibleComplex(v: unknown): v is ComplexLinetypeDef {
  if (!v || typeof v !== 'object') return false;
  const layers = (v as { layers?: unknown }).layers;
  return Array.isArray(layers) && layers.length > 0;
}

/** Hydrate-time validation — reproduces the old `Array.isArray` + per-entry guard exactly. */
function sanitizeHydratedCustoms(hydrated: PersistedUserLinetype[]): PersistedUserLinetype[] {
  const raw: unknown = hydrated;
  if (!Array.isArray(raw)) return [];
  const out: PersistedUserLinetype[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { name, description, pattern, complex } = entry as Record<string, unknown>;
    if (typeof name !== 'string' || name.length === 0) continue;
    if (!Array.isArray(pattern) || !pattern.every((v) => typeof v === 'number' && Number.isFinite(v))) continue;
    out.push({
      name,
      description: typeof description === 'string' ? description : '',
      pattern: Object.freeze([...pattern]) as ReadonlyArray<number>,
      ...(isPlausibleComplex(complex) ? { complex } : {}),
    });
  }
  return out;
}

const customLinetypesStore = createPersistedValue<PersistedUserLinetype[]>(
  LS_CUSTOM_LINETYPES,
  [],
  { validate: sanitizeHydratedCustoms },
);

function persistUserLinetypes(): void {
  const customs: PersistedUserLinetype[] = [];
  for (const name of insertionOrder) {
    const def = definitionsByName.get(name);
    if (def && def.origin === 'user-created') {
      customs.push({
        name: def.name,
        description: def.description,
        pattern: [...def.pattern],
        ...(def.complex ? { complex: def.complex } : {}),
      });
    }
  }
  customLinetypesStore.set(customs);
}

// Hydrate persisted customs on top of the ISO seed, BEFORE the snapshot store is
// built, so the very first `listLinetypes()` already exposes them.
for (const custom of customLinetypesStore.get()) {
  if (!definitionsByName.has(custom.name)) {
    const def: LinetypeDef = Object.freeze({
      id: userLinetypeId(custom.name),
      name: custom.name,
      description: custom.description,
      pattern: Object.freeze([...custom.pattern]) as ReadonlyArray<number>,
      origin: 'user-created',
      ...(custom.complex ? { complex: custom.complex } : {}),
    });
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
  complex?: ComplexLinetypeDef,
): LinetypeDef | null {
  const trimmed = name.trim();
  if (definitionsByName.has(trimmed)) return null;
  const def: LinetypeDef = Object.freeze({
    id: userLinetypeId(trimmed),
    name: trimmed,
    description,
    pattern: Object.freeze([...pattern]) as ReadonlyArray<number>,
    origin: 'user-created',
    // ADR-642 Φ2 — carry the full complex def (embedded text/symbols) when the type
    // is not simple-expressible; simple types leave it undefined and keep `pattern` SSoT.
    ...(complex ? { complex } : {}),
  });
  registerLinetype(def);
  return def;
}

/**
 * Create OR update-in-place a USER-CREATED linetype (ADR-510 Φ2E #4, COW live edit).
 *
 * Unlike `registerUserLinetype` (AutoCAD "first registration wins" — refuses an
 * existing name), this is the copy-on-write mutation the inline «Τμήματα Μοτίβου»
 * editor drives on every segment edit: the per-line owned name (`linePatternName`)
 * is created on the first edit and its pattern updated IN PLACE on subsequent ones.
 *
 * ISO baseline / catalog names stay IMMUTABLE (module contract): an existing entry
 * that is NOT `user-created` is never overwritten → returns null. A new name is
 * registered fresh; an existing user-created name has its pattern + description
 * replaced (id/origin preserved, deterministic). Persists + notifies exactly once.
 *
 * @returns the upserted def, or null if the name collides with a non-user entry.
 */
export function upsertUserLinetype(
  name: string,
  pattern: ReadonlyArray<number>,
  description = '',
): LinetypeDef | null {
  const trimmed = name.trim();
  const existing = definitionsByName.get(trimmed);
  if (existing && existing.origin !== 'user-created') return null;
  if (!existing) return registerUserLinetype(trimmed, pattern, description);
  const def: LinetypeDef = Object.freeze({
    id: existing.id,
    name: existing.name,
    description,
    pattern: Object.freeze([...pattern]) as ReadonlyArray<number>,
    origin: 'user-created',
  });
  // Same name → insertionOrder unchanged; only the Map entry + snapshot rebuild.
  definitionsByName.set(def.name, def);
  rebuildSnapshot();
  persistUserLinetypes();
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
  storageRemove(LS_CUSTOM_LINETYPES);
  // NOTE: goes through `.reset()` (no notify, drops all listeners) — NOT
  // `persistUserLinetypes()`/`rebuildSnapshot()`, which would notify still-attached
  // test listeners before clearing them (byte-identical to the original silent
  // `rebuildSnapshot(); subscribers.clear();` pairing).
  customLinetypesStore.reset([]);
  store.reset(freezeSnapshot());
}
