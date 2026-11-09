/**
 * @fileoverview **Αιτίες εξαίρεσης ΦΠΑ — ο ΕΝΑΣ κατάλογος** (ADR-ACC-003 §7 · §8.3 · §22).
 * @module subapps/accounting/services/config/vat-exemption-reasons
 *
 * Πηγή: ΑΑΔΕ, *myDATA REST API Documentation v2.0.2* (Σεπτ. 2026), πίνακας §8.3 «Κατηγορία Αιτίας Εξαίρεσης
 * ΦΠΑ» — 31 κωδικοί, κάθε κωδικός με **δύο** διατάξεις: ν. 2859/2000 και ν. 5144/2024. Τίτλοι άρθρων: ο
 * κωδικοποιημένος Κώδικας ΦΠΑ της ΑΑΔΕ (04/2026). ⚠️ Πίνακες τρίτων (invoicemaker, SingularLogic) διαφωνούν
 * μεταξύ τους (π.χ. κωδ. 16 → «άρθρο 45» ή «39α») — **δεν** χρησιμοποιήθηκαν.
 *
 * 🔑 **Εδώ ζουν μόνο ταυτότητες**: κωδικός και ομάδα. Το κείμενο (διατάξεις, τίτλοι) ζει στο namespace
 * `accounting-vat-exemptions` (el/en) — η φόρμα το διαβάζει μέσω i18next, το PDF μέσω `createBundleTranslate`
 * στη γλώσσα του εγγράφου. Ένα κλειδί, δύο αναγνώστες, κανένα αντίγραφο.
 *
 * 🔑 **Ποια διάταξη αναγράφεται** (ν. 4308/2014 άρθρο 9: το τιμολόγιο παραπέμπει στη διάταξη της απαλλαγής):
 * εκείνη του νόμου που ίσχυε **την ημερομηνία έκδοσης** — ο ν. 5144/2024 ισχύει από τη δημοσίευσή του
 * (ΦΕΚ Α' 162/11.10.2024). Ο κωδικός ΑΑΔΕ είναι **ίδιος** στις δύο εκδόσεις· αλλάζει μόνο το άρθρο.
 */

// ============================================================================
// ΕΚΔΟΣΕΙΣ ΤΟΥ ΚΩΔΙΚΑ ΦΠΑ
// ============================================================================

/** `legacy` = ν. 2859/2000 · `current` = ν. 5144/2024. */
export type VatCodeEdition = 'legacy' | 'current';

/** Έναρξη ισχύος του ν. 5144/2024 (ΦΕΚ Α' 162/11.10.2024 — ισχύς από τη δημοσίευση). ISO 8601. */
export const VAT_CODE_5144_IN_FORCE_FROM = '2024-10-11';

/**
 * Η έκδοση του Κώδικα ΦΠΑ που ισχύει σε μια ημερομηνία έκδοσης (ISO 8601, `YYYY-MM-DD…`).
 * Σύγκριση των 10 πρώτων χαρακτήρων: ημερομηνία, όχι στιγμή — μια ώρα ζώνης δεν αλλάζει νόμο.
 */
export function vatCodeEditionAt(issueDate: string): VatCodeEdition {
  return issueDate.slice(0, 10) < VAT_CODE_5144_IN_FORCE_FROM ? 'legacy' : 'current';
}

// ============================================================================
// ΚΑΤΑΛΟΓΟΣ
// ============================================================================

/**
 * Ομαδοποίηση για τον επιλογέα — **όχι** κατηγορία της ΑΑΔΕ (ο §8.3 είναι επίπεδος). Ακολουθεί τη δομή του
 * Κώδικα ΦΠΑ: πεδίο/τόπος/χρόνος/αξία (άρθρα 2–24), απαλλαγές (27–33), ειδικά καθεστώτα (44–54), ΦΠΑ
 * εμπεριεχόμενος (50–53, η διατύπωση της ΑΑΔΕ), ηλεκτρονικό εμπόριο (56–58), λοιπά.
 */
export type VatExemptionGroup =
  | 'scope'
  | 'exemptions'
  | 'specialRegimes'
  | 'vatIncluded'
  | 'eCommerce'
  | 'other';

export interface VatExemptionReason {
  /** Κωδικός ΑΑΔΕ §8.3 (`vatExemptionCategory`, XSD `VatExemptionType`). */
  readonly code: number;
  readonly group: VatExemptionGroup;
}

/** Η σειρά εμφάνισης των ομάδων στον επιλογέα. */
export const VAT_EXEMPTION_GROUPS: readonly VatExemptionGroup[] = [
  'exemptions',
  'specialRegimes',
  'scope',
  'vatIncluded',
  'eCommerce',
  'other',
];

