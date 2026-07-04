/**
 * ADR-570 Φ1 — In-memory named line-style registry ("Στυλ Γραμμής").
 *
 * Deliberate mirror of `systems/dimensions/dim-style-registry.ts` (ADR-362): holds
 * the 8 built-in templates plus any user-created custom styles for the active
 * session, and tracks the active style ID. Pure in-memory; project-scoped
 * persistence (Firestore + `companyId`) lands in ADR-570 ΦF.
 *
 * User-created styles use `generateLineStyleId()` (N.6 enterprise IDs). Built-in
 * templates use deterministic slugs (`line-style-templates.ts`).
 *
 * Subscriber pattern mirrors `DimStyleRegistry` — `subscribe(cb)` returns an
 * unsubscribe; mutations `notify()` all listeners and replace `cachedSnapshot`.
 */

import { generateLineStyleId } from '@/services/enterprise-id.service';
import type {
  CreateCustomLineStyleInput,
  LineStyle,
  LineStyleSnapshot,
  UpdateCustomLineStylePatch,
} from './line-style-types';
import {
  BUILTIN_LINE_STYLES,
  DEFAULT_ACTIVE_LINE_STYLE_ID,
} from './line-style-templates';

type RegistryListener = () => void;

export class LineStyleRegistry {
  private readonly styles = new Map<string, LineStyle>();
  private activeStyleId: string = DEFAULT_ACTIVE_LINE_STYLE_ID;
  private readonly listeners = new Set<RegistryListener>();
  private cachedSnapshot: LineStyleSnapshot | null = null;

  constructor() {
    for (const builtIn of BUILTIN_LINE_STYLES) {
      this.styles.set(builtIn.id, builtIn);
    }
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  getStyle(id: string): LineStyle | undefined {
    return this.styles.get(id);
  }

  getAllStyles(): readonly LineStyle[] {
    return Array.from(this.styles.values());
  }

  getActiveStyleId(): string {
    return this.activeStyleId;
  }

  /**
   * Returns a stable snapshot object for use with `useSyncExternalStore`. The same
   * reference is returned between mutations; it is replaced atomically on `notify()`.
   */
  getSnapshot(): LineStyleSnapshot {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = {
        styles: Array.from(this.styles.values()),
        activeStyleId: this.activeStyleId,
      };
    }
    return this.cachedSnapshot;
  }

  /** Returns the active style, falling back to the default built-in if missing. */
  getActiveStyle(): LineStyle {
    const active = this.styles.get(this.activeStyleId);
    if (active) return active;
    const fallback = this.styles.get(DEFAULT_ACTIVE_LINE_STYLE_ID);
    if (!fallback) {
      throw new Error('LINE_STYLE_REGISTRY_DEFAULT_MISSING');
    }
    return fallback;
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  setActiveStyleId(id: string): void {
    if (!this.styles.has(id)) {
      throw new Error(`LINE_STYLE_NOT_FOUND: ${id}`);
    }
    if (id === this.activeStyleId) return;
    this.activeStyleId = id;
    this.notify();
  }

  createCustomStyle(input: CreateCustomLineStyleInput): LineStyle {
    const id = generateLineStyleId();
    const style: LineStyle = { ...input, id, isBuiltIn: false };
    this.styles.set(id, style);
    this.notify();
    return style;
  }

  updateCustomStyle(id: string, patch: UpdateCustomLineStylePatch): LineStyle {
    const current = this.styles.get(id);
    if (!current) throw new Error(`LINE_STYLE_NOT_FOUND: ${id}`);
    if (current.isBuiltIn) throw new Error(`LINE_STYLE_BUILTIN_READONLY: ${id}`);
    const next: LineStyle = { ...current, ...patch, id: current.id, isBuiltIn: false };
    this.styles.set(id, next);
    this.notify();
    return next;
  }

  deleteCustomStyle(id: string): void {
    const current = this.styles.get(id);
    if (!current) throw new Error(`LINE_STYLE_NOT_FOUND: ${id}`);
    if (current.isBuiltIn) throw new Error(`LINE_STYLE_BUILTIN_READONLY: ${id}`);
    this.styles.delete(id);
    if (this.activeStyleId === id) {
      this.activeStyleId = DEFAULT_ACTIVE_LINE_STYLE_ID;
    }
    this.notify();
  }

  /** Clone an existing style (built-in or custom) under a new user-visible name. */
  duplicateStyle(sourceId: string, newName: string): LineStyle {
    const source = this.styles.get(sourceId);
    if (!source) throw new Error(`LINE_STYLE_NOT_FOUND: ${sourceId}`);
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('LINE_STYLE_NAME_REQUIRED');
    const { id: _id, isBuiltIn: _builtIn, ...rest } = source;
    return this.createCustomStyle({ ...rest, name: trimmed });
  }

  // ── Subscription ─────────────────────────────────────────────────────────

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.cachedSnapshot = null;
    this.listeners.forEach((cb) => cb());
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Default session singleton (lazy) + stable module-level store accessors
// ──────────────────────────────────────────────────────────────────────────────

let defaultRegistry: LineStyleRegistry | null = null;

export function getLineStyleRegistry(): LineStyleRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new LineStyleRegistry();
  }
  return defaultRegistry;
}

/** Stable `getSnapshot` for `useSyncExternalStore` (bound to the session singleton). */
export function getLineStyleSnapshot(): LineStyleSnapshot {
  return getLineStyleRegistry().getSnapshot();
}

/** Stable `subscribe` for `useSyncExternalStore` (bound to the session singleton). */
export function subscribeLineStyles(listener: () => void): () => void {
  return getLineStyleRegistry().subscribe(listener);
}

/** Test-only — replace the session singleton (reset state between unit tests). */
export function __setLineStyleRegistryForTests(registry: LineStyleRegistry | null): void {
  defaultRegistry = registry;
}
