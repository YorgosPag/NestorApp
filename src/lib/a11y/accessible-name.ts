/**
 * @fileoverview **ΤΟ ΟΝΟΜΑ ΕΝΟΣ ΧΕΙΡΙΣΤΗΡΙΟΥ** — ο τύπος και ο έλεγχος, μία φορά.
 * @related ADR-598 G11 · ADR-841 §7 Α19.4δ · WCAG 4.1.2 · WCAG 2.5.3 · CLAUDE.md N.0.2
 * @module lib/a11y/accessible-name
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΕΝΝΗΘΗΚΕ ΕΠΕΙΔΗ Ο ΙΔΙΟΣ ΤΥΠΟΣ ΗΤΑΝ ΓΡΑΜΜΕΝΟΣ ΔΥΟ ΦΟΡΕΣ, ΚΑΙ ΕΡΧΟΤΑΝ ΤΡΙΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το «ακριβώς ένα από `aria-label` / `aria-labelledby`» ζούσε ως `AnchoredPopoverName`
 * και ως `PopoverDialogName`. Το `SearchableCombobox` χρειαζόταν το ίδιο (2026-09-21).
 *
 * 🔑 **Δύο ερωτήσεις, δύο εργαλεία — ο τύπος ΔΕΝ φτάνει μόνος του**:
 * - *«Δήλωσε όνομα;»* → ο **τύπος** (`never`): το ανώνυμο γίνεται σφάλμα μεταγλώττισης.
 * - *«Το όνομα που δήλωσε ΥΠΑΡΧΕΙ;»* → η **εκτέλεση** (`findMissingAccessibleName`): ένα
 *   `id` χωρίς `<label htmlFor>` που να δείχνει εκεί περνά κάθε τύπο και δεν ονομάζει
 *   τίποτα. Μετρήθηκε δύο φορές στο δέντρο (`fwa-vendor`, `customerTaxOffice`): ορατή
 *   ετικέτα, `htmlFor` προς στοιχείο που **δεν αποδόθηκε ποτέ**.
 *
 * *(React Aria `useLabel` ελέγχει μόνο το πρώτο, και μόνο στην εκτέλεση· κανένα
 * από τα React Aria / Fluent / MUI δεν ελέγχει το δεύτερο.)*
 */

/** Ρητό όνομα: **ακριβώς ένα** από τα δύο — το «και τα δύο» και το «κανένα» είναι αδύνατα. */
export type ExplicitAccessibleName =
  | { readonly 'aria-label': string; readonly 'aria-labelledby'?: never }
  | { readonly 'aria-labelledby': string; readonly 'aria-label'?: never };

/**
 * Το όνομα ενός **πεδίου φόρμας**: ή ρητό, ή σκέτο `id` — που σημαίνει *«με ονομάζει ένα
 * `<label htmlFor>`»*. Το δεύτερο ο τύπος **δεν** μπορεί να το επαληθεύσει· το κάνει το
 * `findMissingAccessibleName` στην εκτέλεση.
 *
 * ⚠️ Προτίμηση (WCAG 2.5.3 *Label in Name*): ορατή ετικέτα ⇒ `id` · ορατό κείμενο που δεν
 * είναι `<label>` (legend, κεφαλίδα) ⇒ `aria-labelledby` · τίποτα ορατό ⇒ `aria-label`.
 */
export type FieldAccessibleName =
  | (ExplicitAccessibleName & { readonly id?: string })
  | { readonly id: string; readonly 'aria-label'?: never; readonly 'aria-labelledby'?: never };

/**
 * **Έχει αυτό το πεδίο όνομα στο ΠΡΑΓΜΑΤΙΚΟ DOM;** `null` = ναι· αλλιώς η αιτία, για
 * μήνυμα προς τον προγραμματιστή.
 *
 * Κοιτά ό,τι θα κοιτούσε ο αναγνώστης οθόνης, με τη σειρά του αλγορίθμου accname:
 * `aria-labelledby` (**κάθε** στόχος πρέπει να υπάρχει) → `aria-label` → `<label>`.
 */
export function findMissingAccessibleName(input: HTMLInputElement): string | null {
  const labelledBy = input.getAttribute('aria-labelledby')?.trim();
  if (labelledBy) {
    const missing = labelledBy
      .split(/\s+/)
      .filter((id) => input.ownerDocument.getElementById(id) === null);
    return missing.length === 0
      ? null
      : `aria-labelledby points to missing element(s): ${missing.join(', ')}`;
  }
  if (input.getAttribute('aria-label')?.trim()) return null;
  if (input.labels !== null && input.labels.length > 0) return null;
  return input.id
    ? `no <label htmlFor="${input.id}"> is rendered`
    : 'no id, aria-label or aria-labelledby';
}