export const VAT_EXEMPTION_REASONS = [
  { code: 1, group: 'scope' },          // άρθρα 2 και 3
  { code: 2, group: 'scope' },          // άρθρο 5
  { code: 3, group: 'scope' },          // 13 → 17
  { code: 4, group: 'scope' },          // 14 → 18
  { code: 5, group: 'scope' },          // 16 → 21
  { code: 6, group: 'scope' },          // 19 → 24
  { code: 7, group: 'exemptions' },     // 22 → 27
  { code: 8, group: 'exemptions' },     // 24 → 29
  { code: 9, group: 'exemptions' },     // 25 → 30
  { code: 10, group: 'exemptions' },    // 26 → 31
  { code: 11, group: 'exemptions' },    // 27 → 32
  { code: 12, group: 'exemptions' },    // 27 → 32 (πλοία ανοικτής θαλάσσης)
  { code: 13, group: 'exemptions' },    // 27.1.γ → 32.1.γ
  { code: 14, group: 'exemptions' },    // 28 → 33
  { code: 15, group: 'specialRegimes' }, // 39 → 44
  { code: 16, group: 'specialRegimes' }, // 39α → 45
  { code: 17, group: 'specialRegimes' }, // 40 → 47
  { code: 18, group: 'specialRegimes' }, // 41 → 48
  { code: 19, group: 'specialRegimes' }, // 47 → 54
  { code: 20, group: 'vatIncluded' },   // 43 → 50
  { code: 21, group: 'vatIncluded' },   // 44 → 51
  { code: 22, group: 'vatIncluded' },   // 45 → 52
  { code: 23, group: 'vatIncluded' },   // 46 → 53
  { code: 24, group: 'scope' },         // 6 → 8
  { code: 25, group: 'other' },         // ΠΟΛ.1029/1995
  { code: 26, group: 'other' },         // ΠΟΛ.1167/2015
  { code: 27, group: 'other' },         // λοιπές εξαιρέσεις
  { code: 28, group: 'exemptions' },    // 24 → 29, περ. β' παρ. 1 (Tax Free)
  { code: 29, group: 'eCommerce' },     // 47β → 56 (OSS μη ενωσιακό)
  { code: 30, group: 'eCommerce' },     // 47γ → 57 (OSS ενωσιακό)
  { code: 31, group: 'eCommerce' },     // 47δ → 58 (IOSS)
] as const satisfies readonly VatExemptionReason[];

/** Κωδικός αιτίας εξαίρεσης: `1 | 2 | … | 31` — παραγόμενος από τον πίνακα, ποτέ γραμμένος με το χέρι. */
export type VatExemptionCode = (typeof VAT_EXEMPTION_REASONS)[number]['code'];

/** Στενευτής χωρίς `as`: `unknown` → κωδικός του καταλόγου, ή `false`. Δεκαδικός/εκτός πίνακα ⇒ `false`. */
export function isVatExemptionCode(value: unknown): value is VatExemptionCode {
  return VAT_EXEMPTION_REASONS.some((reason) => reason.code === value);
}

/** Μία γραμμή του καταλόγου, με τον κωδικό στενεμένο σε `VatExemptionCode`. */
export type VatExemptionCatalogEntry = (typeof VAT_EXEMPTION_REASONS)[number];

/** Οι αιτίες μιας ομάδας, με τη σειρά του κωδικού. */
export function vatExemptionReasonsIn(group: VatExemptionGroup): readonly VatExemptionCatalogEntry[] {
  return VAT_EXEMPTION_REASONS.filter((reason) => reason.group === group);
}

// ============================================================================
// ΚΕΙΜΕΝΟ (namespace `accounting-vat-exemptions`)
// ============================================================================

/** Το namespace του κειμένου — ένα όνομα για τη φόρμα, την καρτέλα και το PDF. */
export const VAT_EXEMPTION_NAMESPACE = 'accounting-vat-exemptions';

/**
 * Ο **στενός** μεταφραστής (ίδιο σχήμα με το `PriceLabelT`): χωρά και το `t` του `useTranslation` και το
 * `createBundleTranslate` του PDF/διακομιστή. Τα κλειδιά φέρουν **ρητό** namespace, ώστε το κείμενο να μην
 * εξαρτάται από το ποια namespaces φόρτωσε ο καλών.
 */
export type VatExemptionTranslate = (key: string, options?: Record<string, unknown>) => string;

/** Τίτλος της αιτίας (θέμα του άρθρου) — για τον επιλογέα. */
export function vatExemptionTitle(t: VatExemptionTranslate, code: VatExemptionCode): string {
  return t(`accounting-vat-exemptions:reasons.c${code}.title`);
}

export function vatExemptionGroupLabel(t: VatExemptionTranslate, group: VatExemptionGroup): string {
  return t(`accounting-vat-exemptions:groups.${group}`);
}

/** Η παραπομπή που αναγράφεται: η διατύπωση της ΑΑΔΕ και ο νόμος της έκδοσης που ίσχυε την ημερομηνία έκδοσης. */
export interface VatExemptionCitation {
  readonly provision: string;
  readonly law: string;
}

/** ΜΙΑ συνάρτηση για φόρμα, καρτέλα και PDF — ίδια παραπομπή παντού. */
export function vatExemptionCitation(
  t: VatExemptionTranslate,
  code: VatExemptionCode,
  issueDate: string,
): VatExemptionCitation {
  const edition = vatCodeEditionAt(issueDate);
  return {
    provision: t(`accounting-vat-exemptions:reasons.c${code}.${edition}`),
    law: t(`accounting-vat-exemptions:law.${edition}`),
  };
}
