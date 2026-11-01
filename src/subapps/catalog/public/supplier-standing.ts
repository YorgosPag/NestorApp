/**
 * @fileoverview **ΕΙΝΑΙ ΕΠΙΒΕΒΑΙΩΜΕΝΟΣ Ο ΠΡΟΜΗΘΕΥΤΗΣ;** — η μία κρίση, στην ανάγνωση (ADR-923 §5.13 · §16).
 * @related lib/company/registry-identity-judgment.ts · subapps/catalog/public/supplier-verification-route.ts
 * @module subapps/catalog/public/supplier-standing
 *
 * Το «επιβεβαιωμένο» δεν αποθηκεύεται, παράγεται (ίδιο δόγμα με το ADR-841 Α23): αλλάξει επωνυμία, αριθμός ή
 * ΑΦΜ, η κρίση πέφτει στην επόμενη ανάγνωση χωρίς κανέναν γραφέα.
 *
 * 🔑 Το `not-in-registry` είναι γνώση μιας ερώτησης και δεν αποθηκεύεται, άρα εγκεκριμένος προμηθευτής χωρίς
 * αντίγραφο ΓΕΜΗ διαβάζεται `not-checked`. Γι' αυτό η έγκριση ισχύει και στη διαλογή `ask-registry`, όσο το
 * στιγμιότυπό της συμφωνεί. Δεν ισχύει ποτέ για κλεισμένη εταιρεία, διαφορά επωνυμίας ή άκυρο ΑΦΜ.
 *
 * **Layering**: καθαρή — πελάτης και διακομιστής.
 */

import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { routeSupplierVerification } from '@/subapps/catalog/public/supplier-verification-route';
import type {
  StoredTaxBinding,
  SupplierApprovalSnapshot,
  SupplierIdentityFacts,
  SupplierStanding,
} from '@/subapps/catalog/types/supplier-verification';
import type { RegistryIdentityJudgment, RegistryTaxBinding } from '@/types/company-registry';

/** Η αποθηκευμένη ετυμηγορία ισχύει μόνο για το ίδιο ζεύγος ΑΦΜ και αριθμού. */
export function taxBindingFromStored(stored: StoredTaxBinding | null, facts: SupplierIdentityFacts): RegistryTaxBinding {
  if (facts.taxFingerprint === null) return { state: 'not-comparable', gap: 'invalid-tax-id' };
  const number = canonicalGemiNumber(facts.gemiNumber);
  if (number === null) return { state: 'not-comparable', gap: 'no-registration-number' };
  if (stored === null || stored.taxFingerprint !== facts.taxFingerprint || stored.registrationNumber !== number) {
    return { state: 'not-asked' };
  }
  return { state: stored.outcome };
}

function sameFacts(snapshot: SupplierApprovalSnapshot, facts: SupplierIdentityFacts): boolean {
  return (
    snapshot.legalName === facts.legalName &&
    canonicalGemiNumber(snapshot.gemiNumber) === canonicalGemiNumber(facts.gemiNumber) &&
    snapshot.taxFingerprint === facts.taxFingerprint
  );
}

export interface SupplierStandingInputs {
  readonly registry: RegistryIdentityJudgment;
  readonly taxBinding: RegistryTaxBinding;
  readonly facts: SupplierIdentityFacts;
  /** Στιγμιότυπο **εν ισχύ** έγκρισης· `null` σε κάθε άλλη κατάσταση ελέγχου. */
  readonly approval: SupplierApprovalSnapshot | null;
}

export function judgeSupplierStanding(inputs: SupplierStandingInputs): SupplierStanding {
  const route = routeSupplierVerification(inputs.registry, inputs.taxBinding);
  if (route.kind === 'verified') return { kind: 'verified', basis: 'registry' };
  const approvalCounts = route.kind === 'ask-registry' || (route.kind === 'manual-review' && route.approvable);
  if (approvalCounts && inputs.approval !== null && sameFacts(inputs.approval, inputs.facts)) {
    return { kind: 'verified', basis: 'manual-review' };
  }
  return { kind: 'unverified' };
}
