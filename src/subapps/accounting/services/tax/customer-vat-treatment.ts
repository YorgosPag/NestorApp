/**
 * @fileoverview **Τόπος παροχής υπηρεσιών από τον πελάτη — ο ΕΝΑΣ κριτής** (ADR-ACC-003 §22.5).
 * @module subapps/accounting/services/tax/customer-vat-treatment
 *
 * Καθαρή συνάρτηση: (χώρα πελάτη, δηλωμένο ΑΦΜ, τύπος παραστατικού) → **πρόταση** μεταχείρισης ΦΠΑ, ή τίποτα.
 * Επιστρέφει **ταυτότητες** (σενάριο, κωδικός, τύπος, βάση, επιφυλάξεις), ποτέ κείμενο — το κείμενο το δίνει το
 * UI από τα locales. Κοινή για τη φόρμα τιμολογίου και (αργότερα) τον preflight.
 *
 * 🔑 **Πρόταση, ποτέ απόφαση**: ο τόπος παροχής είναι νομική κρίση που εξαρτάται και από το **είδος** της
 * υπηρεσίας (ακίνητα, §4) και από την **πραγματική** ιδιότητα του λήπτη (VIES). Ο κριτής βλέπει μόνο τα τεκμήρια
 * που έχει η φόρμα και το δηλώνει (`caveats`)· την εφαρμογή την κάνει ο άνθρωπος.
 *
 * Πηγή: ν. 5144/2024 **άρθρο 18** (κωδικοποίηση ΑΑΔΕ 04/2026):
 * - §2α — λήπτης **υποκείμενος** ⇒ τόπος = εκεί όπου είναι εγκατεστημένος ο λήπτης.
 * - §2β — λήπτης **μη υποκείμενος** ⇒ τόπος = έδρα του παρόχου (Ελλάδα, ελληνικός ΦΠΑ).
 * - §1β — νομικό πρόσωπο με ΑΦΜ ΦΠΑ θεωρείται υποκείμενος ⇒ **τεκμήριο** «επιχείρηση» = δηλωμένο ΑΦΜ.
 * - §4  — υπηρεσίες σχετικές με **ακίνητα** (αρχιτέκτονες, επίβλεψη, μεσίτες) ⇒ τόπος = τόπος του ακινήτου.
 * - §15 — μη υποκείμενος **εκτός ΕΕ** ⇒ εκτός Ελλάδας **μόνο** για τις υπηρεσίες της παραγράφου (σύμβουλοι,
 *   μηχανικοί, γραφεία μελετών, δικηγόροι, λογιστές, διαφήμιση, πνευματικά δικαιώματα κ.λπ.).
 * Κωδικός ΑΑΔΕ §8.3 = **4** («Χωρίς ΦΠΑ - άρθρο 14 → 18»). Τύπος παραστατικού: 2.2 / 2.3 (σφάλματα 243/244
 * του myDATA απορρίπτουν χώρα λήπτη που δεν ταιριάζει με τον τύπο).
 *
 * ⚠️ **Μόνο υπηρεσίες**: η ενδοκοινοτική παράδοση (κωδ. 14) και η εξαγωγή αγαθών (κωδ. 8) θέλουν τους τύπους
 * 1.2 / 1.3, που η εφαρμογή **δεν** εκδίδει ⇒ `sales_invoice` δεν παίρνει πρόταση. Το πιστωτικό ακολουθεί το αρχικό.
 *
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import { countryNameToCode, toStoredCountryCode } from '@/utils/address/country-codes';

import type { InvoiceCustomer, InvoiceType } from '../../types/invoice';
import { isEuMemberState } from '../config/eu-member-states';
import type { VatExemptionCode } from '../config/vat-exemption-reasons';
import { GREEK_EXEMPT_VAT_RATE } from '../config/vat-rates';
import type { CompanyLineVatDefault } from '../setup/company-vat-regime';

// ============================================================================
// ΛΕΞΙΛΟΓΙΟ
// ============================================================================

/** Κωδικός ΑΑΔΕ §8.3 του τόπου παροχής υπηρεσιών (άρθρο 14 → 18). */
export const PLACE_OF_SUPPLY_EXEMPTION_CODE: VatExemptionCode = 4;

