/**
 * ADR-376 Phase C.2 — Per-project Opening Tag styling override service.
 *
 * Singleton SSoT για τα 6 customisable fields του opening-tag pill + leader:
 *   - `fontSizePx`      (default 9, range 7-16)
 *   - `borderWidthPx`   (default 1, range 0-3)
 *   - `leaderStyle`     ('solid' | 'dashed' | 'dotted', default 'solid')
 *   - `pillBgColor`     (default canvas-pill `PILL_BG_COLOR`)
 *   - `leaderColor`     (default '#7a8696' — neutral grey)
 *   - `leaderVisible`   (default true)
 *
 * Architecture (3-layer, ADR-040 compliant):
 *   1. Service (this file) — pure state + debounced Firestore write + subscribe.
 *   2. Renderer (`OpeningTagRenderer`) — sync `getCurrentStyle()` per render.
 *   3. UI Dialog (`OpeningTagStyleDialog`) — mutateStyle() via debounced flow.
 *
 * ADR-040: ZERO React. ZERO `useSyncExternalStore`. Renderer reads via sync
 * getter (mirroring `useDrawingScaleStore.getState()` pattern). Subscriptions
 * only fired on commit (debounced) — bitmap cache invalidates ONCE per drag.
 *
 * Persistence DI: caller injects `setPersister()` (the React Host wires
 * `updateProjectWithPolicy`). Service stays pure for unit tests.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §4.11 (Phase C.2)
 */

import { PILL_BG_COLOR } from '../../rendering/utils/canvas-pill';
import { DXF_TIMING } from '../../config/dxf-timing';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export type OpeningTagLeaderStyle = 'solid' | 'dashed' | 'dotted';

/** Persisted Firestore shape — all fields optional, undefined stripped on write. */
export interface OpeningTagStyle {
  readonly fontSizePx?: number;
  readonly borderWidthPx?: number;
  readonly leaderStyle?: OpeningTagLeaderStyle;
  readonly pillBgColor?: string;
  readonly leaderColor?: string;
  readonly leaderVisible?: boolean;
}

/** Render-time resolved shape — every field always defined (from defaults). */
export interface ResolvedOpeningTagStyle {
  readonly fontSizePx: number;
  readonly borderWidthPx: number;
  readonly leaderStyle: OpeningTagLeaderStyle;
  readonly pillBgColor: string;
  readonly leaderColor: string;
  readonly leaderVisible: boolean;
}

export type OpeningTagStylePersister = (
  projectId: string,
  style: OpeningTagStyle,
) => Promise<void>;

// ────────────────────────────────────────────────────────────────────────────
// DEFAULTS + VALIDATION RANGES
// ────────────────────────────────────────────────────────────────────────────

export const OPENING_TAG_STYLE_DEFAULTS: ResolvedOpeningTagStyle = {
  fontSizePx: 9,
  borderWidthPx: 1,
  leaderStyle: 'solid',
  pillBgColor: PILL_BG_COLOR,
  leaderColor: '#7a8696',
  leaderVisible: true,
};

export const OPENING_TAG_STYLE_RANGES = {
  fontSizePx: { min: 7, max: 16 },
  borderWidthPx: { min: 0, max: 3 },
} as const;

const LEADER_STYLE_VALUES: ReadonlySet<OpeningTagLeaderStyle> = new Set([
  'solid',
  'dashed',
  'dotted',
]);

const DEBOUNCE_MS = DXF_TIMING.ui.COMMIT_DEBOUNCE; // ADR-516

// ────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a possibly-partial Firestore-loaded style against defaults. Invalid
 * values (NaN, out of range, unknown leader style) silently fall back to the
 * default — never throws, so legacy / corrupted documents stay renderable.
 */
export function resolveOpeningTagStyle(
  partial: OpeningTagStyle | null | undefined,
): ResolvedOpeningTagStyle {
  if (!partial) return OPENING_TAG_STYLE_DEFAULTS;
  return {
    fontSizePx: clampNumber(
      partial.fontSizePx,
      OPENING_TAG_STYLE_RANGES.fontSizePx.min,
      OPENING_TAG_STYLE_RANGES.fontSizePx.max,
      OPENING_TAG_STYLE_DEFAULTS.fontSizePx,
    ),
    borderWidthPx: clampNumber(
      partial.borderWidthPx,
      OPENING_TAG_STYLE_RANGES.borderWidthPx.min,
      OPENING_TAG_STYLE_RANGES.borderWidthPx.max,
      OPENING_TAG_STYLE_DEFAULTS.borderWidthPx,
    ),
    leaderStyle: LEADER_STYLE_VALUES.has(partial.leaderStyle as OpeningTagLeaderStyle)
      ? (partial.leaderStyle as OpeningTagLeaderStyle)
      : OPENING_TAG_STYLE_DEFAULTS.leaderStyle,
    pillBgColor: typeof partial.pillBgColor === 'string' && partial.pillBgColor.length > 0
      ? partial.pillBgColor
      : OPENING_TAG_STYLE_DEFAULTS.pillBgColor,
    leaderColor: typeof partial.leaderColor === 'string' && partial.leaderColor.length > 0
      ? partial.leaderColor
      : OPENING_TAG_STYLE_DEFAULTS.leaderColor,
    leaderVisible: typeof partial.leaderVisible === 'boolean'
      ? partial.leaderVisible
      : OPENING_TAG_STYLE_DEFAULTS.leaderVisible,
  };
}

