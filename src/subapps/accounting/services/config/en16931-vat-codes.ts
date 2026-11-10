/**
 * @fileoverview **Λεξιλόγιο ΦΠΑ του EN 16931 — η ΜΙΑ ρίζα** (ADR-ACC-003 §22.6).
 * @module subapps/accounting/services/config/en16931-vat-codes
 *
 * Δύο εξωτερικοί κατάλογοι κωδικών, όπως τους ορίζουν οι εκδότες τους — **όχι** ελληνικός κατάλογος απαλλαγών (αυτός
 * είναι ΕΝΑΣ: `VAT_EXEMPTION_REASONS`, που δείχνει εδώ):
 * - **Κατηγορία ΦΠΑ** (BT-118 / BT-151): υποσύνολο του UNTDID **5305** που επιτρέπει το EN 16931-1.
 * - **Κωδικός αιτίας απαλλαγής** (BT-121): ο κατάλογος **VATEX** της Ευρωπαϊκής Επιτροπής (CEF / Digital Europe),
 *   **έκδοση 9.0** (δημοσίευση 12/10/2026, ισχύς 15/11/2026). Μόνο οι κωδικοί `eu`: οι εθνικοί (σήμερα μόνο `FR`)
 *   ισχύουν μόνο για εγχώρια τιμολόγηση εκείνου του κράτους. **Ελληνικοί εθνικοί κωδικοί δεν υπάρχουν.**
 *
 * 🔑 **Ο δεσμός VATEX → κατηγορία είναι κανόνας, όχι προτίμηση**: Peppol PEPPOL-EN16931-P0104…P0111 και οι σημειώσεις
 * του VATEX («Only use with VAT category code …»). Γι' αυτό ζει ως **τύπος** (`VatexCodeFor<C>`): λάθος ζεύγος = σφάλμα
 * μεταγλώττισης, όχι απόρριψη από τον πάροχο.
 *
 * 🔑 **Οι κανόνες ανά κατηγορία ως δεδομένα** (EN 16931-1, κανόνες BR-x-02 / 05 / 10 / 11): ο preflight βλέπει **από
 * πριν** ότι π.χ. η κατηγορία O απαγορεύει τον ΑΦΜ του πωλητή (BR-O-02) και κάθε άλλη κατηγορία στο ίδιο τιμολόγιο
 * (BR-O-11) — η σύγκρουση που κάνει ακατάλληλη την εφεδρεία «O» για πωλητή με ΑΦΜ ΦΠΑ.
 *
 * Πηγές: EC, *VAT Exemption Reason Code list VATEX – version 9* (Registry of supporting artefacts to implement
 * EN16931)· OpenPeppol, *Peppol BIS Billing 3.0 — rules*· ΓΓΠΣ, *Ελληνικός μορφότυπος PEPPOL BIS 3.0 (CIUS) v8.1*
 * (03/10/2025), σελ. 76–92.
 */

// ============================================================================
// ΚΑΤΗΓΟΡΙΑ ΦΠΑ (UNTDID 5305, υποσύνολο EN 16931)
// ============================================================================

/**
 * `S` κανονικός · `Z` μηδενικός · `E` απαλλαγή · `AE` αντίστροφη επιβάρυνση · `K` ενδοκοινοτική παράδοση ·
 * `G` εξαγωγή εκτός ΕΕ · `O` εκτός πεδίου ΦΠΑ · `L` / `M` Κανάριοι Νήσοι / Θέουτα-Μελίγια (IGIC / IPSI).
 */
export const EN16931_VAT_CATEGORIES = ['S', 'Z', 'E', 'AE', 'K', 'G', 'O', 'L', 'M'] as const;
export type En16931VatCategory = (typeof EN16931_VAT_CATEGORIES)[number];

/** Οι κατηγορίες που **απαιτούν** αιτία (BR-E-10 · BR-AE-10 · BR-IC-10 · BR-G-10 · BR-O-10). */
export const EN16931_EXEMPT_CATEGORIES = ['E', 'AE', 'K', 'G', 'O'] as const;
export type En16931ExemptCategory = (typeof EN16931_EXEMPT_CATEGORIES)[number];

// ============================================================================
// VATEX — έκδοση 9.0
// ============================================================================

export const VATEX_CODE_LIST = {
  version: 9,
  publishedOn: '2026-10-12',
  effectiveFrom: '2026-11-15',
} as const;

