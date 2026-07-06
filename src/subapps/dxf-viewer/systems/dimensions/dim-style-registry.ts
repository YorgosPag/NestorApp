/**
 * ADR-362 Phase A2 — In-memory DIMSTYLE registry.
 *
 * Holds the 3 built-in templates (ISO 129 / ASME Y14.5 / Architectural US) plus
 * any user-created custom styles for the active session. Tracks the active
 * style ID. Pure in-memory; project-scoped persistence lands in Phase F.
 *
 * User-created styles use `generateDimStyleId()` (N.6 enterprise IDs). Built-in
 * templates use deterministic slugs (see `dim-style-templates.ts`).
 *
 * Subscriber pattern mirrors `systems/hover/HoverStore.ts` — `subscribe(cb)`
 * returns an unsubscribe; mutations notify all listeners.
 */

import { generateDimStyleId } from '@/services/enterprise-id.service';
import type { DimStyle } from '../../types/dimension';
import {
  BUILTIN_DIM_STYLES,
  DEFAULT_ACTIVE_DIM_STYLE_ID,
} from './dim-style-templates';
import { createExternalStore } from '../../stores/createExternalStore';

type RegistryListener = () => void;

export type CreateCustomStyleInput = Omit<DimStyle, 'id' | 'isBuiltIn'>;
export type UpdateCustomStylePatch = Partial<Omit<DimStyle, 'id' | 'isBuiltIn'>>;

export interface DimStyleSnapshot {
  readonly styles: readonly DimStyle[];
  readonly activeStyleId: string;
}

export class DimStyleRegistry {
  private readonly styles = new Map<string, DimStyle>();
  private activeStyleId: string = DEFAULT_ACTIVE_DIM_STYLE_ID;
  // SSoT pub/sub via createExternalStore (WAVE 2.7). Carries ONLY the version-signal
  // integer; `styles`/`activeStyleId`/`cachedSnapshot` stay plain fields as mutation
  // accelerators — consumers re-read them via `getSnapshot()`/`getStyle()` on notify.
  private readonly store = createExternalStore<number>(0);
  private cachedSnapshot: DimStyleSnapshot | null = null;

  constructor() {
    for (const builtIn of BUILTIN_DIM_STYLES) {
      this.styles.set(builtIn.id, builtIn);
    }
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  getStyle(id: string): DimStyle | undefined {
    return this.styles.get(id);
  }

  getAllStyles(): readonly DimStyle[] {
    return Array.from(this.styles.values());
  }

  getActiveStyleId(): string {
    return this.activeStyleId;
  }

  /**
   * Returns a stable snapshot object for use with `useSyncExternalStore`.
   * The same object reference is returned between mutations; it is replaced
   * atomically on every `notify()` call.
   */
  getSnapshot(): DimStyleSnapshot {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = {
        styles: Array.from(this.styles.values()),
        activeStyleId: this.activeStyleId,
      };
    }
    return this.cachedSnapshot;
  }

  /** Returns the active style, falling back to the default built-in if missing. */
  getActiveStyle(): DimStyle {
    const active = this.styles.get(this.activeStyleId);
    if (active) return active;
    const fallback = this.styles.get(DEFAULT_ACTIVE_DIM_STYLE_ID);
    if (!fallback) {
      throw new Error('DIM_STYLE_REGISTRY_DEFAULT_MISSING');
    }
    return fallback;
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  setActiveStyleId(id: string): void {
    if (!this.styles.has(id)) {
      throw new Error(`DIM_STYLE_NOT_FOUND: ${id}`);
    }
    if (id === this.activeStyleId) return;
    this.activeStyleId = id;
    this.notify();
  }

  createCustomStyle(input: CreateCustomStyleInput): DimStyle {
    const id = generateDimStyleId();
    const style: DimStyle = { ...input, id, isBuiltIn: false };
    this.styles.set(id, style);
    this.notify();
    return style;
  }

  updateCustomStyle(id: string, patch: UpdateCustomStylePatch): DimStyle {
    const current = this.styles.get(id);
    if (!current) throw new Error(`DIM_STYLE_NOT_FOUND: ${id}`);
    if (current.isBuiltIn) throw new Error(`DIM_STYLE_BUILTIN_READONLY: ${id}`);
    const next: DimStyle = { ...current, ...patch, id: current.id, isBuiltIn: false };
    this.styles.set(id, next);
    this.notify();
    return next;
  }

  deleteCustomStyle(id: string): void {
    const current = this.styles.get(id);
    if (!current) throw new Error(`DIM_STYLE_NOT_FOUND: ${id}`);
    if (current.isBuiltIn) throw new Error(`DIM_STYLE_BUILTIN_READONLY: ${id}`);
    this.styles.delete(id);
    if (this.activeStyleId === id) {
      this.activeStyleId = DEFAULT_ACTIVE_DIM_STYLE_ID;
    }
    this.notify();
  }

  /**
   * ADR-362 Phase F4 — hydrate persisted CUSTOM styles from Firestore into the
   * live registry, keyed BY THEIR DB id (not a fresh id) so entity `styleId`
   * references keep resolving across reloads. Upsert-only: built-ins are never
   * clobbered (id-collision guard) and custom styles absent from the payload are
   * NOT removed here — deletions flow through `deleteCustomStyle` explicitly, so
   * an optimistic just-created style is never wiped before its persist round-trip.
   * Skips `notify()` when nothing actually changed (ADR-040 render-loop guard;
   * the subscribe layer already drops same-content deliveries upstream).
   */
  hydrateCustomStyles(styles: readonly DimStyle[]): void {
    if (styles.length === 0) return;
    let changed = false;
    for (const incoming of styles) {
      const existing = this.styles.get(incoming.id);
      if (existing?.isBuiltIn) continue; // never let a DB row shadow a built-in
      const next: DimStyle = { ...incoming, isBuiltIn: false };
      if (existing && JSON.stringify(existing) === JSON.stringify(next)) continue;
      this.styles.set(incoming.id, next);
      changed = true;
    }
    if (changed) this.notify();
  }

  /** Clone an existing style (built-in or custom) under a new user-visible name. */
  duplicateStyle(sourceId: string, newName: string): DimStyle {
    const source = this.styles.get(sourceId);
    if (!source) throw new Error(`DIM_STYLE_NOT_FOUND: ${sourceId}`);
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('DIM_STYLE_NAME_REQUIRED');
    const { id: _id, isBuiltIn: _builtIn, ...rest } = source;
    return this.createCustomStyle({ ...rest, name: trimmed });
  }

  // ── Subscription ─────────────────────────────────────────────────────────

  subscribe(listener: RegistryListener): () => void {
    return this.store.subscribe(listener);
  }

  private notify(): void {
    this.cachedSnapshot = null;
    this.store.set(this.store.get() + 1);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Default session singleton (lazy)
// ──────────────────────────────────────────────────────────────────────────────

let defaultRegistry: DimStyleRegistry | null = null;

export function getDimStyleRegistry(): DimStyleRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new DimStyleRegistry();
  }
  return defaultRegistry;
}

/** Test-only — replace the session singleton (e.g. to reset state between unit tests). */
export function __setDimStyleRegistryForTests(registry: DimStyleRegistry | null): void {
  defaultRegistry = registry;
}
