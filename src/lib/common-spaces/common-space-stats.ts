/**
 * =============================================================================
 * Κοινόχρηστοι χώροι — ΣΥΝΟΛΑ (καθαρό, ADR-931)
 * =============================================================================
 *
 * Λίστα χώρων → αριθμοί που δείχνει η οθόνη. Η μόνη πηγή είναι η λίστα· **κανένας** αριθμός
 * δεν γράφεται με το χέρι (αυτό ακριβώς αντικαθιστά: '42', 12, `count: 8`).
 *
 * 📐 Εμβαδόν: αθροίζεται **μόνο** το δηλωμένο. Χώρος χωρίς εμβαδόν **μετριέται** στο
 * `areaUnknownCount` — ποτέ ως 0 m², ώστε «Σ = 120 m²» να μη σημαίνει σιωπηλά «Σ από τους
 * μισούς» (ίδια αρχή με το «λείπουν Ν από Μ» του ADR-184 / ADR-898 Φ4β).
 *
 * 🔑 Κάθε ομάδα του λεξιλογίου εμφανίζεται **πάντα** (και με 0): η οθόνη δείχνει τι **λείπει**,
 * όχι μόνο τι υπάρχει.
 *
 * @module lib/common-spaces/common-space-stats
 */

import {
  COMMON_SPACE_GROUPS,
  commonSpaceCategoriesOf,
  commonSpaceGroupOf,
  type CommonSpaceCategory,
  type CommonSpaceGroup,
} from '@/constants/common-space-categories';
import type { CommonSpace } from '@/types/common-space';

export interface AreaTally {
  readonly count: number;
  /** Άθροισμα **δηλωμένων** m². */
  readonly areaM2: number;
  /** Πόσοι χώροι δεν έχουν δηλωμένο εμβαδόν. */
  readonly areaUnknownCount: number;
}

export interface CategoryTally extends AreaTally {
  readonly category: CommonSpaceCategory;
}

export interface GroupTally extends AreaTally {
  readonly group: CommonSpaceGroup;
  /** Μόνο οι κατηγορίες με ≥1 χώρο, στη σειρά του λεξιλογίου. */
  readonly categories: readonly CategoryTally[];
}

export interface BuildingTally extends AreaTally {
  readonly buildingId: string;
}

export interface CommonSpaceStats extends AreaTally {
  readonly groups: readonly GroupTally[];
  readonly buildings: readonly BuildingTally[];
  readonly exclusiveUseCount: number;
}

const EMPTY: AreaTally = { count: 0, areaM2: 0, areaUnknownCount: 0 };

function tally(spaces: readonly CommonSpace[]): AreaTally {
  return spaces.reduce<AreaTally>(
    (acc, space) => ({
      count: acc.count + 1,
      areaM2: acc.areaM2 + (space.area ?? 0),
      areaUnknownCount: acc.areaUnknownCount + (space.area === undefined ? 1 : 0),
    }),
    EMPTY,
  );
}

function groupTally(group: CommonSpaceGroup, spaces: readonly CommonSpace[]): GroupTally {
  const inGroup = spaces.filter((space) => commonSpaceGroupOf(space.category) === group);
  const categories = commonSpaceCategoriesOf(group)
    .map((category) => ({ category, ...tally(inGroup.filter((space) => space.category === category)) }))
    .filter((entry) => entry.count > 0);
  return { group, ...tally(inGroup), categories };
}

function buildingTallies(spaces: readonly CommonSpace[]): BuildingTally[] {
  const byBuilding = new Map<string, CommonSpace[]>();
  for (const space of spaces) {
    const list = byBuilding.get(space.buildingId) ?? [];
    list.push(space);
    byBuilding.set(space.buildingId, list);
  }
  return [...byBuilding.entries()]
    .map(([buildingId, list]) => ({ buildingId, ...tally(list) }))
    .sort((a, b) => b.count - a.count || a.buildingId.localeCompare(b.buildingId));
}

/** Ο ένας υπολογισμός της οθόνης. Ιδεμποτικός και καθαρός: ίδια λίστα ⇒ ίδια σύνολα. */
export function computeCommonSpaceStats(spaces: readonly CommonSpace[]): CommonSpaceStats {
  return {
    ...tally(spaces),
    groups: COMMON_SPACE_GROUPS.map((group) => groupTally(group, spaces)),
    buildings: buildingTallies(spaces),
    exclusiveUseCount: spaces.filter((space) => space.legalNature === 'exclusive_use').length,
  };
}
