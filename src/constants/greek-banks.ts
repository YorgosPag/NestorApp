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
 *
 * ΠΗΓΗ ΤΩΝ ΤΙΜΩΝ (επαληθεύτηκε 2026-11-10 — ΜΗΝ αλλάξεις τιμή χωρίς επίσημη πηγή):
 * - Κωδικός τράπεζας (ψηφία 5-7 του ελληνικού IBAN) + ενεργοί φορείς: HEBIC Ένωσης Τραπεζών, έκδοση 2026
 *   (https://www.hba.gr/En/Hebic/downloadbanks — δεν περιέχει BIC).
 * - SWIFT BIC: HEBIC, έκδοση 2022, «Classification as to bank code» (https://www.hba.gr/Hebic/UplPDFs/2022DEN/1.pdf).
 * - Μοναδική εξαίρεση: CrediaBank (016, πρώην Attica Bank + Pancreta, μετονομασία 07/2025) — το BIC
 *   `ATTIGRAA` είναι της Attica στο HEBIC 2022· τη συνέχειά του επιβεβαιώνουν μόνο τρίτοι κατάλογοι.
 * Ιστορικό: μέχρι 2026-11-10 ο κατάλογος είχε επινοημένα BIC (`PIABORAA`, `EFABORAA`, `ATABORAA`, BIC 7
 * χαρακτήρων) και λάθος κωδικούς (Optima = 069, που είναι η Συν. Χανίων) ⇒ λάθος BIC στο EPC QR τιμολογίων.
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
    code: 'PIRBGRAA',
    name: 'Τράπεζα Πειραιώς',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#FFD700'
  },
  {
    code: 'ERBKGRAA',
    name: 'Eurobank',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#E30613'
  },

  // Other Active Banks
  {
    code: 'ATTIGRAA',
    name: 'CrediaBank',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#003366'
  },
  {
    code: 'IBOGGRAA',
    name: 'Optima Bank',
    country: 'GR',
    city: 'Μαρούσι',
    brandColor: '#1E3A5F'
  },
  {
    code: 'PRXBGRAA',
    name: 'Vivabank',
    country: 'GR',
    city: 'Μαρούσι'
  },
  {
    code: 'AEBAGRAA',
    name: 'Aegean Baltic Bank',
    country: 'GR',
    city: 'Μαρούσι'
  },
  {
    code: 'STIOGR21',
    name: 'Τράπεζα Ηπείρου',
    country: 'GR',
    city: 'Ιωάννινα',
    brandColor: '#2F4F4F'
  },
  {
    code: 'CITIGRAA',
    name: 'Citibank Europe',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#003B70'
  },

  // Cooperative Banks
  {
    code: 'STXAGRA1',
    name: 'Συνεταιριστική Τράπεζα Χανίων',
    country: 'GR',
    city: 'Χανιά',
    brandColor: '#006B3F'
  },
  {
    code: 'STTKGR21',
    name: 'Συνεταιριστική Τράπεζα Θεσσαλίας',
    country: 'GR',
    city: 'Τρίκαλα',
    brandColor: '#4B0082'
  },
  {
    code: 'STKAGRA1',
    name: 'Συνεταιριστική Τράπεζα Καρδίτσας',
    country: 'GR',
    city: 'Καρδίτσα',
    brandColor: '#228B22'
  },

  // Historical (no longer in HEBIC 2026 — kept so legacy IBANs/stored BICs still resolve)
  {
    code: 'STPGGRAA',
    name: 'Παγκρήτια Τράπεζα (πλέον CrediaBank)',
    country: 'GR',
    city: 'Ηράκλειο',
    brandColor: '#1E4D2B'
  },
  {
    code: 'MIDLGRAA',
    name: 'HSBC Continental Europe, Greece',
    country: 'GR',
    city: 'Αθήνα',
    brandColor: '#DB0011'
  },
  {
    code: 'COESGR21',
    name: 'Συνεταιριστική Τράπεζα Κεντρικής Μακεδονίας',
    country: 'GR',
    city: 'Σέρρες',
    brandColor: '#8B0000'
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
// SE EUROPEAN / BALKAN BANKS CATALOG
// ============================================================================

export const SE_EUROPEAN_BANKS: readonly BankInfo[] = [
  // Bulgaria
  { code: 'UNCRBGSF', name: 'UniCredit Bulbank', country: 'BG', city: 'Sofia', brandColor: '#E31937' },
  { code: 'UBBSBGSF', name: 'UBB (United Bulgarian Bank)', country: 'BG', city: 'Sofia', brandColor: '#004B87' },
  { code: 'STSABGSF', name: 'DSK Bank', country: 'BG', city: 'Sofia', brandColor: '#009B4D' },
  { code: 'RZBBBGSF', name: 'Raiffeisenbank Bulgaria', country: 'BG', city: 'Sofia', brandColor: '#FFED00' },
  { code: 'FINVBGSF', name: 'First Investment Bank (FIB)', country: 'BG', city: 'Sofia', brandColor: '#003087' },
  { code: 'BPBIBGSF', name: 'Postbank Bulgaria', country: 'BG', city: 'Sofia', brandColor: '#00529B' },
  { code: 'CECBBGSF', name: 'CCB (Central Cooperative Bank)', country: 'BG', city: 'Sofia', brandColor: '#004B87' },
  // Romania
  { code: 'RNCBROBU', name: 'BCR (Banca Comerciala Romana)', country: 'RO', city: 'Bucharest', brandColor: '#003087' },
  { code: 'BRDEROBUXXX', name: 'BRD – Groupe Société Générale', country: 'RO', city: 'Bucharest', brandColor: '#E2001A' },
  { code: 'BTRLRO22', name: 'Banca Transilvania', country: 'RO', city: 'Cluj-Napoca', brandColor: '#0054A5' },
  // Serbia
  { code: 'BACXRSBG', name: 'UniCredit Bank Serbia', country: 'RS', city: 'Belgrade', brandColor: '#E31937' },
  // Albania
  { code: 'NCBAALTX', name: 'BKT (Banka Kombetare Tregtare)', country: 'AL', city: 'Tirana', brandColor: '#E31937' },
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
  '016': 'ATTIGRAA', // CrediaBank (πρώην Attica Bank)
  '017': 'PIRBGRAA', // Τράπεζα Πειραιώς
  '026': 'ERBKGRAA', // Eurobank
  '034': 'IBOGGRAA', // Optima Bank
  '056': 'AEBAGRAA', // Aegean Baltic Bank
  '057': 'PRXBGRAA', // Vivabank
  '075': 'STIOGR21', // Τράπεζα Ηπείρου
  '084': 'CITIGRAA', // Citibank Europe
  // Cooperative banks
  '069': 'STXAGRA1', // Συν. Χανίων
  '089': 'STKAGRA1', // Συν. Καρδίτσας
  '091': 'STTKGR21', // Συν. Θεσσαλίας
  // Historical (legacy IBANs)
  '071': 'MIDLGRAA', // HSBC
  '087': 'STPGGRAA', // Παγκρήτια (πλέον CrediaBank)
  '099': 'COESGR21', // Συν. Κεντρ. Μακεδονίας
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
  return (
    GREEK_BANKS.find(bank => bank.code === upperCode) ??
    SE_EUROPEAN_BANKS.find(bank => bank.code === upperCode)
  );
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
/** Bulgarian IBAN bank codes (positions 4-7, 4 letters) → SWIFT */
const BULGARIAN_BANK_CODES: Record<string, string> = {
  'UNCR': 'UNCRBGSF', // UniCredit Bulbank
  'UBBS': 'UBBSBGSF', // UBB
  'STSA': 'STSABGSF', // DSK Bank
  'RZBB': 'RZBBBGSF', // Raiffeisenbank
  'FINV': 'FINVBGSF', // First Investment Bank
  'BPBI': 'BPBIBGSF', // Postbank
  'CECB': 'CECBBGSF', // CCB
};

/**
 * Κωδικοί τράπεζας IBAN όπου, μετά από συγχώνευση, ο λογαριασμός εξυπηρετείται **και** με τον BIC του διαδόχου.
 * 087 (Παγκρήτια): απορροφήθηκε από την CrediaBank (`ATTIGRAA`, 07/2025). Επίσημη πηγή για το ποιος BIC δρομολογεί
 * τα παλιά IBAN 087 **δεν βρέθηκε** (2026-11-11) ⇒ γίνονται δεκτοί **και οι δύο** — ποτέ ψευδής άρνηση σωστού BIC.
 */
const GREEK_SUCCESSOR_BICS: Readonly<Record<string, readonly string[]>> = {
  '087': ['ATTIGRAA'],
};

/** Οι BIC (8 χαρακτήρες, ISO 9362 «ίδρυμα + χώρα + τοποθεσία») που αντιστοιχούν στον κωδικό τράπεζας του IBAN. */
function registryBicsOfIBAN(iban: string): readonly string[] {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  const country = cleaned.substring(0, 2);

  if (country === 'GR' && cleaned.length === 27) {
    const code = cleaned.substring(4, 7);
    const swiftCode = GREEK_BANK_CODES[code];
    return swiftCode ? [swiftCode, ...(GREEK_SUCCESSOR_BICS[code] ?? [])] : [];
  }

  if (country === 'BG' && cleaned.length === 22) {
    const swiftCode = BULGARIAN_BANK_CODES[cleaned.substring(4, 8)];
    return swiftCode ? [swiftCode] : [];
  }

  return [];
}

export function getBankByIBAN(iban: string): BankInfo | undefined {
  const [swiftCode] = registryBicsOfIBAN(iban);
  return swiftCode ? getBankByCode(swiftCode) : undefined;
}

/** `unknown` = ο κατάλογος δεν ξέρει την τράπεζα του IBAN (ξένο ή άγνωστος κωδικός) — τότε δεν κρίνεται τίποτα. */
export type BicIbanAgreement = 'match' | 'mismatch' | 'unknown';

/**
 * Ανήκει ο BIC στην τράπεζα που δηλώνει το ίδιο το IBAN; Συγκρίνονται οι 8 πρώτοι χαρακτήρες (ίδρυμα + χώρα +
 * τοποθεσία) — ο κωδικός καταστήματος (`XXX` ή άλλος) δεν αλλάζει τον δικαιούχο φορέα. Ο ΕΝΑΣ κριτής για φόρμα
 * **και** διακομιστή: BIC άλλης τράπεζας στο EPC QR στέλνει την πληρωμή σε λάθος ίδρυμα ή την ακυρώνει (ADR-ACC-018 §15.2).
 */
export function bicAgreementWithIBAN(iban: string, bic: string): BicIbanAgreement {
  const expected = registryBicsOfIBAN(iban);
  if (expected.length === 0) return 'unknown';
  const institution = bic.replace(/\s/g, '').toUpperCase().substring(0, 8);
  return expected.some((swiftCode) => swiftCode.substring(0, 8) === institution) ? 'match' : 'mismatch';
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
  const systemicCodes = ['ETHNGRAA', 'CRBAGRAA', 'PIRBGRAA', 'ERBKGRAA'];
  return GREEK_BANKS.filter(bank => systemicCodes.includes(bank.code));
}

export function getSEEuropeanBanks(): readonly BankInfo[] {
  return SE_EUROPEAN_BANKS;
}

