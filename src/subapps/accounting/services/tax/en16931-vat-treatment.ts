/**
 * @fileoverview **Αιτία εξαίρεσης §8.3 → μεταχείριση EN 16931 — ο ΕΝΑΣ επιλυτής** (ADR-ACC-003 §22.6).
 * @module subapps/accounting/services/tax/en16931-vat-treatment
 *
 * Καθαρή συνάρτηση: (αιτία §8.3, πελάτης, τύπος παραστατικού, προφίλ) → κατηγορία ΦΠΑ (BT-118/151) + VATEX (BT-121)
 * + οι κανόνες EN 16931 της κατηγορίας, ή **ρητή** ανάγκη ελέγχου. Επιστρέφει ταυτότητες, ποτέ κείμενο: το BT-120
 * είναι η ήδη υπάρχουσα παραπομπή `vatExemptionCitation` (ίδια με το PDF).
 *
 * 🔑 **Τα δεδομένα ζουν στον ΕΝΑ κατάλογο** (`VAT_EXEMPTION_REASONS[].en16931`)· εδώ ζει μόνο η επίλυση. Για την αιτία 4
 * (τόπος παροχής) το σενάριο το δίνει ο ΕΝΑΣ κριτής της §22.5 (`assessCustomerVatTreatment`) — δεν ξαναγράφεται.
 *
 * 🔑 **Δύο προφίλ, καμία σιωπηλή εφεδρεία**:
 * - `en16931` — ό,τι λέει ο κατάλογος. `unmapped` ⇒ `needs_review`.
 * - `gr-b2g-peppol` — Ελληνικός μορφότυπος PEPPOL BIS v8.1 της ΓΓΠΣ (σελ. 78): στο B2G το BT-121 είναι υποχρεωτικό, και
 *   όπου η αντιστοίχιση δεν είναι ακριβής μπαίνει **O + VATEX-EU-O**. Η εφεδρεία επιστρέφεται **σημαδεμένη**
 *   (`basis: 'gsis_fallback'`, με την αρχική κρίση), επειδή συγκρούεται με τα BR-O-02 / BR-O-11 του EN 16931 όταν ο
 *   πωλητής έχει ΑΦΜ ΦΠΑ — ο preflight πρέπει να το δει, όχι να το ανακαλύψει ο πάροχος.
 *
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import type { InvoiceType } from '../../types/invoice';
import {
  en16931CategoryRules,
  type En16931CategoryRules,
  type En16931ExemptCategory,
  type VatexCode,
} from '../config/en16931-vat-codes';
import {
  en16931MappingOf,
  type En16931Fidelity,
  type En16931FixedTreatment,
  type VatExemptionCode,
} from '../config/vat-exemption-reasons';
import { resolveByCustomerScenario, type CustomerVatFacts, type CustomerVatScenario } from './customer-vat-treatment';

// ============================================================================
// ΛΕΞΙΛΟΓΙΟ
// ============================================================================

export const EN16931_PROFILES = ['en16931', 'gr-b2g-peppol'] as const;
export type En16931Profile = (typeof EN16931_PROFILES)[number];

/** Από πού προήλθε η μεταχείριση. */
export type En16931Basis = 'catalog' | 'customer_scenario' | 'gsis_fallback';

export interface En16931LineFacts {
  readonly vatExemptionCategory: VatExemptionCode;
  readonly customer: CustomerVatFacts;
  readonly invoiceType: InvoiceType;
}

export interface En16931Resolved {
  readonly kind: 'resolved';
  readonly category: En16931ExemptCategory;
  readonly vatex: VatexCode | null;
  /** `fallback` = εφεδρεία ΓΓΠΣ — **όχι** νομική αντιστοίχιση. */
  readonly fidelity: En16931Fidelity | 'fallback';
  readonly basis: En16931Basis;
  /** Το σενάριο πελάτη, όταν η μεταχείριση εξαρτάται από αυτό (αιτία 4). */
  readonly scenario: CustomerVatScenario | null;
  /** Η κρίση του καταλόγου που **αντικατέστησε** η εφεδρεία ΓΓΠΣ (`null` αν δεν υπήρχε κρίση). */
  readonly supersededCategory: En16931ExemptCategory | null;
  readonly rules: En16931CategoryRules;
}

