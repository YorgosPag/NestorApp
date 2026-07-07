/**
 * ADR-581 — Matchable Property Registry (SSoT).
 *
 * `getMatchableProperties(type)` = memoised σύνθεση (ΟΧΙ επανα-δήλωση) των
 * contributors:
 *   - style   → `getStyleMatchables` (BaseEntity + text/hatch extras, κανάλι scene)
 *   - geometry+material → `getGeometryMatchables` (COMMON_PROPERTIES_BY_KIND, κανάλι params)
 *
 * Δομικά (structural) descriptors προστίθενται σε επόμενη φάση (param-matchables-by-type).
 * Readonly readouts αποκλείονται εξ ορισμού (δεν παράγονται καν εδώ).
 */

import type { EntityType } from '../../types/entities';
import type { MatchablePropertyDescriptor, SemanticRole } from './match-types';
import { getStyleMatchables } from './style-matchable-descriptors';
import { getGeometryMatchables } from './geometry-matchables';
import { getStructuralMatchables } from './param-matchables-by-type';

const CACHE = new Map<string, readonly MatchablePropertyDescriptor[]>();

/** Όλες οι μεταφέρσιμες ιδιότητες ενός τύπου οντότητας (memoised). */
export function getMatchableProperties(
  type: EntityType,
): readonly MatchablePropertyDescriptor[] {
  const cached = CACHE.get(type);
  if (cached) return cached;

  const merged = [
    ...getStyleMatchables(type),
    ...getGeometryMatchables(type),
    ...getStructuralMatchables(type),
  ];
  CACHE.set(type, merged);
  return merged;
}

/** Descriptor ενός τύπου με συγκεκριμένο `key`, ή `undefined`. */
export function getDescriptorByKey(
  type: EntityType,
  key: string,
): MatchablePropertyDescriptor | undefined {
  return getMatchableProperties(type).find((d) => d.key === key);
}

/** Index descriptors ανά semantic role (πολλαπλοί descriptors/role επιτρέπονται). */
export function indexByRole(
  descriptors: readonly MatchablePropertyDescriptor[],
): ReadonlyMap<SemanticRole, readonly MatchablePropertyDescriptor[]> {
  const map = new Map<SemanticRole, MatchablePropertyDescriptor[]>();
  for (const d of descriptors) {
    const list = map.get(d.role);
    if (list) list.push(d);
    else map.set(d.role, [d]);
  }
  return map;
}

/** Καθαρίζει το memo cache (test hook). */
export function __clearMatchRegistryCache(): void {
  CACHE.clear();
}
