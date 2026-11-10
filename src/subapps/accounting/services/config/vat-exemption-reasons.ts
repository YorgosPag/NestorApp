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
 *
 * 🔑 **Αντιστοίχιση EN 16931** (§22.6): κάθε αιτία φέρει κατηγορία ΦΠΑ (UNCL5305) + κωδικό VATEX για την ηλεκτρονική
 * τιμολόγηση — **εδώ**, όχι σε δεύτερο κατάλογο (πρότυπο NetSuite: κατηγορία + VATEX πάνω στον φορολογικό κωδικό).
 * ⚠️ Η ΑΑΔΕ **δεν** δημοσιεύει τέτοια αντιστοίχιση· η ΓΓΠΣ (Ελληνικό PEPPOL BIS v8.1) λέει «κατά περίπτωση, με τον νόμο
 * και την Οδηγία 2006/112». Γι' αυτό κάθε γραμμή δηλώνει **πόσο** σίγουρη είναι (`fidelity`), και ό,τι δεν κρίνεται από
 * τον κωδικό μόνο μένει `unmapped` — **ποτέ** σιωπηλό «O» (BR-O-02 / BR-O-11 το κάνουν ακατάλληλο για πωλητή με ΑΦΜ).
 *
 * 🔑 **Αντιστοίχιση δήλωσης ΦΠΑ** (§22.7): πεδίο εκροών Φ2 του εκδότη + χαρακτηρισμός ΦΠΑ myDATA του λήπτη. ⚠️ Η ΑΑΔΕ
 * **δεν** δημοσιεύει πίνακα «αιτία → Φ2»· κάθε γραμμή δηλώνει την **επίσημη** πηγή της (ΑΑΔΕ ή ν. 5144/2024) και την
 * ακρίβειά της. Πίνακες τρίτων (Entersoft, Taxheaven) απορρίφθηκαν.
 */

import type { MyDataExpenseVatClassification } from '../mydata/mydata-codes';
import type { CustomerVatScenario } from '../tax/customer-vat-treatment';
import type { En16931ExemptCategory, VatexCodeFor } from './en16931-vat-codes';
import type { VatReturnExemptOutputField } from './vat-return-form';

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

// ============================================================================
// ΑΝΤΙΣΤΟΙΧΙΣΗ EN 16931 (§22.6)
// ============================================================================

/**
 * Πόσο σίγουρη είναι μια αντιστοίχιση της αιτίας (EN 16931 §22.6 · Φ2 §22.7):
 * `exact` — ο στόχος προκύπτει από την ίδια τη διάταξη (ή από ρητή δήλωση της ΑΑΔΕ / δεσμευτικό κανόνα Peppol).
 * `article` — ο στόχος είναι ο κανόνας του **άρθρου**· επειδή ο κωδικός §8.3 καλύπτει ολόκληρο άρθρο του Κώδικα ΦΠΑ,
 * υποπερίπτωση του άρθρου μπορεί να ανήκει αλλού (π.χ. VATEX υποπαραγράφου, εξαιρέσεις του άρθρου 35 §2).
 */
export type MappingFidelity = 'exact' | 'article';

/** Η ακρίβεια της αντιστοίχισης EN 16931 — το γενικό `MappingFidelity` (§22.6). */
export type En16931Fidelity = MappingFidelity;

/**
 * Μία μεταχείριση: κατηγορία + VATEX **δεμένα** κατά τον τύπο (`VatexCodeFor`, Peppol P0104–P0111) — ζεύγος όπως
 * `K` + `VATEX-EU-O` δεν μεταγλωττίζεται. `vatex: null` ⇒ αρκεί το BT-120, η ελληνική παραπομπή (BR-E-10).
 */
export type En16931FixedTreatment = {
  readonly [C in En16931ExemptCategory]: {
    readonly kind: 'fixed';
    readonly category: C;
    readonly vatex: VatexCodeFor<C> | null;
    readonly fidelity: En16931Fidelity;
  };
}[En16931ExemptCategory];

/** Η μεταχείριση εξαρτάται από τον πελάτη (τόπος παροχής) — το σενάριο το δίνει ο ΕΝΑΣ κριτής της §22.5. */
export interface En16931ScenarioTreatment {
  readonly kind: 'byCustomerScenario';
  readonly byScenario: Readonly<Record<CustomerVatScenario, En16931FixedTreatment>>;
}

