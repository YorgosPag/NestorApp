/**
 * ============================================================================
 * Ownership Table — Configuration, Types & Helper Components
 * ============================================================================
 *
 * Extracted from OwnershipTableTab.tsx (ADR-235) for SRP compliance.
 * Contains: column definitions, helper functions, small stateless components.
 *
 * @module components/projects/tabs/ownership-table-config
 */

import { cn } from '@/lib/utils';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import type {
  OwnerParty,
  MutableOwnershipTableRow,
} from '@/types/ownership-table';

// ============================================================================
// TYPES
// ============================================================================

/** Column definition for the ownership table — config-driven rendering */
export interface OwnershipColumnDef {
  readonly key: string;
  readonly labelKey: string;
  readonly width?: string;
  readonly alignRight?: boolean;
  readonly filterable?: boolean;
  readonly sortValue?: (row: MutableOwnershipTableRow) => string | number;
  readonly whitespace?: boolean;
}

export interface OwnershipTableTabProps {
  data: import('@/types/project').Project;
  projectId?: string;
}

// ============================================================================
// LABEL HELPERS
// ============================================================================

/** Owner party label */
export function ownerLabel(party: OwnerParty, t: (key: string) => string): string {
  const map: Record<OwnerParty, string> = {
    contractor: t('common:ownership.ownerContractor'),
    landowner: t('common:ownership.ownerLandowner'),
    buyer: t('common:ownership.ownerBuyer'),
    unassigned: t('common:ownership.ownerUnassigned'),
  };
  return map[party] ?? party;
}

/** Category label */
export function categoryLabel(
  cat: string,
  t: (key: string) => string,
  participates?: boolean,
): string {
  if (cat === 'air_rights') return t('common:ownership.categoryAirRights');
  if (participates === false) return t('common:ownership.categoryInformational');
  return cat === 'main'
    ? t('common:ownership.categoryMain')
    : t('common:ownership.categoryAuxiliary');
}

// ============================================================================
// ROW STYLING HELPERS
// ============================================================================

/** Row background color based on category/state — via COLOR_BRIDGE */
export function getRowClassName(row: MutableOwnershipTableRow): string {
  if (row.category === 'air_rights') return COLOR_BRIDGE.bg.purple;
  if (row.isManualOverride) return COLOR_BRIDGE.bg.warningLight;
  if (row.participatesInCalculation === false) return COLOR_BRIDGE.bg.infoSubtle;
  return '';
}

/** Category badge color — via COLOR_BRIDGE */
export function getCategoryBadgeClass(row: MutableOwnershipTableRow): string {
  if (row.category === 'air_rights') return cn(COLOR_BRIDGE.border.info, COLOR_BRIDGE.text.info);
  if (row.participatesInCalculation === false) return cn(COLOR_BRIDGE.border.info, COLOR_BRIDGE.text.info);
  return '';
}

// ============================================================================
// COLUMN CONFIG — SSoT for headers, filters, sorting
// ============================================================================

/** Ownership table column definitions. ALL headers, filters, sort derive from this. */
export function buildColumns(_t: (key: string) => string): OwnershipColumnDef[] {
  return [
    { key: 'ordinal', labelKey: 'common:ownership.columns.ordinal', width: 'w-10', whitespace: true }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'code', labelKey: 'common:ownership.columns.entityCode', width: 'w-32', whitespace: true, filterable: true, sortValue: r => r.entityCode }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'description', labelKey: 'common:ownership.columns.description', whitespace: true, filterable: true, sortValue: r => r.description }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'category', labelKey: 'common:ownership.columns.category', width: 'w-16', whitespace: true, filterable: true, sortValue: r => r.category }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'floor', labelKey: 'common:ownership.columns.floor', width: 'w-14', whitespace: true, filterable: true, sortValue: r => r.floor }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'netArea', labelKey: 'common:ownership.columns.areaNet', width: 'w-28', whitespace: true, alignRight: true, filterable: true, sortValue: r => r.areaNetSqm }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'grossArea', labelKey: 'common:ownership.columns.areaGross', width: 'w-20', whitespace: true, alignRight: true, filterable: true, sortValue: r => r.areaSqm }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'shares', labelKey: 'common:ownership.columns.millesimalShares', width: 'w-28', whitespace: true, alignRight: true, filterable: true, sortValue: r => r.millesimalShares }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'allocation', labelKey: 'common:ownership.columns.allocation', width: 'w-32', whitespace: true, filterable: true, sortValue: r => r.ownerParty }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'buyer', labelKey: 'common:ownership.columns.ownerParty', whitespace: true, filterable: true, sortValue: r => r.owners?.[0]?.name ?? '' }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'preliminary', labelKey: 'common:ownership.columns.preliminary', width: 'w-28', whitespace: true, filterable: true, sortValue: r => r.preliminaryContract ?? '' }, // eslint-disable-line custom/no-hardcoded-strings
    { key: 'final', labelKey: 'common:ownership.columns.final', width: 'w-28', whitespace: true, filterable: true, sortValue: r => r.finalContract ?? '' }, // eslint-disable-line custom/no-hardcoded-strings
  ];
}
