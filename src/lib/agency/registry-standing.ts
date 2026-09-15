/**
 * @fileoverview **ΠΟΥ ΣΤΕΚΕΤΑΙ Ο ΟΡΓΑΝΙΣΜΟΣ ΑΠΕΝΑΝΤΙ ΣΤΟ ΓΕΜΗ;** — μία απάντηση για την πόρτα της βιτρίνας
 * και την υποσελίδα «Στοιχεία ΓΕΜΗ» (ADR-841 §7 Α23.9 Φέτα Β).
 * @related lib/agency/showcase-registry-closure.ts · lib/company/registry-identity-judgment.ts
 * @module lib/agency/registry-standing
 *
 * 🔑 **Δύο πηγές, μία σειρά — και η σειρά είναι η απόφαση**:
 *
 * | Σειρά | Πηγή | Απάντηση |
 * |---|---|---|
 * | 1 | το κλείσιμο της **δημοσιευμένης** βιτρίνας (`registryClosure`) | `closed` — ό,τι βλέπει ήδη ο κόσμος |
 * | 2 | η κρίση ταυτότητας (`RegistryIdentityReport`, μόνο διαχειριστής) | `verified` · `attention` · `unregistered` |
 * | — | καμία αναφορά (φορτώνει · όχι διαχειριστής · βλάβη) | `unknown` — **ποτέ** «όλα καλά» |
 *
 * ⚠️ **Το κλείσιμο προηγείται, επίτηδες**: είναι η **δημόσια** αλήθεια (Google Business Profile — η σελίδα
 * *«clearly shows that your business is closed»*). Μια νέα επαλήθευση που βρίσκει την επιχείρηση ενεργή
 * ξαναγράφει τη βιτρίνα **μετά** την απάντηση (`reconcileShowcaseLegalIdentity`), και η ένδειξη σβήνει μόνη
 * της στο επόμενο στιγμιότυπο — καμία οθόνη δεν δηλώνει «ενεργή» πριν το μάθει ο κόσμος.
 *
 * ⚠️ `no-registration-number` ⇒ `unregistered`, **όχι** `attention`: ο ελεύθερος επαγγελματίας **δεν έχει**
 * ΓΕΜΗ και δεν του λείπει τίποτα (ίδιο δόγμα με το `registryNone` της βιτρίνας).
 *
 * **Layering**: leaf — καθαρό, πελάτης και διακομιστής.
 */

import type {
  RegistryIdentityGap,
  RegistryIdentityJudgment,
  RegistryIdentityReport,
} from '@/types/company-registry';
import type { RegistryClosure } from '@/types/showcase-legal-identity';

/** Τα κενά που ζητούν **πράξη** από τον άνθρωπο — όλα εκτός από «δεν έχει αριθμό». */
export type RegistryAttentionGap = Exclude<RegistryIdentityGap, 'no-registration-number'>;

export type RegistryStanding =
  | { readonly kind: 'closed'; readonly closure: RegistryClosure }
  | { readonly kind: 'verified'; readonly checkedAt: string }
  | { readonly kind: 'attention'; readonly gap: RegistryAttentionGap }
  | { readonly kind: 'unregistered' }
  | { readonly kind: 'unknown' };

export function registryStandingOf(
  closure: RegistryClosure | null,
  report: RegistryIdentityReport | null,
): RegistryStanding {
  if (closure !== null) return { kind: 'closed', closure };
  if (report === null) return { kind: 'unknown' };
  const { judgment } = report;
  if (judgment.state === 'verified') return { kind: 'verified', checkedAt: judgment.check.checkedAt };
  if (judgment.gap === 'no-registration-number') return { kind: 'unregistered' };
  return { kind: 'attention', gap: judgment.gap };
}

/** Η ημερομηνία ελέγχου που φαίνεται **δίπλα** στην ένδειξη — ποτέ σήμα χωρίς πότε (ADR-798 §7). */
export function standingCheckedAt(standing: RegistryStanding): string | null {
  if (standing.kind === 'closed') return standing.closure.checkedAt;
  return standing.kind === 'verified' ? standing.checkedAt : null;
}

/**
 * Κενά που διορθώνονται **μόνο** στον αριθμό ΓΕΜΗ του προφίλ (λείπει · άκυρος · δεν υπάρχει · άλλη επιχείρηση ·
 * ανενεργή). 🔑 Τα υπόλοιπα θεραπεύονται αλλού: «ξαναρωτήστε» (`not-checked`/`check-unreadable`/`status-unknown`),
 * «υιοθετήστε» (`name-mismatch`).
 */
const NUMBER_FIX_GAPS: ReadonlySet<RegistryIdentityGap> = new Set<RegistryIdentityGap>([
  'no-registration-number',
  'invalid-registration-number',
  'not-in-registry',
  'number-mismatch',
  'inactive',
]);

export function needsRegistrationFix(judgment: RegistryIdentityJudgment): boolean {
  return judgment.state === 'declared' && NUMBER_FIX_GAPS.has(judgment.gap);
}