/** Ο κωδικός §8.3 **μόνος του** δεν κρίνει κατηγορία EN 16931 — αποφασίζει ο άνθρωπος, ποτέ μαντεψιά. */
export interface En16931Unmapped {
  readonly kind: 'unmapped';
}

export type En16931ExemptionMapping = En16931FixedTreatment | En16931ScenarioTreatment | En16931Unmapped;

const UNMAPPED: En16931Unmapped = { kind: 'unmapped' };

// Οι μεταχειρίσεις που χρησιμοποιεί ο κατάλογος — μία δήλωση η καθεμία, ώστε ίδια νομική κρίση = ίδιο αντικείμενο.
const NOT_SUBJECT: En16931FixedTreatment = { kind: 'fixed', category: 'O', vatex: 'VATEX-EU-O', fidelity: 'exact' };
const GOODS_SUPPLIED_ABROAD: En16931FixedTreatment = {
  kind: 'fixed', category: 'O', vatex: 'VATEX-EU-O', fidelity: 'article',
};
const EXEMPT_ARTICLE: En16931FixedTreatment = { kind: 'fixed', category: 'E', vatex: null, fidelity: 'article' };
const SMALL_ENTERPRISE: En16931FixedTreatment = { kind: 'fixed', category: 'E', vatex: null, fidelity: 'exact' };
const DISBURSEMENT: En16931FixedTreatment = {
  kind: 'fixed', category: 'E', vatex: 'VATEX-EU-79-C', fidelity: 'exact',
};
const HIGH_SEAS_VESSELS: En16931FixedTreatment = {
  kind: 'fixed', category: 'E', vatex: 'VATEX-EU-148', fidelity: 'article',
};
const MARGIN_SECOND_HAND: En16931FixedTreatment = {
  kind: 'fixed', category: 'E', vatex: 'VATEX-EU-F', fidelity: 'article',
};
const EXPORT: En16931FixedTreatment = { kind: 'fixed', category: 'G', vatex: 'VATEX-EU-G', fidelity: 'article' };
/** EC, *Technical guidance for tax codes in EN 16931* v1, use case 4: «goods **and services** … outside the EU» ⇒ G. */
const EXPORT_OF_SERVICES: En16931FixedTreatment = {
  kind: 'fixed', category: 'G', vatex: 'VATEX-EU-G', fidelity: 'exact',
};
const INTRA_EU_SUPPLY: En16931FixedTreatment = {
  kind: 'fixed', category: 'K', vatex: 'VATEX-EU-IC', fidelity: 'exact',
};
const REVERSE_CHARGE: En16931FixedTreatment = {
  kind: 'fixed', category: 'AE', vatex: 'VATEX-EU-AE', fidelity: 'exact',
};

/**
 * Τόπος παροχής υπηρεσιών εκτός Ελλάδας (κωδ. 4): επιχείρηση ΕΕ ⇒ **AE** (Οδηγία άρθρα 44 · 196 · 226 §11α)·
 * εκτός ΕΕ ⇒ **G** — ΟΧΙ `O`: πωλητής με ΑΦΜ ΦΠΑ δεν μπορεί να εκδώσει κατηγορία O (BR-O-02), ενώ η G τον
 * **απαιτεί** (BR-G-02)· και ο τεχνικός οδηγός της Επιτροπής ρητά: «goods and services … exported» ⇒ G.
 */
const PLACE_OF_SUPPLY_SERVICES: En16931ScenarioTreatment = {
  kind: 'byCustomerScenario',
  byScenario: {
    eu_business: REVERSE_CHARGE,
    non_eu_business: EXPORT_OF_SERVICES,
    non_eu_consumer: EXPORT_OF_SERVICES,
  },
};

// ============================================================================
// ΑΝΤΙΣΤΟΙΧΙΣΗ ΔΗΛΩΣΗΣ ΦΠΑ — Φ2 (§22.7)
// ============================================================================

