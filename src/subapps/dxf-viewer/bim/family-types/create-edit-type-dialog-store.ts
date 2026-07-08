/**
 * ADR-603 Φ2 — «Edit {X} Type» dialog open/close handshake store factory (SSoT).
 *
 * Every BIM family-typed entity (wall / slab / roof / opening / …) shipped a
 * byte-identical `edit-{x}-type-store` module: a module-level `createExternalStore`
 * singleton (ADR-040 SSoT store idiom) holding `{ open, typeId }`, with
 * `open{X}` / `close{X}` / `subscribe{X}` / `get{X}State` wrappers. Only the entity
 * name in the identifiers differed. This factory owns the store body once; each
 * entity module binds one instance and re-exports the four functions under its
 * entity-named identifiers (zero blast radius on the existing consumers).
 *
 * No Promise handshake — the dialog opens for a `typeId` and closes; the edit
 * itself goes through the controller's undoable command.
 *
 * Invariant: one Edit-Type dialog at a time per entity (user-driven, synchronous
 * open). Identity-guarded (`equals: Object.is`): each open/close produces a new
 * object so real changes always notify, while a redundant close no-ops.
 *
 * @see ../../stores/createExternalStore — SSoT pub/sub primitive (notify plumbing)
 * @see docs/centralized-systems/reference/adrs/ADR-603-generic-family-type-framework.md
 */

import { createExternalStore } from '../../stores/createExternalStore';

/** Open/close state of an Edit-Type dialog. Shared shape across all entities. */
export interface EditTypeDialogState {
  readonly open: boolean;
  readonly typeId: string | null;
}

/** The four `useSyncExternalStore`-compatible handles a bound store exposes. */
export interface EditTypeDialogStore {
  /** Open the Edit-Type dialog for a given family type. */
  readonly open: (typeId: string) => void;
  /** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
  readonly close: () => void;
  /** useSyncExternalStore-compatible subscribe. */
  readonly subscribe: (cb: () => void) => () => void;
  /** useSyncExternalStore-compatible snapshot getter. Same ref between changes. */
  readonly getState: () => EditTypeDialogState;
}

const CLOSED: EditTypeDialogState = { open: false, typeId: null };

/** Build one isolated Edit-Type dialog store instance. */
export function createEditTypeDialogStore(): EditTypeDialogStore {
  const store = createExternalStore<EditTypeDialogState>(CLOSED, { equals: Object.is });
  return {
    open: (typeId: string) => store.set({ open: true, typeId }),
    close: () => {
      if (store.get().open) store.set(CLOSED);
    },
    subscribe: (cb: () => void) => store.subscribe(cb),
    getState: () => store.get(),
  };
}
