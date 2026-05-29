/**
 * ADR-397 — back-compat re-export shim. The wall-rotation hot-grip store was
 * generalized to the entity-agnostic `BimRotateHotGripStore` in
 * `bim/grips/bim-rotate-hotgrip-store.ts` (so columns + future entities share
 * one rotate-context bridge). This shim keeps the old import path working.
 *
 * @deprecated import `BimRotateHotGripStore` from `bim/grips/bim-rotate-hotgrip-store` instead.
 */
export { BimRotateHotGripStore } from '../grips/bim-rotate-hotgrip-store';
/** @deprecated renamed to `BimRotateHotGripStore`. */
export { BimRotateHotGripStore as WallRotateHotGripStore } from '../grips/bim-rotate-hotgrip-store';