/**
 * Από πού προκύπτει μια αντιστοίχιση Φ2 — ταυτότητες πηγών, όλες επίσημες (ΑΑΔΕ ή νόμος):
 * - `f2_field_definition` — η επικεφαλίδα του πεδίου στο έντυπο 050 ΦΠΑ 2025 (Α.1077/2025 · Ε.2071/2025).
 * - `vat_code_art33` · `vat_code_art45` — το άρθρο του ν. 5144/2024 που ορίζει την πράξη.
 * - `vat_code_art35_2a` / `vat_code_art35_2g` — δικαίωμα έκπτωσης: πράξεις στο εξωτερικό / άρθρα 27 λδ, 29–33.
 * - `vat_code_art35_2_exceptions` — οι απαλλαγές του άρθρου 27 **χωρίς** δικαίωμα έκπτωσης, εκτός 35 §2 β/γ/δ.
 * - `vat_code_art44a_1` — οι μικρές επιχειρήσεις απαλλάσσονται από την υποβολή δήλωσης.
 * - `aade_mydata_317_334` — σφάλματα myDATA v2.0.2 317 / 334.
 * - `aade_ecommerce_q19` — ΑΑΔΕ, Εγχειρίδιο ηλεκτρονικού εμπορίου (12/2023), ερώτηση 19: OSS ⇒ κωδ. 349.
 * - `aade_faq_2023` — ΑΑΔΕ, Συχνές ερωτήσεις myDATA (02/2023): αιτία 22 στο τιμολόγιο ⇒ χωρίς κωδικό Φ2.
 */
export type VatReturnSource =
  | 'f2_field_definition'
  | 'vat_code_art33'
  | 'vat_code_art35_2a'
  | 'vat_code_art35_2g'
  | 'vat_code_art35_2_exceptions'
  | 'vat_code_art44a_1'
  | 'vat_code_art45'
  | 'aade_mydata_317_334'
  | 'aade_ecommerce_q19'
  | 'aade_faq_2023';

/** Η αξία της γραμμής πάει στο πεδίο εκροών `field` του Φ2. */
export interface VatReturnFieldTreatment {
  readonly kind: 'field';
  readonly field: VatReturnExemptOutputField;
  readonly fidelity: MappingFidelity;
  readonly sources: readonly VatReturnSource[];
}

/** Το πεδίο εξαρτάται από τον πελάτη (τόπος παροχής) — το σενάριο το δίνει ο ΕΝΑΣ κριτής της §22.5. */
export interface VatReturnScenarioTreatment {
  readonly kind: 'byCustomerScenario';
  readonly byScenario: Readonly<Record<CustomerVatScenario, VatReturnFieldTreatment>>;
}

/**
 * `not_filed` — ο εκδότης **δεν υποβάλλει** Φ2 (αιτία 15, άρθρο 44α §1).
 * `not_reported` — η γραμμή του τιμολογίου **δεν** συσχετίζεται με κωδικό Φ2 (αιτία 22: ο ΦΠΑ του περιθωρίου δηλώνεται
 * με χωριστή λογιστική εγγραφή — ΑΑΔΕ FAQ 2023).
 */
export interface VatReturnNoField {
  readonly kind: 'not_filed' | 'not_reported';
  readonly sources: readonly VatReturnSource[];
}

/** Καμία επίσημη πηγή κρίνει το πεδίο από τον κωδικό μόνο — αποφασίζει λογιστής, ποτέ μαντεψιά. */
export interface VatReturnUnmapped {
  readonly kind: 'unmapped';
}

export type VatReturnOutputMapping =
  | VatReturnFieldTreatment
  | VatReturnScenarioTreatment
  | VatReturnNoField
  | VatReturnUnmapped;

/**
 * Ο χαρακτηρισμός ΦΠΑ του **λήπτη** (myDATA §8.11) όταν τον ορίζει η αιτία:
 * - `required` — αιτία 16 ⇒ `VAT_366` με αυτοεπιβάρυνση (σφάλματα 317 / 334)· οι κατηγορίες ΦΠΑ στο `mydata-codes.ts`.
 * - `by_purchase` — η αιτία **δεν** κρίνει τον χαρακτηρισμό· τον κρίνει η φύση της αγοράς (εσωτερικό, πάγιο κ.λπ.).
 */
export type RecipientVatClassificationRule =
  | {
      readonly kind: 'required';
      readonly classification: Extract<MyDataExpenseVatClassification, 'VAT_366'>;
      readonly selfAssessed: true;
      readonly sources: readonly VatReturnSource[];
    }
  | { readonly kind: 'by_purchase' };

