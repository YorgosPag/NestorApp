/**
 * @fileoverview **«ΕΛΕΓΧΟΣ ΣΤΟ ΓΕΜΗ» ΓΙΑ ΜΙΑ ΕΠΑΦΗ-ΕΤΑΙΡΕΙΑ** — οι τύποι που ταξιδεύουν από την υπηρεσία στην οθόνη
 * (ADR-948 §8 Βήμα 4). Ζουν εδώ (όχι στον `server-only` κώδικα) ώστε να τους βλέπει και ο client.
 * @module types/contact-registry-check
 *
 * 🔑 Ό,τι λέει η αναφορά οδηγεί σε **άλλη** πράξη ανθρώπου — «δεν βρέθηκε» ≠ «δεν μπόρεσα να ρωτήσω» ≠
 * «το ΓΕΜΗ λέει φυσικό πρόσωπο». Καμία κατάσταση δεν συμπτύσσεται σε άλλη.
 */

import type { ContactRegistryComparison } from '@/lib/company/contact-registry-comparison';
import type { LegalFormRefusal } from '@/lib/company/registry-legal-person';
import type { RegistryCheck, RegistryUnavailableReason } from '@/types/company-registry';

/**
 * **Με τι ρωτάμε το ΓΕΜΗ** — υπολογίζεται από την **αποθηκευμένη** επαφή, ποτέ από σώμα αιτήματος.
 * Ο Αρ. ΓΕΜΗ προηγείται· αλλιώς το ΑΦΜ (ADR-948 §8.4).
 */
export type ContactRegistryQuery =
  | { readonly kind: 'gemi-number'; readonly registrationNumber: string }
  | { readonly kind: 'tax-id'; readonly taxId: string }
  /** Ούτε έγκυρος Αρ. ΓΕΜΗ ούτε έγκυρο ΑΦΜ — δεν ρωτάμε. */
  | { readonly kind: 'none' };

/** Τι έμαθε **αυτή** η κλήση. */
export type ContactRegistryAttempt =
  /** Η ανάγνωση της οθόνης — καμία κλήση. */
  | { readonly kind: 'not-asked' }
  /** Ρωτήθηκε, πέρασε τον φράχτη και αποθηκεύτηκε. */
  | { readonly kind: 'asked' }
  /** Η επαφή άλλαξε αριθμό/ΑΦΜ όσο ρωτούσαμε ⇒ η απάντηση δεν την αφορά πια· τίποτα δεν γράφτηκε. */
  | { readonly kind: 'contact-changed' }
  /** Η επαφή δεν έχει ούτε Αρ. ΓΕΜΗ ούτε έγκυρο ΑΦΜ. */
  | { readonly kind: 'no-identifier' }
  /** Ρωτήθηκε καθαρά και **δεν υπάρχει** στο ΓΕΜΗ. */
  | { readonly kind: 'not-found' }
  /** Το ΑΦΜ αντιστοιχεί σε **πολλούς** αριθμούς (π.χ. υποκαταστήματα) — ο άνθρωπος γράφει τον σωστό στη φόρμα. */
  | { readonly kind: 'ambiguous'; readonly registrationNumbers: readonly string[] }
  /** Ο φράχτης «όχι φυσικό πρόσωπο» (ADR-948 §8.3) αρνήθηκε — **τίποτα** δεν αποθηκεύτηκε. */
  | { readonly kind: 'refused'; readonly reason: LegalFormRefusal }
  /** Δεν μπόρεσα να ρωτήσω — **ποτέ** «δεν υπάρχει». */
  | { readonly kind: 'unavailable'; readonly reason: RegistryUnavailableReason };

/**
 * Η αναφορά προς την οθόνη: τι έγινε τώρα, ποια είναι η τελευταία αποθηκευμένη απάντηση, και η σύγκριση
 * της **τρέχουσας** επαφής με αυτήν (υπολογισμένη κάθε φορά — ποτέ αποθηκευμένη σημαία που μπορεί να πει ψέματα).
 */
export interface ContactRegistryReport {
  readonly attempt: ContactRegistryAttempt;
  /** `null` ⇒ καμία αποθηκευμένη απάντηση (ή δεν διαβάστηκε). */
  readonly check: RegistryCheck | null;
  /** `null` ⇒ δεν υπάρχει απάντηση **ή** η αποθηκευμένη δεν περνά πια τον φράχτη (άλλαξε ο χάρτης). */
  readonly comparison: ContactRegistryComparison | null;
}

/** Το αποθηκευμένο έγγραφο `contact_registry_checks/{contactId}` — γράφει και διαβάζει μόνο ο διακομιστής. */
export interface ContactRegistryCheckRecord extends RegistryCheck {
  readonly companyId: string;
  readonly contactId: string;
  readonly checkedBy: string;
}