/**
 * - `unmapped` — ο κωδικός §8.3 μόνος του δεν κρίνει κατηγορία (π.χ. 5, 17, 20, 29–31).
 * - `scenario_mismatch` — αιτία τόπου παροχής, αλλά ο πελάτης/τύπος **δεν** στηρίζει τόπο εκτός Ελλάδας (ελληνικός
 *   πελάτης, ιδιώτης ΕΕ — άρθρο 18 §2β, ή μη παροχή υπηρεσιών): αντίφαση, όχι κενό αντιστοίχισης.
 * - `unknown_country` — η χώρα του πελάτη δεν αναγνωρίζεται· δεν μαντεύουμε ΕΕ / εκτός ΕΕ.
 */
export type En16931ReviewReason = 'unmapped' | 'scenario_mismatch' | 'unknown_country';

export type En16931Resolution = En16931Resolved | { readonly kind: 'needs_review'; readonly reason: En16931ReviewReason };

// ============================================================================
// ΕΠΙΛΥΣΗ
// ============================================================================

/** Εφεδρεία ΓΓΠΣ (BIS v8.1, σελ. 78): «κατ' οικονομία BT-118=O και BT-121=VATEX-EU-O». */
const GSIS_FALLBACK_CATEGORY = 'O';
const GSIS_FALLBACK_VATEX: VatexCode = 'VATEX-EU-O';

function fromTreatment(
  treatment: En16931FixedTreatment,
  basis: En16931Basis,
  scenario: CustomerVatScenario | null,
): En16931Resolved {
  return {
    kind: 'resolved',
    category: treatment.category,
    vatex: treatment.vatex,
    fidelity: treatment.fidelity,
    basis,
    scenario,
    supersededCategory: null,
    rules: en16931CategoryRules(treatment.category),
  };
}

function gsisFallback(
  supersededCategory: En16931ExemptCategory | null,
  scenario: CustomerVatScenario | null,
): En16931Resolved {
  return {
    kind: 'resolved',
    category: GSIS_FALLBACK_CATEGORY,
    vatex: GSIS_FALLBACK_VATEX,
    fidelity: 'fallback',
    basis: 'gsis_fallback',
    scenario,
    supersededCategory,
    rules: en16931CategoryRules(GSIS_FALLBACK_CATEGORY),
  };
}

/** Η κρίση του καταλόγου πριν από το προφίλ — `treatment: null` = `unmapped`. */
interface CatalogOutcome {
  readonly treatment: En16931FixedTreatment | null;
  readonly scenario: CustomerVatScenario | null;
}

/** Η κατάληξη του καταλόγου (πριν από το προφίλ): μεταχείριση + σενάριο, ή λόγος ελέγχου. */
function catalogTreatment(facts: En16931LineFacts): CatalogOutcome | En16931ReviewReason {
  const mapping = en16931MappingOf(facts.vatExemptionCategory);
  if (mapping.kind === 'fixed') return { treatment: mapping, scenario: null };
  if (mapping.kind === 'unmapped') return { treatment: null, scenario: null };
  const outcome = resolveByCustomerScenario(mapping.byScenario, facts.customer, facts.invoiceType);
  if (typeof outcome === 'string') return outcome;
  return { treatment: outcome.value, scenario: outcome.scenario };
}

/**
 * Η μία επίλυση. Στο `gr-b2g-peppol` η εφεδρεία ΓΓΠΣ καλύπτει **μόνο** ό,τι δεν έχει VATEX (κενό αντιστοίχισης) — ποτέ
 * αντίφαση ή άγνωστη χώρα, που είναι λάθη δεδομένων και πρέπει να διορθωθούν.
 */
export function resolveEn16931VatTreatment(facts: En16931LineFacts, profile: En16931Profile): En16931Resolution {
  const outcome = catalogTreatment(facts);
  if (typeof outcome === 'string') return { kind: 'needs_review', reason: outcome };
  const { treatment, scenario } = outcome;
  const basis: En16931Basis = scenario === null ? 'catalog' : 'customer_scenario';

  if (profile === 'gr-b2g-peppol' && (treatment === null || treatment.vatex === null)) {
    return gsisFallback(treatment?.category ?? null, scenario);
  }
  if (treatment === null) return { kind: 'needs_review', reason: 'unmapped' };
  return fromTreatment(treatment, basis, scenario);
}
