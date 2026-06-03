'use client';

/**
 * ADR-377 Phase D — "Apply to All Levels" for subcategory styles.
 *
 * Copies the current level's per-subcategory overrides into every sibling
 * level, preserving each target level's own drawingScale / viewRange / pens
 * (only the `subcategories` block per category is overwritten). Mirrors the
 * ADR-375 B.3 `propagateToLinkedLevels` fan-out (client-side `Promise.allSettled`
 * over `updateDxfLevelWithPolicy`).
 *
 * The merge step (`mergeSubcategoriesInto`) is a pure function — unit-tested in
 * `__tests__/subcategory-propagation.service.test.ts`.
 *
 * @see services/view-template.service.ts (propagateToLinkedLevels — sibling pattern)
 */

import { updateDxfLevelWithPolicy } from '@/services/dxf-level-mutation-gateway';
import {
  resolveBimSettings,
  type BimRenderSettings,
} from '../config/bim-render-settings-types';
import {
  BIM_CATEGORIES,
  type BimCategory,
  type ObjectStyle,
} from '../config/bim-object-styles';
import type { Level } from '../systems/levels/config';

/**
 * Build a target level's next `BimRenderSettings`: keep its own scale/viewRange/
 * pens/colors, but replace each category's `subcategories` with the source's.
 * Categories with no source subcategories drop the key (no empty `{}` / no
 * Firestore `undefined`).
 */
export function mergeSubcategoriesInto(
  targetSettings: BimRenderSettings | null | undefined,
  sourceObjectStyles: Record<BimCategory, ObjectStyle>,
): BimRenderSettings {
  const resolved = resolveBimSettings(targetSettings ?? null);
  const nextStyles = { ...resolved.objectStyles };

  for (const cat of BIM_CATEGORIES) {
    const srcSubs = sourceObjectStyles[cat]?.subcategories;
    const nextCat: ObjectStyle = { ...nextStyles[cat] };
    if (srcSubs && Object.keys(srcSubs).length > 0) {
      nextCat.subcategories = cloneSubcategories(srcSubs);
    } else {
      delete nextCat.subcategories;
    }
    nextStyles[cat] = nextCat;
  }

  return {
    drawingScale: resolved.drawingScale,
    viewRange: resolved.viewRange,
    objectStyles: nextStyles,
    disciplineVisibility: resolved.disciplineVisibility,
  };
}

function cloneSubcategories(
  subs: NonNullable<ObjectStyle['subcategories']>,
): NonNullable<ObjectStyle['subcategories']> {
  const out: NonNullable<ObjectStyle['subcategories']> = {};
  for (const [key, style] of Object.entries(subs)) {
    if (style) out[key] = { ...style };
  }
  return out;
}

/**
 * Fan-out the source object styles' subcategories to every target level.
 * Returns counts; a single level failure does not abort the batch (allSettled).
 */
export async function applySubcategoriesToLevels(
  sourceObjectStyles: Record<BimCategory, ObjectStyle>,
  targetLevels: readonly Level[],
): Promise<{ updated: number; failures: unknown[] }> {
  if (targetLevels.length === 0) return { updated: 0, failures: [] };

  const results = await Promise.allSettled(
    targetLevels.map((level) =>
      updateDxfLevelWithPolicy({
        payload: {
          levelId: level.id,
          bimRenderSettings: mergeSubcategoriesInto(level.bimRenderSettings, sourceObjectStyles),
        },
      }),
    ),
  );

  const failures = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason);

  return { updated: results.length - failures.length, failures };
}
