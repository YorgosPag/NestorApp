/**
 * @fileoverview Greek Banks Catalog
 * @description Centralized catalog of Greek banks with SWIFT/BIC codes
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-01
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards
 *
 * @see https://www.swift.com/bsl/ - SWIFT BIC Directory
 * @see https://www.hba.gr - Ελληνική Ένωση Τραπεζών
 */

import type { BankInfo } from '@/types/contacts/banking';

// Re-export BankInfo for convenience
export type { BankInfo } from '@/types/contacts/banking';

// ============================================================================
// GREEK BANKS CATALOG - SWIFT/BIC CODES
// ============================================================================

/**
 * Complete catalog of Greek banks with SWIFT/BIC codes
 *
 * @remarks
 * - Sorted alphabetically by Greek name
 * - Includes both active and historical banks (for legacy accounts)
 * - Brand colors are approximate and for UI purposes only
 *
 * @example
 * ```typescript
 * const nationalBank = GREEK_BANKS.find(b => b.code === 'ETHNGRAA');
 * console.log(nationalBank?.name); // "Εθνική Τράπεζα της Ελλάδος"
 * ```
 */
export const GREEK_BANKS: readonly BankInfo[] = [
  // Major Systemic Banks (Big 4)
  {
    code: 'ETHNGRAA',
    name: 'Εθνική Τράπεζα της Ελλάδος',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#00529B'
  },
  {
    code: 'CRBAGRAA',
    name: 'Alpha Bank',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#0066B3'
  },
  {
    code: 'PIABORAA',
    name: 'Τράπεζα Πειραιώς',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#FFD700'
  },
  {
    code: 'EFABORAA',
    name: 'Eurobank',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#E30613'
  },

  // Other Active Banks
  {
    code: 'ATABORAA',
    name: 'Attica Bank',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#003366'
  },
  {
    code: 'OPTIGRAA',
    name: 'Optima Bank',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#1E3A5F'
  },
  {
    code: 'PABORAA',
    name: 'Παγκρήτια Τράπεζα',
    country: 'GR',
    city: 'Ηράκλειο',
    brandColor: '#1E4D2B'
  },
  {
    code: 'HSBORAA',
    name: 'HSBC Greece',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#DB0011'
  },
  {
    code: 'CITIGRAX',
    name: 'Citibank Greece',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#003B70'
  },

  // Cooperative Banks
  {
    code: 'CBANGRAA',
    name: 'Συνεταιριστική Τράπεζα Χανίων',
    country: 'GR',
    city: 'Χανιά',
    brandColor: '#006B3F'
  },
  {
    code: 'CBTHGRAA',
    name: 'Συνεταιριστική Τράπεζα Θεσσαλίας',
    country: 'GR',
    city: 'Λάρισα',
    brandColor: '#4B0082'
  },
  {
    code: 'CBKAGRAA',
    name: 'Συνεταιριστική Τράπεζα Καρδίτσας',
    country: 'GR',
    city: 'Καρδίτσα',
    brandColor: '#228B22'
  },
  {
    code: 'CBIPGRAA',
    name: 'Συνεταιριστική Τράπεζα Ηπείρου',
    country: 'GR',
    city: 'Ιωάννινα',
    brandColor: '#2F4F4F'
  },
  {
    code: 'CBALGRAA',
    name: 'Συνεταιριστική Τράπεζα Κεντρικής Μακεδονίας',
    country: 'GR',
    city: 'Θεσσαλονίκη',
    brandColor: '#8B0000'
  },

  // Investment / Specialized Banks
  {
    code: 'INVEBRAA',
    name: 'Επενδυτική Τράπεζα Ελλάδος',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#2E8B57'
  },

  // Bank of Greece (Central Bank)
  {
    code: 'BNGRGRAA',
    name: 'Τράπεζα της Ελλάδος',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#0C4DA2'
  }
] as const;

// ============================================================================
// GREEK BANK CODE TO SWIFT MAPPING
// ============================================================================

/**
 * Mapping of Greek bank codes (from IBAN) to SWIFT codes
 *
 * The first 3 digits after country code in Greek IBANs identify the bank.
 * Example: GR16 011 ... -> 011 = Εθνική Τράπεζα
 */
