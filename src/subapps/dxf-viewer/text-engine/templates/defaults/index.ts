/**
 * ADR-344 Phase 7.A — Built-in template registry.
 *
 * Aggregates every built-in `BuiltInTextTemplate` shipped with the engine.
 * Consumers (management UI in Phase 7.D, Firestore template service in
 * Phase 7.B) read from this registry; user templates from Firestore
 * extend rather than replace it.
 */

import type { BuiltInTextTemplate, TextTemplateCategory } from '../template.types';
import { TITLE_BLOCK_DEFAULTS } from './title-blocks';
import { STAMP_DEFAULTS } from './stamps';
import { NOTES_DEFAULTS } from './notes';
import { REVISION_DEFAULTS } from './revision';
import { SCALE_BAR_DEFAULTS } from './scale-bar';

export {
  TITLE_BLOCK_EL,
  TITLE_BLOCK_EN,
  TITLE_BLOCK_DEFAULTS,
} from './title-blocks';
export {
  SIGNOFF_STAMP_EL,
  SIGNOFF_STAMP_EN,
  APPROVAL_STAMP_EL,
  STAMP_DEFAULTS,
} from './stamps';
export { GENERAL_NOTES_EL, GENERAL_NOTES_EN, NOTES_DEFAULTS } from './notes';
export { REVISION_TABLE_EL, REVISION_TABLE_EN, REVISION_DEFAULTS } from './revision';
export { SCALE_BAR_MULTI, SCALE_BAR_DEFAULTS } from './scale-bar';

/** Every built-in template shipped with the engine, in display order. */
export const BUILT_IN_TEXT_TEMPLATES: readonly BuiltInTextTemplate[] = Object.freeze([
  ...TITLE_BLOCK_DEFAULTS,
  ...STAMP_DEFAULTS,
  ...NOTES_DEFAULTS,
  ...REVISION_DEFAULTS,
  ...SCALE_BAR_DEFAULTS,
]);

/** Lookup map by built-in id. O(1) access for the management UI / resolver. */
export const BUILT_IN_TEXT_TEMPLATES_BY_ID: ReadonlyMap<string, BuiltInTextTemplate> = new Map(
  BUILT_IN_TEXT_TEMPLATES.map((t) => [t.id, t]),
);

/** Built-ins grouped by category, preserving display order within each group. */
export const BUILT_IN_TEXT_TEMPLATES_BY_CATEGORY: ReadonlyMap<TextTemplateCategory, readonly BuiltInTextTemplate[]> =
  buildCategoryIndex(BUILT_IN_TEXT_TEMPLATES);

function buildCategoryIndex(
  list: readonly BuiltInTextTemplate[],
): ReadonlyMap<TextTemplateCategory, readonly BuiltInTextTemplate[]> {
  const map = new Map<TextTemplateCategory, BuiltInTextTemplate[]>();
  for (const tpl of list) {
    const bucket = map.get(tpl.category) ?? [];
    bucket.push(tpl);
    map.set(tpl.category, bucket);
  }
  // Freeze each bucket array
  const out = new Map<TextTemplateCategory, readonly BuiltInTextTemplate[]>();
  for (const [k, v] of map) out.set(k, Object.freeze(v));
  return out;
}
