/**
 * =============================================================================
 * Ο ΤΙΤΛΟΣ ενός ανεβάσματος από entry point — «πώς θα λέγεται το αρχείο;»
 * =============================================================================
 *
 * Ένα entry point **ξέρει** τι ανεβαίνει («Σχέδιο συμβολαίου»), άρα δίνει τον τίτλο στο `customTitle` του
 * `uploadEntityFile`. Εξαίρεση: όσα ζητούν τίτλο από τον άνθρωπο (`requiresCustomTitle`).
 *
 * 🔴 **Γιατί υπάρχει** (ADR-901 Φ4.5 · ζωντανή δοκιμή 2026-10-04): ο κανόνας ζούσε inline μόνο στο `useFileUpload`.
 *    Η ροή προχείρων της υπόθεσης (`useCaseDrafts`) τον παρέλειψε, και το όνομα έπεσε στο `getPurposeLabel` →
 *    ωμό κλειδί σκοπού στην οθόνη: «Συμβόλαια contract_draft». Ένας κανόνας, ένα σημείο.
 *
 * ⚠️ Καθαρό φύλλο, χωρίς το μητρώο entry points — το εισάγουν και ροές που δεν το φορτώνουν.
 *
 * @module config/upload-entry-points/entry-point-title
 */

import type { UploadEntryPoint } from './types';

/** Ο τίτλος του αρχείου: ό,τι έγραψε ο άνθρωπος όπου ζητείται, αλλιώς η ετικέτα του entry point. */
export function entryPointUploadTitle(
  entryPoint: Pick<UploadEntryPoint, 'label' | 'requiresCustomTitle'> | null | undefined,
  customTitle?: string,
): string | undefined {
  if (!entryPoint) return undefined;
  return entryPoint.requiresCustomTitle ? customTitle : entryPoint.label.el;
}
