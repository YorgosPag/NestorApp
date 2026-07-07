/**
 * ADR-581 — Καθαρό μοντέλο του «Αντιγραφή Ιδιοτήτων» dialog (zero React).
 *
 * Μετατρέπει (sourceType, targetTypes, selectedRoles) → δομές έτοιμες για rendering:
 *   - `buildOfferedGroups`  → checklist ομαδοποιημένο ανά `MatchCategory`.
 *   - `buildPreviews`       → cross-type mapping preview + consistency warnings.
 *
 * Καμία διπλή λογική: mapping/coercion/warnings προέρχονται από τον ΙΔΙΟ πυρήνα
 * (resolver + `collectMatchPatches` + `checkConsistency`) που τρέχει και ο applier.
 */

import type { EntityType } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';
import {
  getMatchableProperties,
  getDescriptorByKey,
  resolveSemanticMapping,
  collectMatchPatches,
  checkConsistency,
  type MatchCategory,
  type SemanticRole,
} from '../../systems/match-properties';

export interface MatchRoleItem {
  readonly role: SemanticRole;
  readonly labelKey: string;
}
export interface MatchGroup {
  readonly category: MatchCategory;
  readonly items: readonly MatchRoleItem[];
}
export interface OfferedModel {
  readonly groups: readonly MatchGroup[];
  readonly offeredRoles: readonly SemanticRole[];
  readonly isCrossType: boolean;
}
export interface MatchPreviewRow {
  readonly role: SemanticRole;
  readonly sourceLabelKey: string;
  readonly targetLabelKey: string;
  readonly confidence: number;
  readonly reason: string;
}
export interface MatchTargetPreview {
  readonly targetType: string;
  readonly count: number;
  readonly rows: readonly MatchPreviewRow[];
  readonly warningKeys: readonly string[];
}

/** Σταθερή σειρά εμφάνισης κατηγοριών στο checklist. */
export const MATCH_CATEGORY_ORDER: readonly MatchCategory[] = [
  'style', 'geometry', 'structural', 'material', 'identity',
];

/** Προσφερόμενοι ρόλοι (όσοι αντιστοιχίζονται σε ≥1 target), ομαδοποιημένοι ανά κατηγορία. */
export function buildOfferedGroups(
  sourceType: EntityType,
  targetTypes: readonly EntityType[],
): OfferedModel {
  const srcByRole = new Map<SemanticRole, { labelKey: string; category: MatchCategory }>();
  for (const d of getMatchableProperties(sourceType)) {
    if (!d.readOnly) srcByRole.set(d.role, { labelKey: d.labelKey, category: d.category });
  }

  const offered = new Set<SemanticRole>();
  for (const targetType of targetTypes) {
    for (const m of resolveSemanticMapping(sourceType, targetType)) offered.add(m.role);
  }

  const byCategory = new Map<MatchCategory, MatchRoleItem[]>();
  for (const role of offered) {
    const meta = srcByRole.get(role);
    if (!meta) continue;
    const list = byCategory.get(meta.category) ?? [];
    list.push({ role, labelKey: meta.labelKey });
    byCategory.set(meta.category, list);
  }

  const groups: MatchGroup[] = [];
  for (const category of MATCH_CATEGORY_ORDER) {
    const items = byCategory.get(category);
    if (items && items.length > 0) groups.push({ category, items });
  }

  return {
    groups,
    offeredRoles: [...offered],
    isCrossType: targetTypes.some((t) => t !== sourceType),
  };
}

/** Preview ανά διακριτό targetType: αντιστοιχίσεις επιλεγμένων ρόλων + warnings. */
export function buildPreviews(
  source: SceneEntity,
  sourceType: EntityType,
  targetsByType: ReadonlyMap<EntityType, readonly SceneEntity[]>,
  selectedRoles: ReadonlySet<SemanticRole>,
): MatchTargetPreview[] {
  const previews: MatchTargetPreview[] = [];
  for (const [targetType, entities] of targetsByType) {
    const rows: MatchPreviewRow[] = [];
    for (const m of resolveSemanticMapping(sourceType, targetType)) {
      if (!selectedRoles.has(m.role)) continue;
      rows.push({
        role: m.role,
        sourceLabelKey: getDescriptorByKey(sourceType, m.sourceKey)?.labelKey ?? m.sourceKey,
        targetLabelKey: getDescriptorByKey(targetType, m.targetKey)?.labelKey ?? m.targetKey,
        confidence: m.confidence,
        reason: m.reason,
      });
    }
    const probe = entities[0];
    const warnings = probe
      ? checkConsistency(
          source,
          probe,
          collectMatchPatches(source, sourceType, probe, targetType, selectedRoles).paramsPatch,
        )
      : [];
    const warningKeys = [...new Set(warnings.map((w) => w.messageKey))];
    if (rows.length > 0 || warningKeys.length > 0) {
      previews.push({ targetType, count: entities.length, rows, warningKeys });
    }
  }
  return previews;
}
