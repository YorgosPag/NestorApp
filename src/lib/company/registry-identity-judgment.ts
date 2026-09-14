/**
 * @fileoverview **ΕΙΝΑΙ Η ΔΗΛΩΣΗ ΕΠΑΛΗΘΕΥΜΕΝΗ;** — η κρίση, στην ανάγνωση (ADR-841 §7 Α23).
 * @module lib/company/registry-identity-judgment
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ «ΕΠΑΛΗΘΕΥΜΕΝΟ» ΔΕΝ ΑΠΟΘΗΚΕΥΕΤΑΙ — ΠΑΡΑΓΕΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Stripe κρατά κατάσταση επαλήθευσης και την **ξανανοίγει** όταν αλλάξει κάτι
 * (`requirements.currently_due`) — δηλαδή κάποιος γραφέας πρέπει να **θυμηθεί** να την
 * ξανανοίξει. Εδώ το ζεύγος *(δήλωση προφίλ, απάντηση μητρώου)* κρίνεται **κάθε φορά που
 * διαβάζεται**: αλλάξει ο αριθμός ή η επωνυμία στο προφίλ, το σήμα πέφτει **στην επόμενη
 * ανάγνωση**, χωρίς κανέναν γραφέα. Ίδιο δόγμα με το παράγωγο `standing` της βιτρίνας (Φ6-Β).
 *
 * | Σειρά | Ερώτηση | Κενό |
 * |---|---|---|
 * | 1 | έχει ο οργανισμός αριθμό; | `no-registration-number` |
 * | 2 | είναι αριθμός ΓΕΜΗ; | `invalid-registration-number` |
 * | 3 | ρωτήθηκε ποτέ / διαβάζεται η απάντηση; | `not-checked` · `check-unreadable` |
 * | 4 | η απάντηση αφορά **αυτόν** τον αριθμό; | `number-mismatch` |
 * | 5 | είναι ενεργή; | `inactive` · `status-unknown` |
 * | 6 | ίδια επωνυμία; | `name-mismatch` |
 *
 * ⚠️ Το `not-in-registry` **δεν** παράγεται εδώ: είναι γνώση **μιας συγκεκριμένης ερώτησης**
 * (το μητρώο μόλις απάντησε «δεν υπάρχει»), όχι του αποθηκευμένου ζεύγους. Το ορίζει η πράξη
 * επαλήθευσης.
 *
 * **Layering**: καθαρή — πελάτης και διακομιστής.
 */

import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { sameLegalName } from '@/lib/company/legal-name-match';
import type {
  DeclaredRegistryIdentity,
  RegistryCheck,
  RegistryCheckRead,
  RegistryCompanyRecord,
  RegistryIdentityGap,
  RegistryIdentityJudgment,
} from '@/types/company-registry';

function declared(gap: RegistryIdentityGap, check: RegistryCheck | null): RegistryIdentityJudgment {
  return { state: 'declared', gap, check };
}

function gapOf(
  canonicalNumber: string,
  legalName: string | null,
  record: RegistryCompanyRecord,
): RegistryIdentityGap | null {
  if (record.registrationNumber !== canonicalNumber) return 'number-mismatch';
  if (record.status.activity === 'inactive') return 'inactive';
  if (record.status.activity === 'unknown') return 'status-unknown';
  if (!sameLegalName(legalName, record.legalName)) return 'name-mismatch';
  return null;
}

export function judgeRegistryIdentity(
  identity: DeclaredRegistryIdentity,
  stored: RegistryCheckRead,
): RegistryIdentityJudgment {
  const number = identity.registrationNumber?.trim() ?? '';
  if (number === '') return declared('no-registration-number', null);
  const canonical = canonicalGemiNumber(number);
  if (canonical === null) return declared('invalid-registration-number', null);
  if (stored.kind === 'absent') return declared('not-checked', null);
  if (stored.kind === 'unavailable') return declared('check-unreadable', null);

  const gap = gapOf(canonical, identity.legalName, stored.check.record);
  return gap === null
    ? { state: 'verified', issuer: 'gemi', check: stored.check }
    : declared(gap, stored.check);
}
