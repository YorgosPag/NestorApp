'use client';

/**
 * ADR-375 Phase B.3 — View Template Store (Zustand, Firestore-backed list).
 *
 * Caches the tenant's `view_templates` list and exposes a single subscribe
 * lifecycle (mount-once → live updates). UI consumers (`ViewTemplatesPanel`,
 * dialogs) read templates via selectors; mutations route through the service
 * (`view-template.service.ts`) and Firestore snapshots feed the cache back
 * into the store via `subscribeViewTemplates`.
 *
 * The store deliberately mirrors the `bim-render-settings-store` shape:
 *   - flat list + isLoading + error
 *   - explicit `startSubscription(unsub)` / `stopSubscription()` lifecycle
 *   - no debounced writes (templates are user-driven, not high-frequency)
 *
 * Selected-template-per-level is intentionally NOT kept here — that state
 * lives on `Level.appliedViewTemplateId` (Firestore-persisted, ADR-355
 * subscription delivers it). The store only owns the templates *catalog*.
 */

import { create } from 'zustand';
import type { Unsubscribe } from 'firebase/firestore';
import type { ViewTemplate } from '../config/view-template-types';
import { subscribeViewTemplates } from '../services/view-template.service';

interface ViewTemplateState {
  templates: ViewTemplate[];
  isLoading: boolean;
  error: string | null;
  /** Tracks the active Firestore subscription so we can tear it down. */
  unsubscribe: Unsubscribe | null;

  /** Idempotent: returns the existing unsub if already subscribed. */
  subscribe: () => Unsubscribe;
  /** Tears down the active subscription (no-op if not subscribed). */
  unsubscribeAll: () => void;

  /** Lookup helpers — pure selectors over `templates`. */
  getById: (templateId: string) => ViewTemplate | null;
  getLinkedLevelCount: (templateId: string, levelFKs: readonly (string | null | undefined)[]) => number;
}

export const useViewTemplateStore = create<ViewTemplateState>((set, get) => ({
  templates: [],
  isLoading: false,
  error: null,
  unsubscribe: null,

  subscribe() {
    const existing = get().unsubscribe;
    if (existing) return existing;

    set({ isLoading: true, error: null });

    const unsub = subscribeViewTemplates(
      (templates) => set({ templates, isLoading: false, error: null }),
      (err) => set({ error: err.message, isLoading: false }),
    );

    set({ unsubscribe: unsub });
    return unsub;
  },

  unsubscribeAll() {
    const unsub = get().unsubscribe;
    if (unsub) {
      unsub();
      set({ unsubscribe: null, templates: [], isLoading: false });
    }
  },

  getById(templateId) {
    return get().templates.find((t) => t.id === templateId) ?? null;
  },

  getLinkedLevelCount(templateId, levelFKs) {
    return levelFKs.filter((fk) => fk === templateId).length;
  },
}));