export interface VatReturnMapping {
  /** Πλευρά εκδότη: πεδίο εκροών Φ2 (ή ρητό «χωρίς πεδίο»). */
  readonly output: VatReturnOutputMapping;
  /** Πλευρά λήπτη: χαρακτηρισμός ΦΠΑ εξόδων myDATA. */
  readonly recipient: RecipientVatClassificationRule;
}

const F2_UNMAPPED: VatReturnUnmapped = { kind: 'unmapped' };
const BY_PURCHASE: RecipientVatClassificationRule = { kind: 'by_purchase' };
const REVERSE_CHARGE_RECIPIENT: RecipientVatClassificationRule = {
  kind: 'required', classification: 'VAT_366', selfAssessed: true, sources: ['aade_mydata_317_334'],
};

const F2_INTRA_EU_SUPPLY: VatReturnFieldTreatment = {
  kind: 'field', field: 342, fidelity: 'exact', sources: ['f2_field_definition', 'vat_code_art33'],
};
const F2_INTRA_EU_SERVICES: VatReturnFieldTreatment = {
  kind: 'field', field: 345, fidelity: 'exact', sources: ['f2_field_definition'],
};
const F2_SERVICES_OUTSIDE_EU: VatReturnFieldTreatment = {
  kind: 'field', field: 349, fidelity: 'exact', sources: ['vat_code_art35_2a', 'f2_field_definition'],
};
const F2_GOODS_SUPPLIED_ABROAD: VatReturnFieldTreatment = {
  kind: 'field', field: 349, fidelity: 'article', sources: ['vat_code_art35_2a'],
};
const F2_EXPORT_OR_VESSELS: VatReturnFieldTreatment = {
  kind: 'field', field: 348, fidelity: 'exact', sources: ['f2_field_definition', 'vat_code_art35_2g'],
};
const F2_EXEMPT_WITH_DEDUCTION: VatReturnFieldTreatment = {
  kind: 'field', field: 349, fidelity: 'article', sources: ['vat_code_art35_2g'],
};
/** Άρθρο 27: χωρίς δικαίωμα έκπτωσης — **εκτός** των περιπτώσεων του 35 §2 β/γ(λδ)/δ, που πάνε στο 349. */
const F2_EXEMPT_NO_DEDUCTION: VatReturnFieldTreatment = {
  kind: 'field', field: 310, fidelity: 'article', sources: ['vat_code_art35_2_exceptions'],
};
/** Αντίστροφη επιβάρυνση: ο φόρος οφείλεται από τον λήπτη, ο εκδότης κρατά το δικαίωμα έκπτωσης (άρθρο 45). */
const F2_REVERSE_CHARGE_ISSUER: VatReturnFieldTreatment = {
  kind: 'field', field: 349, fidelity: 'article', sources: ['vat_code_art45', 'f2_field_definition'],
};
const F2_OSS: VatReturnFieldTreatment = {
  kind: 'field', field: 349, fidelity: 'exact', sources: ['aade_ecommerce_q19'],
};

/** Τόπος παροχής υπηρεσιών (αιτία 4): ΕΕ ⇒ 345 (άρθρ. 18.2.α) · εκτός ΕΕ ⇒ 349 (άρθρο 35 §2α). */
const F2_PLACE_OF_SUPPLY_SERVICES: VatReturnScenarioTreatment = {
  kind: 'byCustomerScenario',
  byScenario: {
    eu_business: F2_INTRA_EU_SERVICES,
    non_eu_business: F2_SERVICES_OUTSIDE_EU,
    non_eu_consumer: F2_SERVICES_OUTSIDE_EU,
  },
};

/** Η αιτία ορίζει μόνο την πλευρά του εκδότη· ο λήπτης κρίνει από την αγορά. */
function issuerSide(output: VatReturnOutputMapping): VatReturnMapping {
  return { output, recipient: BY_PURCHASE };
}

const VR_UNMAPPED = issuerSide(F2_UNMAPPED);
const VR_SMALL_ENTERPRISE = issuerSide({ kind: 'not_filed', sources: ['vat_code_art44a_1'] });
const VR_MARGIN_ON_INVOICE = issuerSide({ kind: 'not_reported', sources: ['aade_faq_2023'] });
const VR_REVERSE_CHARGE: VatReturnMapping = { output: F2_REVERSE_CHARGE_ISSUER, recipient: REVERSE_CHARGE_RECIPIENT };