/** «Exempt based on article … of Council Directive 2006/112/EC» — δένουν με την κατηγορία `E`. */
export const VATEX_ARTICLE_CODES = [
  'VATEX-EU-79-C',
  'VATEX-EU-132',
  'VATEX-EU-132-1A', 'VATEX-EU-132-1B', 'VATEX-EU-132-1C', 'VATEX-EU-132-1D', 'VATEX-EU-132-1E',
  'VATEX-EU-132-1F', 'VATEX-EU-132-1G', 'VATEX-EU-132-1H', 'VATEX-EU-132-1I', 'VATEX-EU-132-1J',
  'VATEX-EU-132-1K', 'VATEX-EU-132-1L', 'VATEX-EU-132-1M', 'VATEX-EU-132-1N', 'VATEX-EU-132-1O',
  'VATEX-EU-132-1P', 'VATEX-EU-132-1Q',
  'VATEX-EU-135-1',
  'VATEX-EU-143',
  'VATEX-EU-143-1A', 'VATEX-EU-143-1B', 'VATEX-EU-143-1C', 'VATEX-EU-143-1D', 'VATEX-EU-143-1E',
  'VATEX-EU-143-1F', 'VATEX-EU-143-1FA', 'VATEX-EU-143-1G', 'VATEX-EU-143-1H', 'VATEX-EU-143-1I',
  'VATEX-EU-143-1J', 'VATEX-EU-143-1K', 'VATEX-EU-143-1L',
  'VATEX-EU-144',
  'VATEX-EU-146-1E',
  'VATEX-EU-148',
  'VATEX-EU-148-A', 'VATEX-EU-148-B', 'VATEX-EU-148-C', 'VATEX-EU-148-D', 'VATEX-EU-148-E',
  'VATEX-EU-148-F', 'VATEX-EU-148-G',
  'VATEX-EU-151',
  'VATEX-EU-151-1A', 'VATEX-EU-151-1AA', 'VATEX-EU-151-1B', 'VATEX-EU-151-1C', 'VATEX-EU-151-1D',
  'VATEX-EU-151-1E',
  'VATEX-EU-153',
  'VATEX-EU-159',
  'VATEX-EU-309',
] as const;

/** Κωδικοί με **ρητό** δεσμό κατηγορίας (Peppol P0104–P0111 · σημειώσεις VATEX): ζεύγη `[κωδικός, κατηγορία]`. */
export const VATEX_CATEGORY_BOUND_CODES = [
  ['VATEX-EU-AE', 'AE'], // αντίστροφη επιβάρυνση — P0107
  ['VATEX-EU-D', 'E'],   // μεταχειρισμένα μεταφορικά μέσα — P0108
  ['VATEX-EU-F', 'E'],   // περιθώριο: μεταχειρισμένα αγαθά — P0109
  ['VATEX-EU-G', 'G'],   // εξαγωγή εκτός ΕΕ — P0104
  ['VATEX-EU-I', 'E'],   // περιθώριο: έργα τέχνης — P0110
  ['VATEX-EU-IC', 'K'],  // ενδοκοινοτική παράδοση — P0106 (K, ΟΧΙ «IC»)
  ['VATEX-EU-J', 'E'],   // περιθώριο: αντικείμενα συλλογής / αρχαιότητες — P0111
  ['VATEX-EU-O', 'O'],   // εκτός πεδίου ΦΠΑ — P0105
] as const satisfies readonly (readonly [string, En16931ExemptCategory])[];

type VatexBinding = (typeof VATEX_CATEGORY_BOUND_CODES)[number];
export type VatexArticleCode = (typeof VATEX_ARTICLE_CODES)[number];

/** Κωδικός VATEX v9 (`eu`) — παραγόμενος από τη ρίζα, ποτέ γραμμένος με το χέρι. */
export type VatexCode = VatexArticleCode | VatexBinding[0];

export const VATEX_CODES: readonly VatexCode[] = [
  ...VATEX_ARTICLE_CODES,
  ...VATEX_CATEGORY_BOUND_CODES.map(([code]) => code),
];

/** Οι κωδικοί VATEX που **επιτρέπονται** με την κατηγορία `C` — ο δεσμός P0104–P0111 ως τύπος. */
export type VatexCodeFor<C extends En16931ExemptCategory> =
  | (C extends 'E' ? VatexArticleCode : never)
  | Extract<VatexBinding, readonly [string, C]>[0];

/** Στενευτής χωρίς `as`: `unknown` → κωδικός VATEX v9, ή `false`. */
export function isVatexCode(value: unknown): value is VatexCode {
  return VATEX_CODES.some((code) => code === value);
}

/** Η κατηγορία με την οποία **επιτρέπεται** ένας κωδικός VATEX (κωδικός άρθρου Οδηγίας ⇒ `E`). */
export function vatexCategory(code: VatexCode): En16931ExemptCategory {
  return VATEX_CATEGORY_BOUND_CODES.find(([bound]) => bound === code)?.[1] ?? 'E';
}

