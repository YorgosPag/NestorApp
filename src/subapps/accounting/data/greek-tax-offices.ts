/**
 * @fileoverview Greek Tax Offices (ΔΟΥ) — Static Data
 * @description Registry of ~100 active tax offices (ΔΟΥ) in Greece.
 *   Source: AADE (Independent Authority for Public Revenue), last updated 2024.
 *   Organized by region: Attica, Piraeus, Thessaloniki, Rest of Greece.
 *   All name/region values are i18n keys — resolve via getTaxOfficeDisplayName().
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-10
 * @version 2.0.0
 * @see ADR-ACC-013 Searchable ΔΟΥ + ΚΑΔ Dropdowns
 */

import i18next from 'i18next';

// ============================================================================
// TYPES
// ============================================================================

export interface TaxOffice {
  /** AADE tax office code */
  code: string;
  /** i18n key for the tax office name (resolve via t() or getTaxOfficeDisplayName()) */
  name: string;
  /** i18n key for the region (resolve via t()) */
  region: string;
}

// ============================================================================
// REGION KEY CONSTANTS
// ============================================================================

const R = {
  ATTICA: 'regions.attica',
  PIRAEUS: 'regions.piraeus',
  THESSALONIKI: 'regions.thessaloniki',
  CENTRAL_MACEDONIA: 'regions.central_macedonia',
  EAST_MACEDONIA_THRACE: 'regions.east_macedonia_thrace',
  WEST_MACEDONIA: 'regions.west_macedonia',
  EPIRUS: 'regions.epirus',
  THESSALY: 'regions.thessaly',
  CENTRAL_GREECE: 'regions.central_greece',
  WEST_GREECE: 'regions.west_greece',
  PELOPONNESE: 'regions.peloponnese',
  IONIAN_ISLANDS: 'regions.ionian_islands',
  NORTH_AEGEAN: 'regions.north_aegean',
  SOUTH_AEGEAN: 'regions.south_aegean',
  CRETE: 'regions.crete',
  SPECIAL: 'regions.special',
} as const;

/** Helper: builds a TaxOffice entry from code + region key */
function doy(code: string, region: string): TaxOffice {
  return { code, name: `offices.${code}`, region };
}

// ============================================================================
// DATA — Active tax offices (sorted alphabetically within each region)
// ============================================================================

