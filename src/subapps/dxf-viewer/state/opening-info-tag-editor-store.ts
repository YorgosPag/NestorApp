'use client';

/**
 * ADR-612 — Opening Info Tag inline cell editor store (canvas-anchored).
 *
 * Hand-rolled external store (same `createExternalStore` SSoT as
 * `DimTextOverrideStore` / `HoverStore`) that drives the inline numeric editor
 * for the 3 editable cells of an `OpeningInfoTagEntity`. Unlike the dim
 * text-override dialog this store is CANVAS-ANCHORED: it carries the screen-space
 * `anchorRect` (viewport/`position:fixed` pixels) of the double-clicked cell so
 * `<OpeningInfoTagEditorOverlay>` can position a plain numeric `<input>` exactly
 * over that cell.
 *
 * Lifecycle:
 *   openOpeningInfoTagCellEditor(entityId, cell, anchorRect, initialText)
 *     → the numeric input appears over the cell, pre-filled with its current text
 *   closeOpeningInfoTagCellEditor()
 *     → the input disappears (commit or cancel)
 *
 * @see hooks/canvas/use-opening-info-tag-double-click.ts — the sole opener
 * @see ui/opening-info-tag/OpeningInfoTagEditorOverlay.tsx — the sole reader
 * @see ui/panels/dimensions/DimTextOverrideStore.ts — the sibling store pattern
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../stores/createExternalStore';
import type { OpeningInfoTagCellId } from '../types/opening-info-tag';

/** Screen-space rectangle (viewport / `position:fixed` pixels) of the target cell. */
export interface OpeningInfoTagEditorAnchor {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Open-state payload of the inline cell editor. `null` ⇒ no editor mounted. */
export interface OpeningInfoTagEditorState {
  /** Target `OpeningInfoTagEntity` id — the `UpdateEntityCommand` subject. */
  readonly entityId: string;
  /** Which of the 3 cells is being edited (drives the patched field). */
  readonly cell: OpeningInfoTagCellId;
  /** Screen rect the `<input>` is positioned over. */
  readonly anchorRect: OpeningInfoTagEditorAnchor;
  /** The cell's current text, used as the input's initial value. */
  readonly initialText: string;
}

const store = createExternalStore<OpeningInfoTagEditorState | null>(null, {
  equals: (a, b) =>
    a?.entityId === b?.entityId &&
    a?.cell === b?.cell &&
    a?.initialText === b?.initialText &&
    a?.anchorRect.x === b?.anchorRect.x &&
    a?.anchorRect.y === b?.anchorRect.y &&
    a?.anchorRect.width === b?.anchorRect.width &&
    a?.anchorRect.height === b?.anchorRect.height,
});

/** Pure snapshot read (also the `useSyncExternalStore` server-snapshot arg). */
export function getOpeningInfoTagEditorState(): OpeningInfoTagEditorState | null {
  return store.get();
}

/** Subscribe to open/close changes; returns the unsubscribe. */
export function subscribeOpeningInfoTagEditor(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Open the inline editor for one cell, pre-filled with its current text. */
export function openOpeningInfoTagCellEditor(
  entityId: string,
  cell: OpeningInfoTagCellId,
  anchorRect: OpeningInfoTagEditorAnchor,
  initialText: string,
): void {
  store.set({ entityId, cell, anchorRect, initialText });
}

/** Close the inline editor (commit or cancel). Idempotent. */
export function closeOpeningInfoTagCellEditor(): void {
  store.set(null);
}

/** React binding — subscribes a component to the editor open-state. */
export function useOpeningInfoTagEditorStore(): OpeningInfoTagEditorState | null {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Test helper — mirrors the `DimTextOverrideStore` reset pattern. */
export function __resetOpeningInfoTagEditorStoreForTests(): void {
  store.reset(null);
}