export interface VatExemptionReason {
  /** Κωδικός ΑΑΔΕ §8.3 (`vatExemptionCategory`, XSD `VatExemptionType`). */
  readonly code: number;
  readonly group: VatExemptionGroup;
  /** Κατηγορία ΦΠΑ (BT-118/151) + VATEX (BT-121) της ηλεκτρονικής τιμολόγησης — ADR-ACC-003 §22.6. */
  readonly en16931: En16931ExemptionMapping;
  /** Πεδίο Φ2 του εκδότη + χαρακτηρισμός ΦΠΑ του λήπτη — ADR-ACC-003 §22.7. */
  readonly vatReturn: VatReturnMapping;
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
  // Σχόλιο γραμμής: άρθρο ν. 2859 → ν. 5144 · EN 16931 · Φ2 (εκδότης).
  { code: 1, group: 'scope', en16931: NOT_SUBJECT, vatReturn: VR_UNMAPPED }, // άρθρα 2 και 3 · εκτός πεδίου · —
  { code: 2, group: 'scope', en16931: NOT_SUBJECT, vatReturn: VR_UNMAPPED }, // άρθρο 5 · εκτός πεδίου · —
  { code: 3, group: 'scope', en16931: GOODS_SUPPLIED_ABROAD, vatReturn: issuerSide(F2_GOODS_SUPPLIED_ABROAD) }, // 13 → 17 · O · 349
  { code: 4, group: 'scope', en16931: PLACE_OF_SUPPLY_SERVICES, vatReturn: issuerSide(F2_PLACE_OF_SUPPLY_SERVICES) }, // 14 → 18 · κατά σενάριο · 345 / 349
  { code: 5, group: 'scope', en16931: UNMAPPED, vatReturn: VR_UNMAPPED }, // 16 → 21 · χρόνος · —
  { code: 6, group: 'scope', en16931: DISBURSEMENT, vatReturn: VR_UNMAPPED }, // 19 → 24 · 79γ · —
  { code: 7, group: 'exemptions', en16931: EXEMPT_ARTICLE, vatReturn: issuerSide(F2_EXEMPT_NO_DEDUCTION) }, // 22 → 27 · E · 310
  { code: 8, group: 'exemptions', en16931: EXPORT, vatReturn: issuerSide(F2_EXPORT_OR_VESSELS) }, // 24 → 29 · G · 348
  { code: 9, group: 'exemptions', en16931: EXEMPT_ARTICLE, vatReturn: issuerSide(F2_EXEMPT_WITH_DEDUCTION) }, // 25 → 30 · E · 349
  { code: 10, group: 'exemptions', en16931: EXEMPT_ARTICLE, vatReturn: issuerSide(F2_EXEMPT_WITH_DEDUCTION) }, // 26 → 31 · E · 349
  { code: 11, group: 'exemptions', en16931: EXEMPT_ARTICLE, vatReturn: VR_UNMAPPED }, // 27 → 32 · E · 348 ή 349: κρίση
  { code: 12, group: 'exemptions', en16931: HIGH_SEAS_VESSELS, vatReturn: issuerSide(F2_EXPORT_OR_VESSELS) }, // 27 → 32 (πλοία) · E · 348
  { code: 13, group: 'exemptions', en16931: HIGH_SEAS_VESSELS, vatReturn: issuerSide(F2_EXPORT_OR_VESSELS) }, // 27.1.γ → 32.1.γ · E · 348
  { code: 14, group: 'exemptions', en16931: INTRA_EU_SUPPLY, vatReturn: issuerSide(F2_INTRA_EU_SUPPLY) }, // 28 → 33 · K · 342
  { code: 15, group: 'specialRegimes', en16931: SMALL_ENTERPRISE, vatReturn: VR_SMALL_ENTERPRISE }, // 39 → 44 · E · δεν υποβάλλεται
  { code: 16, group: 'specialRegimes', en16931: REVERSE_CHARGE, vatReturn: VR_REVERSE_CHARGE }, // 39α → 45 · AE · 349 + λήπτης 366
  { code: 17, group: 'specialRegimes', en16931: UNMAPPED, vatReturn: VR_UNMAPPED }, // 40 → 47 · κατ' αποκοπή · —
  { code: 18, group: 'specialRegimes', en16931: UNMAPPED, vatReturn: VR_UNMAPPED }, // 41 → 48 · αγρότες · —
  { code: 19, group: 'specialRegimes', en16931: EXEMPT_ARTICLE, vatReturn: VR_UNMAPPED }, // 47 → 54 · E · —
  { code: 20, group: 'vatIncluded', en16931: EXEMPT_ARTICLE, vatReturn: VR_UNMAPPED }, // 43 → 50 · E · — (908 πληροφοριακό)
  { code: 21, group: 'vatIncluded', en16931: UNMAPPED, vatReturn: VR_UNMAPPED }, // 44 → 51 · — · —
  { code: 22, group: 'vatIncluded', en16931: MARGIN_SECOND_HAND, vatReturn: VR_MARGIN_ON_INVOICE }, // 45 → 52 · E · χωρίς πεδίο
  { code: 23, group: 'vatIncluded', en16931: EXEMPT_ARTICLE, vatReturn: VR_UNMAPPED }, // 46 → 53 · E · —
  { code: 24, group: 'scope', en16931: UNMAPPED, vatReturn: VR_UNMAPPED }, // 6 → 8 · — · —
  { code: 25, group: 'other', en16931: UNMAPPED, vatReturn: VR_UNMAPPED }, // ΠΟΛ.1029/1995 · — · —
  { code: 26, group: 'other', en16931: UNMAPPED, vatReturn: VR_UNMAPPED }, // ΠΟΛ.1167/2015 · — · —
  { code: 27, group: 'other', en16931: UNMAPPED, vatReturn: VR_UNMAPPED }, // λοιπές εξαιρέσεις · — · —
  { code: 28, group: 'exemptions', en16931: EXPORT, vatReturn: issuerSide(F2_EXPORT_OR_VESSELS) }, // 24 → 29 β' (Tax Free) · G · 348
  { code: 29, group: 'eCommerce', en16931: UNMAPPED, vatReturn: issuerSide(F2_OSS) }, // 47β → 56 (OSS μη ενωσιακό) · — · 349
  { code: 30, group: 'eCommerce', en16931: UNMAPPED, vatReturn: issuerSide(F2_OSS) }, // 47γ → 57 (OSS ενωσιακό) · — · 349
  { code: 31, group: 'eCommerce', en16931: UNMAPPED, vatReturn: VR_UNMAPPED }, // 47δ → 58 (IOSS) · — · —
] as const satisfies readonly VatExemptionReason[];

