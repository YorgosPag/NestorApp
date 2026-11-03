/**
 * @fileoverview **ΑΝΗΚΕΙ ΤΟ ΔΗΛΩΜΕΝΟ ΑΦΜ ΣΤΟΝ ΔΗΛΩΜΕΝΟ ΑΡ. ΓΕΜΗ;** — η καθαρή κρίση (ADR-923 §5.13 Ε1β).
 * @related services/company-registry/gemi-opendata.client.ts (`lookupRegistryNumbersByTaxId`) ·
 *   lib/company/registry-identity-judgment.ts (η κρίση αριθμού και επωνυμίας)
 * @module lib/company/registry-tax-binding
 *
 * | Απάντηση αναζήτησης | Κρίση |
 * |---|---|
 * | ο δηλωμένος αριθμός είναι ανάμεσα στα αποτελέσματα | `matched` |
 * | αποτελέσματα χωρίς τον δηλωμένο αριθμό | `mismatched` |
 * | κανένα αποτέλεσμα | `not-found` |
 * | χωρίς έγκυρο αριθμό · άκυρο ΑΦΜ | `not-comparable` |
 * | το μητρώο δεν απάντησε | `undetermined`, **ποτέ** έγκριση και ποτέ «όχι» |
 *
 * ⚠️ Ανεπαλήθευτο ζωντανά: πολλαπλά αποτελέσματα, υποκαταστήματα, κλειστές εγγραφές με το ίδιο ΑΦΜ.
 *
 * **Layering**: καθαρή — πελάτης και διακομιστής.
 */

import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import type { RegistryTaxBinding, RegistryTaxSearchVerdict } from '@/types/company-registry';

export function judgeRegistryTaxBinding(
  declaredNumber: string | null | undefined,
  search: RegistryTaxSearchVerdict,
): RegistryTaxBinding {
  const canonical = canonicalGemiNumber(declaredNumber);
  if (canonical === null) return { state: 'not-comparable', gap: 'no-registration-number' };
  if (search.kind === 'invalid-tax-id') return { state: 'not-comparable', gap: 'invalid-tax-id' };
  if (search.kind === 'unavailable') return { state: 'undetermined', reason: search.reason };
  if (search.registrationNumbers.length === 0) return { state: 'not-found' };
  return search.registrationNumbers.includes(canonical) ? { state: 'matched' } : { state: 'mismatched' };
}
