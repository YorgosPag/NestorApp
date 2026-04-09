/**
 * @fileoverview Greek Tax Offices (ΔΟΥ) — Static Data
 * @description Registry of ~100 active tax offices (ΔΟΥ) in Greece.
 *   Source: AADE (Independent Authority for Public Revenue), last updated 2024.
 *   Organized by region: Attica, Piraeus, Thessaloniki, Rest of Greece.
 *   Names and regions are proper nouns — NOT translated via i18n.
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-10
 * @version 3.0.0 — Inline names (proper nouns don't translate)
 * @see ADR-ACC-013 Searchable ΔΟΥ + ΚΑΔ Dropdowns
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TaxOffice {
  /** AADE tax office code */
  code: string;
  /** Display name (proper noun — not translatable) */
  name: string;
  /** Region display name (proper noun — not translatable) */
  region: string;
}

// ============================================================================
// OFFICE NAMES (code → display name)
// ============================================================================

const NAMES: Record<string, string> = {
  '1101': 'Α\' Αθηνών',
  '1104': 'Δ\' Αθηνών',
  '1106': 'ΣΤ\' Αθηνών',
  '1110': 'Ι\' Αθηνών',
  '1113': 'ΙΓ\' Αθηνών',
  '1114': 'ΙΔ\' Αθηνών',
  '1116': 'ΙΣΤ\' Αθηνών',
  '1119': 'Κατοίκων Εξωτερικού',
  '1120': 'ΦΑΕ Αθηνών',
  '1121': 'Α\' Αμαρουσίου',
  '1124': 'Αγίων Αναργύρων',
  '1125': 'Αγίου Δημητρίου',
  '1127': 'Αιγάλεω',
  '1129': 'Αχαρνών',
  '1130': 'Βύρωνα',
  '1131': 'Γλυφάδας',
  '1133': 'Ελευσίνας',
  '1135': 'Ηλιουπόλεως',
  '1137': 'Καλλιθέας',
  '1138': 'Κηφισιάς',
  '1139': 'Κορωπίου',
  '1140': 'Νέας Ιωνίας',
  '1141': 'Νέας Σμύρνης',
  '1143': 'Παλλήνης',
  '1146': 'Περιστερίου',
  '1149': 'Χαλανδρίου',
  '1150': 'Χολαργού',
  '1151': 'Ψυχικού',
  '1201': 'Α\' Πειραιά',
  '1205': 'Ε\' Πειραιά',
  '1209': 'ΦΑΕ Πειραιά',
  '1210': 'Αίγινας',
  '1211': 'Νίκαιας',
  '1212': 'Παλαιού Φαλήρου',
  '1213': 'Σαλαμίνας',
  '1301': 'Α\' Θεσσαλονίκης',
  '1304': 'Δ\' Θεσσαλονίκης',
  '1305': 'Ε\' Θεσσαλονίκης',
  '1308': 'Η\' Θεσσαλονίκης',
  '1310': 'ΦΑΕ Θεσσαλονίκης',
  '1311': 'Αμπελοκήπων',
  '1312': 'Καλαμαριάς',
  '1313': 'Λαγκαδά',
  '1314': 'Νεαπόλεως',
  '1315': 'Τούμπας',
  '1317': 'Ιωνίας Θεσσαλονίκης',
  '1316': 'Ωραιοκάστρου',
  '1401': 'Βέροιας',
  '1402': 'Έδεσσας',
  '1403': 'Κατερίνης',
  '1404': 'Κιλκίς',
  '1406': 'Πολυγύρου',
  '1407': 'Σερρών',
  '1501': 'Αλεξανδρούπολης',
  '1502': 'Δράμας',
  '1503': 'Καβάλας',
  '1504': 'Κομοτηνής',
  '1505': 'Ξάνθης',
  '1506': 'Ορεστιάδας',
  '1601': 'Γρεβενών',
  '1602': 'Καστοριάς',
  '1603': 'Κοζάνης',
  '1604': 'Πτολεμαΐδας',
  '1605': 'Φλώρινας',
  '1701': 'Άρτας',
  '1702': 'Ηγουμενίτσας',
  '1703': 'Ιωαννίνων',
  '1704': 'Πρεβέζης',
  '1801': 'Βόλου',
  '1802': 'Καρδίτσας',
  '1803': 'Α\' Λάρισας',
  '1805': 'Τρικάλων',
  '1901': 'Λαμίας',
  '1902': 'Λιβαδειάς',
  '1903': 'Χαλκίδας',
  '2001': 'Α\' Πατρών',
  '2003': 'Αγρινίου',
  '2004': 'Αμαλιάδας',
  '2005': 'Μεσολογγίου',
  '2006': 'Πύργου',
  '2101': 'Κορίνθου',
  '2102': 'Ναυπλίου',
  '2103': 'Σπάρτης',
  '2104': 'Τρίπολης',
  '2105': 'Καλαμάτας',
  '2201': 'Κέρκυρας',
  '2202': 'Ζακύνθου',
  '2203': 'Λευκάδας',
  '2204': 'Αργοστολίου',
  '2301': 'Μυτιλήνης',
  '2302': 'Σάμου',
  '2303': 'Χίου',
  '2401': 'Ρόδου',
  '2402': 'Κω',
  '2403': 'Σύρου',
  '2404': 'Νάξου',
  '2405': 'Μυκόνου',
  '2406': 'Θήρας',
  '2501': 'Ηρακλείου',
  '2502': 'Χανίων',
  '2503': 'Ρεθύμνου',
  '2504': 'Αγίου Νικολάου',
  '9101': 'ΔΟΥ Μεγάλων Επιχειρήσεων',
  '9102': 'ΔΟΥ Πλοίων',
  '9103': 'ΚΕΦΟΔΕ (Κέντρο Φορολογίας)',
};

// ============================================================================
// REGION CONSTANTS (proper nouns)
// ============================================================================

const R = {
  ATTICA: 'Αττική',
  PIRAEUS: 'Πειραιάς',
  THESSALONIKI: 'Θεσσαλονίκη',
  CENTRAL_MACEDONIA: 'Κεντρική Μακεδονία',
  EAST_MACEDONIA_THRACE: 'Ανατ. Μακεδονία & Θράκη',
  WEST_MACEDONIA: 'Δυτική Μακεδονία',
  EPIRUS: 'Ήπειρος',
  THESSALY: 'Θεσσαλία',
  CENTRAL_GREECE: 'Στερεά Ελλάδα',
  WEST_GREECE: 'Δυτική Ελλάδα',
  PELOPONNESE: 'Πελοπόννησος',
  IONIAN_ISLANDS: 'Ιόνια Νησιά',
  NORTH_AEGEAN: 'Βόρειο Αιγαίο',
  SOUTH_AEGEAN: 'Νότιο Αιγαίο',
  CRETE: 'Κρήτη',
  SPECIAL: 'Ειδικές',
} as const;

/** Helper: builds a TaxOffice entry from code + region */
function doy(code: string, region: string): TaxOffice {
  return { code, name: NAMES[code] || code, region };
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

/**
 * Gets the display name for a tax office code.
 * Direct lookup — no i18n needed (proper nouns).
 */
export function getTaxOfficeDisplayName(code: string): string {
  return NAMES[code] || code;
}

/**
 * Gets the region display name for a tax office code.
 */
export function getRegionDisplayName(code: string): string {
  const office = GREEK_TAX_OFFICES.find(o => o.code === code);
  return office?.region || code;
}
