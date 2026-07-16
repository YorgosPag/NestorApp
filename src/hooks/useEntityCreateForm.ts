'use client';

/**
 * useEntityCreateForm — the inline «new item» form's state, once.
 *
 * The space-management pages create entities by reusing their GeneralTab in create mode rather than
 * a separate form (single source of truth for the fields). That pattern needs the same three things
 * every time: whether the form is showing, a way to close it, and a ref the tab fills in with its
 * save function so the page's header button can trigger it. Parking and Storages each declared all
 * three by hand.
 *
 * `createSaveRef` is a ref, not state, deliberately: the tab assigns to it during render/effect and
 * the header reads it at click time. Making it state would re-render the page on every mount of the
 * form for a value nothing renders.
 *
 * @module hooks/useEntityCreateForm
 * @enterprise ADR-584 — Anti-Duplication
 */

import { useState, useRef, useCallback, type MutableRefObject } from 'react';

/** The tab's save function: resolves true when the entity was actually created. */
type CreateSaveFn = () => Promise<boolean>;

export interface EntityCreateForm {
  /** Whether the inline create form is showing. */
  showCreateForm: boolean;
  /** Open the create form. Callers typically clear the selection alongside this. */
  openCreateForm: () => void;
  /** Close the create form — on cancel, and after a successful create. */
  resetCreateForm: () => void;
  /** Filled in by the GeneralTab in create mode; invoked by the page's save action. */
  createSaveRef: MutableRefObject<CreateSaveFn | null>;
}

export function useEntityCreateForm(): EntityCreateForm {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const createSaveRef = useRef<CreateSaveFn | null>(null);

  const openCreateForm = useCallback(() => setShowCreateForm(true), []);
  const resetCreateForm = useCallback(() => setShowCreateForm(false), []);

  return { showCreateForm, openCreateForm, resetCreateForm, createSaveRef };
}
