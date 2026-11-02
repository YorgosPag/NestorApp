/**
 * @fileoverview **ΠΟΥ ΠΑΕΙ ΑΥΤΟΣ Ο ΠΡΟΜΗΘΕΥΤΗΣ;** — η μία καθαρή διαλογή της επιβεβαίωσης (ADR-923 §5.13 Ε1α).
 * @related lib/company/registry-identity-judgment.ts · lib/company/registry-tax-binding.ts
 * @module subapps/catalog/public/supplier-verification-route
 *
 * | Αποτέλεσμα | Τι ακολουθεί |
 * |---|---|
 * | `verified` | αυτόματη επιβεβαίωση: ενεργή εταιρεία, ίδια επωνυμία, ΑΦΜ στον ίδιο αριθμό |
 * | `ask-registry` | ρώτα ξανά το μητρώο· ουρά δεν ανοίγει για βλάβη ή άγνοια |
 * | `adopt-legal-name` | η υπάρχουσα υιοθέτηση επωνυμίας του ΓΕΜΗ |
 * | `correct-tax-id` | διόρθωση ΑΦΜ στο προφίλ |
 * | `manual-review` με `approvable: true` | έλεγχος διαχειριστή με έγγραφα |
 * | `manual-review` με `approvable: false` | κλειστή στο ΓΕΜΗ: **καμία έγκριση**, μόνο νέο ερώτημα μετά από διόρθωση στο μητρώο |
 *
 * 🔑 Το `inactive` κρίνεται πρώτο: καμία άλλη διαφωνία δεν κάνει εγκρίσιμη μια κλεισμένη εταιρεία (§16).
 *
 * **Layering**: καθαρή — πελάτης και διακομιστής.
 */

import type { RegistryIdentityGap, RegistryIdentityJudgment, RegistryTaxBinding } from '@/types/company-registry';

export type SupplierVerificationRoute =
  | { readonly kind: 'verified' }
  | { readonly kind: 'ask-registry' }
  | { readonly kind: 'adopt-legal-name' }
  | { readonly kind: 'correct-tax-id' }
  | { readonly kind: 'manual-review'; readonly approvable: boolean };

const ASK_REGISTRY: SupplierVerificationRoute = { kind: 'ask-registry' };
const REVIEW: SupplierVerificationRoute = { kind: 'manual-review', approvable: true };

/** Εξαντλητικός χάρτης: νέο κενό στον τύπο δεν περνά χωρίς απόφαση. */
const ROUTE_OF_GAP: Readonly<Record<RegistryIdentityGap, SupplierVerificationRoute>> = {
  'no-registration-number': REVIEW,
  'invalid-registration-number': REVIEW,
  'not-in-registry': REVIEW,
  'status-unknown': REVIEW,
  // Η αποθηκευμένη απάντηση είναι για παλιό αριθμό: λύνεται με νέο ερώτημα, όχι με άνθρωπο.
  'number-mismatch': ASK_REGISTRY,
  'not-checked': ASK_REGISTRY,
  'check-unreadable': ASK_REGISTRY,
  'name-mismatch': { kind: 'adopt-legal-name' },
  inactive: { kind: 'manual-review', approvable: false },
};

function routeOfTaxBinding(binding: RegistryTaxBinding): SupplierVerificationRoute {
  switch (binding.state) {
    case 'matched':
      return { kind: 'verified' };
    case 'undetermined':
    case 'not-asked':
      return ASK_REGISTRY;
    case 'not-comparable':
      return binding.gap === 'invalid-tax-id' ? { kind: 'correct-tax-id' } : REVIEW;
    case 'mismatched':
    case 'not-found':
      return REVIEW;
  }
}

export function routeSupplierVerification(
  registry: RegistryIdentityJudgment,
  binding: RegistryTaxBinding,
): SupplierVerificationRoute {
  return registry.state === 'declared' ? ROUTE_OF_GAP[registry.gap] : routeOfTaxBinding(binding);
}

/**
 * Το ένα σημείο που λέει αν άνθρωπος μπορεί να εγκρίνει. Το ρωτούν η κρίση στην ανάγνωση και η απόφαση της ουράς:
 * το `ask-registry` μετρά, γιατί η άγνοια του μητρώου δεν ακυρώνει έλεγχο εγγράφου. Κλεισμένη εταιρεία, διαφορά
 * επωνυμίας και άκυρο ΑΦΜ δεν εγκρίνονται ποτέ.
 */
export function routeAllowsApproval(route: SupplierVerificationRoute): boolean {
  return route.kind === 'ask-registry' || (route.kind === 'manual-review' && route.approvable);
}