export const GREEK_TAX_OFFICES: TaxOffice[] = [
  // --- ATTICA ---
  doy('1101', R.ATTICA),
  doy('1104', R.ATTICA),
  doy('1106', R.ATTICA),
  doy('1110', R.ATTICA),
  doy('1113', R.ATTICA),
  doy('1114', R.ATTICA),
  doy('1116', R.ATTICA),
  doy('1119', R.ATTICA),
  doy('1120', R.ATTICA),
  doy('1121', R.ATTICA),
  doy('1124', R.ATTICA),
  doy('1125', R.ATTICA),
  doy('1127', R.ATTICA),
  doy('1129', R.ATTICA),
  doy('1130', R.ATTICA),
  doy('1131', R.ATTICA),
  doy('1133', R.ATTICA),
  doy('1135', R.ATTICA),
  doy('1137', R.ATTICA),
  doy('1138', R.ATTICA),
  doy('1139', R.ATTICA),
  doy('1140', R.ATTICA),
  doy('1141', R.ATTICA),
  doy('1143', R.ATTICA),
  doy('1146', R.ATTICA),
  doy('1149', R.ATTICA),
  doy('1150', R.ATTICA),
  doy('1151', R.ATTICA),

  // --- PIRAEUS ---
  doy('1201', R.PIRAEUS),
  doy('1205', R.PIRAEUS),
  doy('1209', R.PIRAEUS),
  doy('1210', R.PIRAEUS),
  doy('1211', R.PIRAEUS),
  doy('1212', R.PIRAEUS),
  doy('1213', R.PIRAEUS),

  // --- THESSALONIKI ---
  doy('1301', R.THESSALONIKI),
  doy('1304', R.THESSALONIKI),
  doy('1305', R.THESSALONIKI),
  doy('1308', R.THESSALONIKI),
  doy('1310', R.THESSALONIKI),
  doy('1311', R.THESSALONIKI),
  doy('1312', R.THESSALONIKI),
  doy('1313', R.THESSALONIKI),
  doy('1314', R.THESSALONIKI),
  doy('1315', R.THESSALONIKI),
  doy('1317', R.THESSALONIKI),
  doy('1316', R.THESSALONIKI),

  // --- CENTRAL MACEDONIA ---
  doy('1401', R.CENTRAL_MACEDONIA),
  doy('1402', R.CENTRAL_MACEDONIA),
  doy('1403', R.CENTRAL_MACEDONIA),
  doy('1404', R.CENTRAL_MACEDONIA),
  doy('1406', R.CENTRAL_MACEDONIA),
  doy('1407', R.CENTRAL_MACEDONIA),

  // --- EAST MACEDONIA & THRACE ---
  doy('1501', R.EAST_MACEDONIA_THRACE),
  doy('1502', R.EAST_MACEDONIA_THRACE),
  doy('1503', R.EAST_MACEDONIA_THRACE),
  doy('1504', R.EAST_MACEDONIA_THRACE),
  doy('1505', R.EAST_MACEDONIA_THRACE),
  doy('1506', R.EAST_MACEDONIA_THRACE),

  // --- WEST MACEDONIA ---
  doy('1601', R.WEST_MACEDONIA),
  doy('1602', R.WEST_MACEDONIA),
  doy('1603', R.WEST_MACEDONIA),
  doy('1604', R.WEST_MACEDONIA),
  doy('1605', R.WEST_MACEDONIA),

  // --- EPIRUS ---
  doy('1701', R.EPIRUS),
  doy('1702', R.EPIRUS),
  doy('1703', R.EPIRUS),
  doy('1704', R.EPIRUS),

  // --- THESSALY ---
  doy('1801', R.THESSALY),
  doy('1802', R.THESSALY),
  doy('1803', R.THESSALY),
  doy('1805', R.THESSALY),

  // --- CENTRAL GREECE ---
  doy('1901', R.CENTRAL_GREECE),
  doy('1902', R.CENTRAL_GREECE),
  doy('1903', R.CENTRAL_GREECE),

  // --- WEST GREECE ---
  doy('2001', R.WEST_GREECE),
  doy('2003', R.WEST_GREECE),
  doy('2004', R.WEST_GREECE),
  doy('2005', R.WEST_GREECE),
  doy('2006', R.WEST_GREECE),

  // --- PELOPONNESE ---
  doy('2101', R.PELOPONNESE),
  doy('2102', R.PELOPONNESE),
  doy('2103', R.PELOPONNESE),
  doy('2104', R.PELOPONNESE),
  doy('2105', R.PELOPONNESE),

  // --- IONIAN ISLANDS ---
  doy('2201', R.IONIAN_ISLANDS),
  doy('2202', R.IONIAN_ISLANDS),
  doy('2203', R.IONIAN_ISLANDS),
  doy('2204', R.IONIAN_ISLANDS),

  // --- NORTH AEGEAN ---
  doy('2301', R.NORTH_AEGEAN),
  doy('2302', R.NORTH_AEGEAN),
  doy('2303', R.NORTH_AEGEAN),

  // --- SOUTH AEGEAN ---
  doy('2401', R.SOUTH_AEGEAN),
  doy('2402', R.SOUTH_AEGEAN),
  doy('2403', R.SOUTH_AEGEAN),
  doy('2404', R.SOUTH_AEGEAN),
  doy('2405', R.SOUTH_AEGEAN),
  doy('2406', R.SOUTH_AEGEAN),

  // --- CRETE ---
  doy('2501', R.CRETE),
  doy('2502', R.CRETE),
  doy('2503', R.CRETE),
  doy('2504', R.CRETE),

  // --- SPECIAL ---
  doy('9101', R.SPECIAL),
  doy('9102', R.SPECIAL),
  doy('9103', R.SPECIAL),
];

// ============================================================================
// HELPERS
// ============================================================================

const NS = 'accounting-tax-offices';

/**
 * Resolves a tax office's i18n name key to the current locale.
 * Uses imperative i18next — works in both React components and plain TS services.
 */
export function getTaxOfficeDisplayName(code: string): string {
  return i18next.t(`offices.${code}`, { ns: NS }) || code;
}

/**
 * Resolves a region i18n key to the current locale.
 */
export function getRegionDisplayName(regionKey: string): string {
  return i18next.t(regionKey, { ns: NS }) || regionKey;
}
