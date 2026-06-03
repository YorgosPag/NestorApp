/**
 * ADR-377 Phase D — Subcategories panel tab model (SSoT, pure data).
 *
 * Derives the per-tab grouping from the `SUBCATEGORY_TAXONOMY` SSoT. Most BIM
 * categories map to a single tab (all their subcategory keys). The `opening`
 * category is split into THREE ArchiCAD-style tabs (Door / Window / Cutout)
 * by key prefix — but every split tab still writes back to the single
 * `'opening'` BimCategory, so the store/persistence model is unchanged.
 *
 * Pure module — no React, no store. Unit-tested in `__tests__/subcategory-tabs.test.ts`.
 */

import { SUBCATEGORY_TAXONOMY } from '../../../config/bim-subcategories';
import type { BimCategory } from '../../../config/bim-object-styles';

export interface SubcategoryTab {
  /** Unique tab id (e.g. 'wall', 'opening-door'). */
  readonly id: string;
  /** i18n key under `ribbon.commands.subcategories.tabs.*`. */
  readonly labelKey: string;
  /** Store writes target this BimCategory (the opening split tabs all use 'opening'). */
  readonly category: BimCategory;
  /** Subcategory keys shown in this tab. */
  readonly keys: readonly string[];
}

/** `opening` (15 keys) is presented as 3 prefix-grouped tabs. */
const OPENING_GROUPS: ReadonlyArray<{
  id: string;
  labelKey: string;
  match: (key: string) => boolean;
}> = [
  {
    id: 'opening-door',
    labelKey: 'ribbon.commands.subcategories.tabs.door',
    match: (k) => k.startsWith('door-') || k === 'sliding-track',
  },
  {
    id: 'opening-window',
    labelKey: 'ribbon.commands.subcategories.tabs.window',
    match: (k) => k.startsWith('window-'),
  },
  {
    id: 'opening-cutout',
    labelKey: 'ribbon.commands.subcategories.tabs.cutout',
    match: (k) => k.startsWith('wall-cutout-'),
  },
];

function singleTab(category: BimCategory): SubcategoryTab {
  return {
    id: category,
    labelKey: `ribbon.commands.subcategories.tabs.${category}`,
    category,
    keys: SUBCATEGORY_TAXONOMY[category],
  };
}

/**
 * Ordered tab list for the Subcategories dialog (Revit/ArchiCAD reading order):
 * Wall → Slab → Column → Beam → Door → Window → Cutout → Stair → SlabOpening.
 */
export function getSubcategoryTabs(): readonly SubcategoryTab[] {
  const openingTabs: SubcategoryTab[] = OPENING_GROUPS.map((g) => ({
    id: g.id,
    labelKey: g.labelKey,
    category: 'opening' as BimCategory,
    keys: SUBCATEGORY_TAXONOMY.opening.filter(g.match),
  }));

  return [
    singleTab('wall'),
    singleTab('slab'),
    singleTab('column'),
    singleTab('beam'),
    ...openingTabs,
    singleTab('stair'),
    singleTab('slab-opening'),
  ];
}
