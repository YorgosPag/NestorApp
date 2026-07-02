/**
 * ADR-563 (Auto-Dimension) — dialog store (Promise-handshake, zero-React).
 *
 * Reuses the `createConfirmStore` SSoT (mirror of
 * `column-batch-fill-confirm-store`): the command opens the dialog with the
 * initial options and awaits the user's choice; the dialog resolves with either
 * the edited options (`run`) or `cancel`. ADR-040 leaf — zero high-frequency
 * subscriptions.
 */

import { createConfirmStore } from '../../../stores/createConfirmStore';
import { AUTO_DIMENSION_DEFAULTS, type AutoDimensionOptions } from './auto-dimension-types';

export type AutoDimensionDialogState =
  | { readonly open: false }
  | { readonly open: true; readonly initialOptions: AutoDimensionOptions };

export type AutoDimensionDialogResult =
  | { readonly kind: 'run'; readonly options: AutoDimensionOptions }
  | { readonly kind: 'cancel' };

const CLOSED: AutoDimensionDialogState = { open: false };

const store = createConfirmStore<AutoDimensionDialogState, AutoDimensionDialogResult>(CLOSED);

/** Open the options dialog and resolve with the user's choice. */
export function requestAutoDimensionDialog(
  initialOptions: AutoDimensionOptions = AUTO_DIMENSION_DEFAULTS,
): Promise<AutoDimensionDialogResult> {
  return store.request({ open: true, initialOptions });
}

export function resolveAutoDimensionDialog(result: AutoDimensionDialogResult): void {
  store.resolve(result);
}

export function subscribeAutoDimensionDialog(cb: () => void): () => void {
  return store.subscribe(cb);
}

export function getAutoDimensionDialogState(): AutoDimensionDialogState {
  return store.getSnapshot();
}