/** Τα σενάρια όπου ο τόπος παροχής **μπορεί** να είναι εκτός Ελλάδας. */
export const CUSTOMER_VAT_SCENARIOS = ['eu_business', 'non_eu_business', 'non_eu_consumer'] as const;
export type CustomerVatScenario = (typeof CUSTOMER_VAT_SCENARIOS)[number];

/** Η παράγραφος του άρθρου 18 που στηρίζει την πρόταση. */
export type PlaceOfSupplyBasis = 'art18_2a' | 'art18_15';

/**
 * Ό,τι ο κριτής **δεν** μπορεί να ξέρει, και ο άνθρωπος πρέπει να κρίνει:
 * - `immovableProperty` — §4: αν η υπηρεσία αφορά ακίνητο στην Ελλάδα, ο ΦΠΑ είναι ελληνικός.
 * - `listedServicesOnly` — §15: ισχύει μόνο για τις υπηρεσίες της παραγράφου.
 * - `vatNumberNotVerified` — το ΑΦΜ είναι **δηλωμένο**, όχι επαληθευμένο (VIES / μητρώο της χώρας).
 */
export type CustomerVatCaveat = 'immovableProperty' | 'listedServicesOnly' | 'vatNumberNotVerified';

export interface CustomerVatSuggestion {
  readonly kind: 'suggestion';
  readonly scenario: CustomerVatScenario;
  /** Αποθηκευμένος κωδικός χώρας (ISO alpha-2, κεφαλαία). */
  readonly countryCode: string;
  readonly vatRate: number;
  readonly vatExemptionCategory: VatExemptionCode;
  readonly invoiceType: InvoiceType;
  readonly basis: PlaceOfSupplyBasis;
  readonly caveats: readonly CustomerVatCaveat[];
}

/**
 * Η κρίση για έναν πελάτη:
 * - `suggestion` — υπάρχει πρόταση.
 * - `unknown_country` — η χώρα γράφτηκε, αλλά δεν αναγνωρίζεται: **δεν** μαντεύουμε αν είναι ΕΕ.
 * - `none` — ο ΦΠΑ είναι ελληνικός (εγχώριος πελάτης, ιδιώτης ΕΕ — §2β) ή το παραστατικό δεν είναι παροχή υπηρεσιών.
 */
export type CustomerVatAssessment =
  | CustomerVatSuggestion
  | { readonly kind: 'unknown_country'; readonly country: string }
  | { readonly kind: 'none' };

/** Ό,τι χρειάζεται ο κριτής από τον πελάτη. */
export type CustomerVatFacts = Pick<InvoiceCustomer, 'country' | 'vatNumber'>;

// ============================================================================
// ΚΡΙΤΗΣ
// ============================================================================

/** Οι τύποι της οικογένειας «Τιμολόγιο Παροχής» (2.x) — μόνο εκεί κρίνεται ο τόπος παροχής υπηρεσιών. */
const SERVICE_INVOICE_FAMILY: ReadonlySet<InvoiceType> = new Set<InvoiceType>([
  'service_invoice',
  'service_invoice_eu',
  'service_invoice_3rd',
]);

const GREECE = 'GR';
const NONE: CustomerVatAssessment = { kind: 'none' };

function hasDeclaredVatNumber(vatNumber: string | null): boolean {
  return (vatNumber ?? '').trim().length > 0;
}

function suggestion(
  scenario: CustomerVatScenario,
  countryCode: string,
  basis: PlaceOfSupplyBasis,
  caveats: readonly CustomerVatCaveat[],
): CustomerVatSuggestion {
  return {
    kind: 'suggestion',
    scenario,
    countryCode,
    vatRate: GREEK_EXEMPT_VAT_RATE,
    vatExemptionCategory: PLACE_OF_SUPPLY_EXEMPTION_CODE,
    invoiceType: scenario === 'eu_business' ? 'service_invoice_eu' : 'service_invoice_3rd',
    basis,
    caveats,
  };
}