/** Κωδικός αιτίας εξαίρεσης: `1 | 2 | … | 31` — παραγόμενος από τον πίνακα, ποτέ γραμμένος με το χέρι. */
export type VatExemptionCode = (typeof VAT_EXEMPTION_REASONS)[number]['code'];

/** Στενευτής χωρίς `as`: `unknown` → κωδικός του καταλόγου, ή `false`. Δεκαδικός/εκτός πίνακα ⇒ `false`. */
export function isVatExemptionCode(value: unknown): value is VatExemptionCode {
  return VAT_EXEMPTION_REASONS.some((reason) => reason.code === value);
}

/** Μία γραμμή του καταλόγου, με τον κωδικό στενεμένο σε `VatExemptionCode`. */
export type VatExemptionCatalogEntry = (typeof VAT_EXEMPTION_REASONS)[number];

/** Η αντιστοίχιση EN 16931 μιας αιτίας (§22.6). Ο κωδικός είναι στενεμένος ⇒ η εύρεση δεν αποτυγχάνει ποτέ. */
export function en16931MappingOf(code: VatExemptionCode): En16931ExemptionMapping {
  return VAT_EXEMPTION_REASONS.find((reason) => reason.code === code)?.en16931 ?? UNMAPPED;
}

/** Η αντιστοίχιση δήλωσης ΦΠΑ μιας αιτίας (§22.7). Ο κωδικός είναι στενεμένος ⇒ η εύρεση δεν αποτυγχάνει ποτέ. */
export function vatReturnMappingOf(code: VatExemptionCode): VatReturnMapping {
  return VAT_EXEMPTION_REASONS.find((reason) => reason.code === code)?.vatReturn ?? VR_UNMAPPED;
}

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
