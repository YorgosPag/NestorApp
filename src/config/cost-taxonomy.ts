/**
 * Project Cost Taxonomy — ONE taxonomy, two families (ADR-917 §4 Α1 · Ζ1)
 *
 * - **ΑΤΟΕ** (`OIK-*`, hard cost): REFERENCED from `ATOE_MASTER_CATEGORIES`, never copied.
 * - **Soft cost** (`SOFT-*`): the closed list below — land, permits, design, finance…
 * - `OTHER`: lines that carry no cost code.
 *
 * The dot always separates a code from its lower level (`OIK-2.03`, `SOFT-PERMITS.TEE`);
 * every reader rolls up to the group (Procore: hierarchical cost codes with roll-up).
 * The fiscal taxonomy (`ExpenseCategory`, myDATA) stays ORTHOGONAL (§4 Α2).
 *
 * @module config/cost-taxonomy
 * @see ADR-917
 */

import { ATOE_MASTER_CATEGORIES, atoeGroupCodeOf, findATOECategory } from '@/config/boq-categories';
import { compareByLocale } from '@/lib/intl-utils';

/** Bucket for lines that carry no cost code */
export const UNCATEGORIZED_COST_CODE = 'OTHER';

/** Ζ1 — one level; order = display order */
export const SOFT_COST_CODES = [
  'SOFT-LAND',
  'SOFT-PERMITS',
  'SOFT-EFKA',
  'SOFT-UTILITIES',
  'SOFT-DESIGN',
  'SOFT-LEGAL',
  'SOFT-MARKETING',
  'SOFT-FINANCE',
  'SOFT-INSURANCE',
  'SOFT-CONTINGENCY',
] as const;

export type SoftCostCode = (typeof SOFT_COST_CODES)[number];

export type CostCodeFamily = 'atoe' | 'soft' | 'other';

const SOFT_PREFIX = 'SOFT-';

/** The group a code rolls up to (`OIK-2.03` → `OIK-2`, `SOFT-PERMITS.TEE` → `SOFT-PERMITS`). */
export function costCodeGroupOf(raw: string | null | undefined): string {
  return raw ? atoeGroupCodeOf(raw) : UNCATEGORIZED_COST_CODE;
}

export function isSoftCostCode(code: string): code is SoftCostCode {
  return (SOFT_COST_CODES as readonly string[]).includes(code);
}

export function costCodeFamilyOf(code: string): CostCodeFamily {
  const group = costCodeGroupOf(code);
  if (isSoftCostCode(group)) return 'soft';
  if (findATOECategory(group)) return 'atoe';
  return 'other';
}

/** Codes a project budget line may carry: an ΑΤΟΕ group of the catalogue or a soft code (2nd level allowed). */
export function isBudgetLineCostCode(code: string): boolean {
  const group = costCodeGroupOf(code);
  return isSoftCostCode(group) || findATOECategory(group) !== undefined;
}

function familyRank(code: string): number {
  const family = costCodeFamilyOf(code);
  return family === 'atoe' ? 0 : family === 'soft' ? 1 : 2;
}

function orderWithinFamily(code: string): number {
  const group = costCodeGroupOf(code);
  if (isSoftCostCode(group)) return SOFT_COST_CODES.indexOf(group);
  return findATOECategory(group)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
}

/** ΑΤΟΕ by catalogue order (OIK-2 before OIK-10) → soft by declared order → OTHER; ties by code. */
export function compareCostCodes(a: string, b: string): number {
  return familyRank(a) - familyRank(b)
    || orderWithinFamily(a) - orderWithinFamily(b)
    || compareByLocale(a, b);
}

/** The ONE place a cost code becomes a label key (namespace `procurement`). */
export function costCodeLabelKey(code: string): string {
  return `procurement:categories.${code}`;
}

/** Every code that must carry a label (ADR-917 §7 Α8). */
export function allCostCodes(): readonly string[] {
  return [
    ...ATOE_MASTER_CATEGORIES.map(category => category.code),
    ...SOFT_COST_CODES,
    UNCATEGORIZED_COST_CODE,
  ];
}