/** Η μία κρίση: πελάτης + τύπος παραστατικού → πρόταση / άγνωστη χώρα / τίποτα. */
export function assessCustomerVatTreatment(customer: CustomerVatFacts, invoiceType: InvoiceType): CustomerVatAssessment {
  if (!SERVICE_INVOICE_FAMILY.has(invoiceType)) return NONE;
  const stored = toStoredCountryCode(customer.country);
  if (stored === undefined || stored === GREECE) return NONE;
  // Άγνωστο κείμενο μένει αυτούσιο στο `toStoredCountryCode` — δεν είναι κωδικός, και δεν το μαντεύουμε.
  if (countryNameToCode(stored) === null) return { kind: 'unknown_country', country: stored };

  const business = hasDeclaredVatNumber(customer.vatNumber);
  if (isEuMemberState(stored)) {
    // Ιδιώτης ΕΕ: §2β — ο τόπος είναι η Ελλάδα, ο ΦΠΑ ελληνικός.
    return business
      ? suggestion('eu_business', stored, 'art18_2a', ['immovableProperty', 'vatNumberNotVerified'])
      : NONE;
  }
  return business
    ? suggestion('non_eu_business', stored, 'art18_2a', ['immovableProperty', 'vatNumberNotVerified'])
    : suggestion('non_eu_consumer', stored, 'art18_15', ['listedServicesOnly', 'immovableProperty']);
}

/**
 * Δεδομένα **ανά σενάριο** (μεταχείριση EN 16931 §22.6, πεδίο Φ2 §22.7): ο τόπος παροχής κρίνεται ΜΙΑ φορά, εδώ.
 * - `unknown_country` — η χώρα δεν αναγνωρίζεται· καμία μαντεψιά ΕΕ / εκτός ΕΕ.
 * - `scenario_mismatch` — η αιτία λέει «τόπος εκτός Ελλάδας», αλλά ο πελάτης/τύπος **δεν** το στηρίζει (ελληνικός
 *   πελάτης, ιδιώτης ΕΕ — §2β, ή μη παροχή υπηρεσιών): αντίφαση, όχι κενό αντιστοίχισης.
 */
export type CustomerScenarioOutcome<T> =
  | { readonly value: T; readonly scenario: CustomerVatScenario }
  | 'unknown_country'
  | 'scenario_mismatch';

/** Επιλέγει την τιμή του σεναρίου του πελάτη — η **μία** γέφυρα από τα δεδομένα ανά σενάριο προς τον κριτή. */
export function resolveByCustomerScenario<T>(
  byScenario: Readonly<Record<CustomerVatScenario, T>>,
  customer: CustomerVatFacts,
  invoiceType: InvoiceType,
): CustomerScenarioOutcome<T> {
  const assessment = assessCustomerVatTreatment(customer, invoiceType);
  if (assessment.kind === 'unknown_country') return 'unknown_country';
  if (assessment.kind === 'none') return 'scenario_mismatch';
  return { value: byScenario[assessment.scenario], scenario: assessment.scenario };
}

/** Η αφετηρία ΦΠΑ των **νέων** γραμμών όταν ο άνθρωπος αποδέχθηκε την πρόταση (κρίκος πάνω από την εταιρεία). */
export function lineVatDefaultOf(accepted: CustomerVatSuggestion): CompanyLineVatDefault {
  return { vatRate: accepted.vatRate, vatExemptionCategory: accepted.vatExemptionCategory };
}

/**
 * Ταυτότητα «αυτή η πρόταση, γι' αυτόν τον πελάτη». Η απόρριψη ισχύει **μόνο** γι' αυτήν: αλλάζει χώρα, ΑΦΜ ή
 * σενάριο ⇒ νέα ταυτότητα ⇒ η πρόταση ξαναβγαίνει.
 */
export function customerVatSuggestionKey(customer: CustomerVatFacts, assessment: CustomerVatSuggestion): string {
  return [assessment.scenario, assessment.countryCode, (customer.vatNumber ?? '').trim()].join('|');
}