// ============================================================================
// ΚΑΝΟΝΕΣ ΑΝΑ ΚΑΤΗΓΟΡΙΑ (EN 16931-1)
// ============================================================================

/**
 * `required` ΑΦΜ ΦΠΑ (πωλητή: BT-31 ή BT-63) · `requiredOrRegistration` ΑΦΜ ΦΠΑ **ή** αριθμός μητρώου (πωλητή: BT-32,
 * αγοραστή: BT-47) · `forbidden` · `optional`.
 */
export type PartyVatIdRule = 'required' | 'requiredOrRegistration' | 'forbidden' | 'optional';
export type LineVatRateRule = 'positive' | 'zero' | 'absent';
export type ExtraRequirement = 'deliveryDateOrPeriod' | 'deliverToCountry';

export interface En16931CategoryRules {
  /** Ταυτοποίηση πωλητή — BR-x-02. */
  readonly sellerVatId: PartyVatIdRule;
  /** Ταυτοποίηση αγοραστή — BR-AE-02 · BR-IC-02 · BR-O-02. */
  readonly buyerVatId: PartyVatIdRule;
  /** Συντελεστής γραμμής (BT-152) — BR-x-05. */
  readonly lineVatRate: LineVatRateRule;
  /** Αιτία (BT-120 ή BT-121) — `required` BR-x-10 · `forbidden` BR-S-10 / BR-Z-10. */
  readonly exemptionReason: 'required' | 'forbidden';
  /** Η κατηγορία αποκλείει κάθε άλλη στο ίδιο τιμολόγιο — BR-O-11…14. */
  readonly exclusive: boolean;
  readonly extra: readonly ExtraRequirement[];
  /** Οι κανόνες EN 16931 που στηρίζουν τη γραμμή — για ιχνηλασιμότητα στον preflight. */
  readonly ruleIds: readonly string[];
}

/** Μόνο οι κατηγορίες που μπορεί να εκδώσει ελληνική επιχείρηση (τα L / M αφορούν μόνο Ισπανία). */
export const EN16931_CATEGORY_RULES = {
  S: {
    sellerVatId: 'requiredOrRegistration', buyerVatId: 'optional',
    lineVatRate: 'positive', exemptionReason: 'forbidden',
    exclusive: false, extra: [], ruleIds: ['BR-S-02', 'BR-S-05', 'BR-S-10'],
  },
  Z: {
    sellerVatId: 'requiredOrRegistration', buyerVatId: 'optional',
    lineVatRate: 'zero', exemptionReason: 'forbidden',
    exclusive: false, extra: [], ruleIds: ['BR-Z-02', 'BR-Z-05', 'BR-Z-10'],
  },
  E: {
    sellerVatId: 'requiredOrRegistration', buyerVatId: 'optional',
    lineVatRate: 'zero', exemptionReason: 'required',
    exclusive: false, extra: [], ruleIds: ['BR-E-02', 'BR-E-05', 'BR-E-10'],
  },
  AE: {
    sellerVatId: 'requiredOrRegistration', buyerVatId: 'requiredOrRegistration',
    lineVatRate: 'zero', exemptionReason: 'required',
    exclusive: false, extra: [], ruleIds: ['BR-AE-02', 'BR-AE-05', 'BR-AE-10'],
  },
  K: {
    sellerVatId: 'required', buyerVatId: 'required',
    lineVatRate: 'zero', exemptionReason: 'required',
    exclusive: false, extra: ['deliveryDateOrPeriod', 'deliverToCountry'],
    ruleIds: ['BR-IC-02', 'BR-IC-05', 'BR-IC-10', 'BR-IC-11', 'BR-IC-12'],
  },
  G: {
    sellerVatId: 'required', buyerVatId: 'optional',
    lineVatRate: 'zero', exemptionReason: 'required',
    exclusive: false, extra: [], ruleIds: ['BR-G-02', 'BR-G-05', 'BR-G-10'],
  },
  O: {
    sellerVatId: 'forbidden', buyerVatId: 'forbidden',
    lineVatRate: 'absent', exemptionReason: 'required',
    exclusive: true, extra: [], ruleIds: ['BR-O-02', 'BR-O-05', 'BR-O-10', 'BR-O-11', 'BR-O-12'],
  },
} as const satisfies Readonly<Record<Exclude<En16931VatCategory, 'L' | 'M'>, En16931CategoryRules>>;

export function en16931CategoryRules(category: En16931ExemptCategory): En16931CategoryRules {
  return EN16931_CATEGORY_RULES[category];
}
