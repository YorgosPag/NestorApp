/**
 * ADR-412 Φ5 — «Delete Wall Type» warn dialog handshake store (Q6).
 *
 * Module-level Promise handshake mirroring `wall-cascade-delete-store`: the
 * controller's delete flow calls `requestFamilyTypeDelete` and suspends until the
 * user confirms (→ detach instances + delete type) or cancels via
 * `BimFamilyTypeDeleteDialog`. `useSyncExternalStore`-compatible.
 *
 * Non-destructive: confirming detaches instances (they keep their current
 * dimensions) — never deletes geometry.
 *
 * @see ../../ui/dialogs/BimFamilyTypeDeleteDialog.tsx
 * @see ../walls/wall-cascade-delete-store.ts — sibling pattern
 */

export type FamilyTypeDeleteAction = 'delete-and-detach' | 'cancel';

export interface FamilyTypeDeleteDialogState {
  readonly open: boolean;
  readonly typeId: string | null;
  /** Instances of the type on the CURRENT scene (drives warn copy). */
  readonly affectedCount: number;
}

let _state: FamilyTypeDeleteDialogState = { open: false, typeId: null, affectedCount: 0 };
let _pendingResolve: ((action: FamilyTypeDeleteAction) => void) | null = null;
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

/** Open the warn dialog and suspend the delete flow until the user responds. */
export function requestFamilyTypeDelete(
  args: { typeId: string; affectedCount: number },
): Promise<FamilyTypeDeleteAction> {
  return new Promise<FamilyTypeDeleteAction>((resolve) => {
    _pendingResolve = resolve;
    _state = { open: true, typeId: args.typeId, affectedCount: args.affectedCount };
    _notify();
  });
}

/** Called by the dialog buttons — closes + resolves the pending promise. */
export function resolveFamilyTypeDelete(action: FamilyTypeDeleteAction): void {
  const resolve = _pendingResolve;
  _pendingResolve = null;
  _state = { open: false, typeId: null, affectedCount: 0 };
  _notify();
  resolve?.(action);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeFamilyTypeDelete(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getFamilyTypeDeleteState(): FamilyTypeDeleteDialogState {
  return _state;
}