/**
 * Strip undefined fields από payload — Firestore rejects `undefined`. Returns
 * an object with only the fields that have non-default-and-defined values.
 * Empty result means "fall back to defaults" — caller may delete the field.
 */
export function stripUndefined(style: OpeningTagStyle): OpeningTagStyle {
  const out: { -readonly [K in keyof OpeningTagStyle]: OpeningTagStyle[K] } = {};
  if (style.fontSizePx !== undefined) out.fontSizePx = style.fontSizePx;
  if (style.borderWidthPx !== undefined) out.borderWidthPx = style.borderWidthPx;
  if (style.leaderStyle !== undefined) out.leaderStyle = style.leaderStyle;
  if (style.pillBgColor !== undefined) out.pillBgColor = style.pillBgColor;
  if (style.leaderColor !== undefined) out.leaderColor = style.leaderColor;
  if (style.leaderVisible !== undefined) out.leaderVisible = style.leaderVisible;
  return out;
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// ────────────────────────────────────────────────────────────────────────────
// SINGLETON SERVICE
// ────────────────────────────────────────────────────────────────────────────

class OpeningTagStyleServiceImpl {
  private currentProjectId: string | null = null;
  private rawStyle: OpeningTagStyle = {};
  private resolved: ResolvedOpeningTagStyle = OPENING_TAG_STYLE_DEFAULTS;
  private subscribers = new Set<() => void>();
  private persister: OpeningTagStylePersister | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingWrite: OpeningTagStyle | null = null;

  getCurrentStyle(): ResolvedOpeningTagStyle {
    return this.resolved;
  }

  /**
   * Initialise / re-hydrate from a Project document. Cancels any pending
   * debounced write — switching projects should not bleed mutations across.
   */
  hydrate(projectId: string, source: { openingTagStyle?: OpeningTagStyle | null }): void {
    this.cancelDebounce();
    this.currentProjectId = projectId;
    this.rawStyle = source.openingTagStyle ?? {};
    this.resolved = resolveOpeningTagStyle(this.rawStyle);
    this.notifySubscribers();
  }

  /**
   * Merge `patch` into the in-memory state, recompute resolved style,
   * notify subscribers IMMEDIATELY (optimistic live preview), then schedule
   * a debounced Firestore write 200 ms later.
   */
  mutateStyle(patch: Partial<OpeningTagStyle>): void {
    const next: OpeningTagStyle = { ...this.rawStyle, ...patch };
    const cleaned = stripUndefined(next);
    this.rawStyle = cleaned;
    this.resolved = resolveOpeningTagStyle(cleaned);
    this.notifySubscribers();

    this.pendingWrite = cleaned;
    this.scheduleDebouncedWrite();
  }

  /** Reset to defaults — writes empty object (or `null` if Firestore-friendly). */
  reset(): void {
    this.rawStyle = {};
    this.resolved = OPENING_TAG_STYLE_DEFAULTS;
    this.notifySubscribers();
    this.pendingWrite = {};
    this.scheduleDebouncedWrite();
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  setPersister(persister: OpeningTagStylePersister | null): void {
    this.persister = persister;
  }

  /** Test-only — drain pending debounce + return the captured payload. */
  __flushForTests(): OpeningTagStyle | null {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const payload = this.pendingWrite;
    if (payload !== null && this.persister && this.currentProjectId) {
      void this.persister(this.currentProjectId, payload);
    }
    this.pendingWrite = null;
    return payload;
  }

  /** Test-only — reset whole singleton between tests. */
  __resetForTests(): void {
    this.cancelDebounce();
    this.currentProjectId = null;
    this.rawStyle = {};
    this.resolved = OPENING_TAG_STYLE_DEFAULTS;
    this.subscribers.clear();
    this.persister = null;
    this.pendingWrite = null;
  }

  // ── internal ──────────────────────────────────────────────────────────────

  private notifySubscribers(): void {
    this.subscribers.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[opening-tag-style-service] subscriber threw', err);
      }
    });
  }

  private cancelDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingWrite = null;
  }

  private scheduleDebouncedWrite(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      const payload = this.pendingWrite;
      this.pendingWrite = null;
      if (payload === null) return;
      if (!this.persister || !this.currentProjectId) return;
      void this.persister(this.currentProjectId, payload).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[opening-tag-style-service] persister failed', err);
      });
    }, DEBOUNCE_MS);
  }
}

const SINGLETON = new OpeningTagStyleServiceImpl();

export function getOpeningTagStyleService(): OpeningTagStyleServiceImpl {
  return SINGLETON;
}

/**
 * Convenience accessor used by the renderer at render time. Sync — never
 * triggers a subscription. Matches `useDrawingScaleStore.getState()` pattern.
 */
export function getCurrentOpeningTagStyle(): ResolvedOpeningTagStyle {
  return SINGLETON.getCurrentStyle();
}