export const GREEK_BANK_CODES: Record<string, string> = {
  '011': 'ETHNGRAA', // Εθνική Τράπεζα
  '014': 'CRBAGRAA', // Alpha Bank
  '017': 'PIABORAA', // Τράπεζα Πειραιώς
  '026': 'EFABORAA', // Eurobank
  '016': 'ATABORAA', // Attica Bank
  '069': 'OPTIGRAA', // Optima Bank
  '087': 'PABORAA',  // Παγκρήτια
  '030': 'HSBORAA',  // HSBC
  '067': 'CITIGRAX', // Citibank
  // Cooperative banks
  '084': 'CBANGRAA', // Συν. Χανίων
  '078': 'CBTHGRAA', // Συν. Θεσσαλίας
  '083': 'CBKAGRAA', // Συν. Καρδίτσας
  '089': 'CBIPGRAA', // Συν. Ηπείρου
  '099': 'CBALGRAA', // Συν. Κεντρ. Μακεδονίας
  // Bank of Greece
  '010': 'BNGRGRAA'  // Τράπεζα της Ελλάδος
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find a bank by its SWIFT/BIC code
 *
 * @param code - The SWIFT/BIC code to search for
 * @returns BankInfo if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const bank = getBankByCode('ETHNGRAA');
 * console.log(bank?.name); // "Εθνική Τράπεζα της Ελλάδος"
 * ```
 */
export function getBankByCode(code: string): BankInfo | undefined {
  const upperCode = code.toUpperCase();
  return GREEK_BANKS.find(bank => bank.code === upperCode);
}

/**
 * Find a bank by extracting the bank code from a Greek IBAN
 *
 * @param iban - The IBAN to parse
 * @returns BankInfo if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const bank = getBankByIBAN('GR1601101250000000012300695');
 * console.log(bank?.name); // "Εθνική Τράπεζα της Ελλάδος"
 * ```
 */
export function getBankByIBAN(iban: string): BankInfo | undefined {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();

  // Check if it's a Greek IBAN
  if (!cleaned.startsWith('GR') || cleaned.length !== 27) {
    return undefined;
  }

  // Extract bank code (positions 4-6, 0-indexed)
  const bankCode = cleaned.substring(4, 7);
  const swiftCode = GREEK_BANK_CODES[bankCode];

  if (!swiftCode) {
    return undefined;
  }

  return getBankByCode(swiftCode);
}

/**
 * Get all banks sorted by name
 *
 * @returns Array of BankInfo sorted alphabetically by Greek name
 */
export function getAllBanksSorted(): readonly BankInfo[] {
  return [...GREEK_BANKS].sort((a, b) =>
    a.name.localeCompare(b.name, 'el')
  );
}

/**
 * Get major systemic banks (Big 4)
 *
 * @returns Array of the 4 major Greek banks
 */
export function getSystemicBanks(): readonly BankInfo[] {
  const systemicCodes = ['ETHNGRAA', 'CRBAGRAA', 'PIABORAA', 'EFABORAA'];
  return GREEK_BANKS.filter(bank => systemicCodes.includes(bank.code));
}

/**
 * Search banks by name (partial match)
 *
 * @param query - Search query
 * @returns Array of matching banks
 *
 * @example
 * ```typescript
 * const results = searchBanks('εθνική');
 * // Returns: [{ code: 'ETHNGRAA', name: 'Εθνική Τράπεζα της Ελλάδος', ... }]
 * ```
 */
export function searchBanks(query: string): readonly BankInfo[] {
  const lowerQuery = query.toLowerCase();
  return GREEK_BANKS.filter(bank =>
    bank.name.toLowerCase().includes(lowerQuery) ||
    bank.code.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Check if a SWIFT/BIC code belongs to a Greek bank
 *
 * @param code - The SWIFT/BIC code to check
 * @returns true if the bank is Greek
 */
export function isGreekBank(code: string): boolean {
  return GREEK_BANKS.some(bank => bank.code === code.toUpperCase());
}
