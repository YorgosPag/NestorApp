/**
 * @fileoverview **Αιτία εξαίρεσης §8.3 → δήλωση ΦΠΑ (Φ2) — ο ΕΝΑΣ επιλυτής** (ADR-ACC-003 §22.7).
 * @module subapps/accounting/services/tax/vat-return-treatment
 *
 * Καθαρές συναρτήσεις, δύο πλευρές του ίδιου παραστατικού:
 * - **Εκδότης** — `resolveVatReturnTreatment`: σε ποιο πεδίο εκροών του Φ2 πάει η αξία μιας γραμμής 0%, ή ρητά «δεν
 *   υποβάλλεται» / «χωρίς πεδίο», ή ρητή ανάγκη ελέγχου. Ποτέ μαντεψιά.
 * - **Λήπτης** — `recipientVatClassificationOf`: ποιον χαρακτηρισμό ΦΠΑ myDATA (§8.11) **απαιτεί** η αιτία, όταν τον
 *   απαιτεί (αιτία 16 ⇒ `VAT_366` με κατηγορία 24% / 17% — σφάλματα 317 / 334).
 *
 * 🔑 **Τα δεδομένα ζουν στον ΕΝΑ κατάλογο** (`VAT_EXEMPTION_REASONS[].vatReturn`)· εδώ μόνο η επίλυση. Η αιτία 4 λύνεται
 * από τον ΕΝΑ κριτή τόπου παροχής της §22.5 (`resolveByCustomerScenario`) — ίδια κρίση με την EN 16931 (§22.6).
 *
 * Κανένας καταναλωτής παραγωγής ακόμη (έδαφος για προεπισκόπηση Φ2 και χαρακτηρισμό εξόδων) — **ΜΗΝ** σβηστεί ως νεκρό.
 *
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import type { InvoiceType } from '../../types/invoice';
import {
  MYDATA_SELF_ASSESSED_VAT_CATEGORIES,
  type MyDataExpenseVatClassification,
} from '../mydata/mydata-codes';
import {
  vatReturnMappingOf,
  type MappingFidelity,
  type VatExemptionCode,
  type VatReturnFieldTreatment,
  type VatReturnSource,
} from '../config/vat-exemption-reasons';
import { isDeductibleVatReturnField, type VatReturnExemptOutputField } from '../config/vat-return-form';
import { resolveByCustomerScenario, type CustomerVatFacts, type CustomerVatScenario } from './customer-vat-treatment';

// ============================================================================
// ΛΕΞΙΛΟΓΙΟ
// ============================================================================

export interface VatReturnLineFacts {
  readonly vatExemptionCategory: VatExemptionCode;
  readonly customer: CustomerVatFacts;
  readonly invoiceType: InvoiceType;
}

export interface VatReturnResolved {
  readonly kind: 'resolved';
  readonly field: VatReturnExemptOutputField;
  /** Δίνουν οι πράξεις του πεδίου δικαίωμα έκπτωσης (επικεφαλίδα του εντύπου). */
  readonly deductible: boolean;
  readonly fidelity: MappingFidelity;
  readonly sources: readonly VatReturnSource[];
  /** Το σενάριο πελάτη, όταν το πεδίο εξαρτάται από αυτό (αιτία 4). */
  readonly scenario: CustomerVatScenario | null;
}

/** Ο εκδότης δεν υποβάλλει Φ2 (15) ή η γραμμή δεν συσχετίζεται με πεδίο (22) — **ρητή** απάντηση, όχι κενό. */
export interface VatReturnNoFieldResolution {
  readonly kind: 'not_filed' | 'not_reported';
  readonly sources: readonly VatReturnSource[];
}

/** Ίδιοι λόγοι με τον επιλυτή EN 16931: κενό αντιστοίχισης · αντίφαση πελάτη/αιτίας · άγνωστη χώρα. */
export type VatReturnReviewReason = 'unmapped' | 'scenario_mismatch' | 'unknown_country';

export type VatReturnResolution =
  | VatReturnResolved
  | VatReturnNoFieldResolution
  | { readonly kind: 'needs_review'; readonly reason: VatReturnReviewReason };

/** Ο χαρακτηρισμός ΦΠΑ του λήπτη, όπως τον απαιτεί η αιτία. */
export type RecipientVatClassification =
  | {
      readonly kind: 'required';
      readonly classification: MyDataExpenseVatClassification;
      /** Οι κατηγορίες ΦΠΑ §8.2 της αυτοεπιβάρυνσης (σφάλμα 334). */
      readonly vatCategories: readonly number[];
      readonly sources: readonly VatReturnSource[];
    }
  | { readonly kind: 'by_purchase' };

// ============================================================================
// ΕΠΙΛΥΣΗ
// ============================================================================

function resolved(treatment: VatReturnFieldTreatment, scenario: CustomerVatScenario | null): VatReturnResolved {
  return {
    kind: 'resolved',
    field: treatment.field,
    deductible: isDeductibleVatReturnField(treatment.field),
    fidelity: treatment.fidelity,
    sources: treatment.sources,
    scenario,
  };
}

/** Πλευρά εκδότη: η μία επίλυση του πεδίου Φ2 μιας γραμμής 0%. */
export function resolveVatReturnTreatment(facts: VatReturnLineFacts): VatReturnResolution {
  const { output } = vatReturnMappingOf(facts.vatExemptionCategory);
  switch (output.kind) {
    case 'field':
      return resolved(output, null);
    case 'not_filed':
    case 'not_reported':
      return { kind: output.kind, sources: output.sources };
    case 'unmapped':
      return { kind: 'needs_review', reason: 'unmapped' };
    case 'byCustomerScenario': {
      const outcome = resolveByCustomerScenario(output.byScenario, facts.customer, facts.invoiceType);
      if (typeof outcome === 'string') return { kind: 'needs_review', reason: outcome };
      return resolved(outcome.value, outcome.scenario);
    }
  }
}

/** Πλευρά λήπτη: ο χαρακτηρισμός ΦΠΑ που **απαιτεί** η αιτία, ή `by_purchase` όταν δεν τον κρίνει. */
export function recipientVatClassificationOf(code: VatExemptionCode): RecipientVatClassification {
  const { recipient } = vatReturnMappingOf(code);
  if (recipient.kind === 'by_purchase') return recipient;
  return {
    kind: 'required',
    classification: recipient.classification,
    vatCategories: MYDATA_SELF_ASSESSED_VAT_CATEGORIES,
    sources: recipient.sources,
  };
}
