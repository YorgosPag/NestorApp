/**
 * ADR-377 Phase D — pure object-style transform helpers extracted from
 * `bim-render-settings-store.ts` (SRP / Google 500-line limit). No `set`/`get`/
 * `debounceWrite` dependency — purely immutable style-map transforms.
 */

import {
  DEFAULT_OBJECT_STYLES,
  type BimCategory,
  type ObjectStyle,
  type SubcategoryStyle,
} from '../config/bim-object-styles';

/** Immutably transform one subcategory's style under a category. */
export function withSubcategoryStyle(
  styles: Record<BimCategory, ObjectStyle>,
  category: BimCategory,
  subcategoryKey: string,
  transform: (prev: SubcategoryStyle) => SubcategoryStyle,
): Record<BimCategory, ObjectStyle> {
  const prev = styles[category];
  const prevSubs = prev.subcategories ?? {};
  const nextSub = transform(prevSubs[subcategoryKey] ?? {});
  const nextCat: ObjectStyle = {
    ...prev,
    subcategories: { ...prevSubs, [subcategoryKey]: nextSub },
  };
  return { ...styles, [category]: nextCat };
}

/**
 * Return a copy of `style` with its `subcategories` reset to the category's
 * defaults. When the category has no default subcategories the key is dropped
 * entirely (avoids persisting empty `subcategories: {}` noise + Firestore
 * undefined writes).
 */
export function withDefaultSubcategories(style: ObjectStyle, category: BimCategory): ObjectStyle {
  const def = DEFAULT_OBJECT_STYLES[category].subcategories;
  const next: ObjectStyle = { ...style };
  if (!def) {
    delete next.subcategories;
    return next;
  }
  const cloned: Partial<Record<string, SubcategoryStyle>> = {};
  for (const [key, sub] of Object.entries(def)) {
    if (sub) cloned[key] = { ...sub };
  }
  if (Object.keys(cloned).length === 0) delete next.subcategories;
  else next.subcategories = cloned;
  return next;
}
