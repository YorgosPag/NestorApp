/**
 * Shared write-side function types for the hatch bridge dual-mode dispatchers.
 *
 * `hatch-bridge-number-write.ts` and `hatch-contour-bridge.ts` both apply either an
 * `UpdateEntityCommand` patch to a selected hatch, or a flat patch to the
 * draw-defaults store when nothing is selected. ONE shared shape here (N.18 — the two
 * dispatcher signatures repeating the same inline function-type literals is exactly the
 * sibling-clone jscpd (CHECK 3.28) exists to catch, even though the branch LOGIC differs).
 */

import type { HatchEntity } from '../../../../types/entities';
import type { HatchDrawDefaults } from '../../../../bim/hatch/hatch-draw-defaults-store';

/** Apply an `UpdateEntityCommand` patch to a selected hatch. */
export type PatchHatchFn = (hatch: HatchEntity, patch: Record<string, unknown>) => void;

/** Apply a flat patch to the hatch draw-defaults store (no-selection mode). */
export type SetHatchDrawDefaultsFn = (patch: Partial<HatchDrawDefaults>) => void;
