/**
 * **ΠΟΙΕΣ ΓΡΑΜΜΑΤΟΣΕΙΡΕΣ ΥΠΑΡΧΟΥΝ** — μία απάντηση, καθαρή, χωρίς React.
 *
 * ## Γιατί βγήκε από το `useTextPanelFonts`
 * Ζούσε μέσα στο hook του πάνελ κειμένου (ADR-344 Φ6.D) όσο ο μόνος καταναλωτής ήταν εκείνο.
 * Το ADR-739 §55 έφερε **δεύτερον**: το combobox γραμματοσειράς του mini toolbar του πίνακα —
 * που όμως **δεν επιτρέπεται να είναι hook** εκεί όπου τον καλεί, γιατί τα μενού του πίνακα
 * ζουν μέσα στον `CanvasSection` και κάθε συνδρομή του γίνεται re-render του orchestrator
 * (ADR-040 κανόνας #1). Ο δεύτερος καταναλωτής θέλει **getter τη στιγμή του δεξιού κλικ**,
 * ο πρώτος θέλει συνδρομή — και η **γνώση** είναι η ίδια.
 *
 * Άρα: η γνώση εδώ (καθαρή), η συνδρομή στο hook, ο getter στα μενού. Μια δεύτερη λίστα θα
 * ήταν δεύτερη απάντηση στο «ποιες γραμματοσειρές υπάρχουν» — και η γραμμή του πίνακα θα
 * πρόσφερε άλλες από το πάνελ κειμένου, μέσα στο ίδιο σχέδιο.
 *
 * @module subapps/dxf-viewer/text-engine/fonts/available-font-names
 * @see ui/text-toolbar/hooks/useTextPanelFonts.ts — ο συνδρομητής
 * @see ui/table-cell-editor/use-toolbar-font-names.ts — ο getter των μενού πίνακα
 */

import { fontCache } from './font-cache';
import type { SceneModel } from '../../types/scene';

/**
 * Οι φορτωμένες γραμματοσειρές **ενωμένες** με όσες αναφέρει η σκηνή.
 *
 * Η ένωση δεν είναι φιλοδοξία: μια οικογένεια που το έγγραφο **ζητά** αλλά ο browser δεν
 * κατάφερε να φορτώσει πρέπει να φαίνεται στη λίστα, αλλιώς ο χρήστης δεν μπορεί καν να
 * ονομάσει αυτό που λείπει (UX ελλειπουσών γραμματοσειρών, ADR-344).
 *
 * Ταξινομημένες, ώστε η λίστα να μη χορεύει ανάμεσα σε δύο ανοίγματα.
 */
export function collectAvailableFontNames(scene: SceneModel | null): readonly string[] {
  const names = new Set<string>(fontCache.names());
  for (const entity of scene?.entities ?? []) {
    const family = fontFamilyOf(entity);
    if (family) names.add(family);
  }
  return [...names].sort();
}

/**
 * Το `fontFamily` μιας οντότητας, αν το έχει.
 *
 * Δομική στένωση (`in` + `typeof`) και **όχι** cast: το πεδίο ζει σε κάποιους μόνο τύπους της
 * ένωσης, και ένας νέος τύπος κειμένου αύριο μετράει από την πρώτη μέρα χωρίς να προστεθεί σε
 * χειρόγραφη λίστα. Το παλιό `as unknown as { fontFamily?: string }` έλεγε την ίδια δουλειά με
 * υπόσχεση αντί για έλεγχο.
 */
function fontFamilyOf(entity: unknown): string | undefined {
  if (typeof entity !== 'object' || entity === null || !('fontFamily' in entity)) return undefined;
  return typeof entity.fontFamily === 'string' ? entity.fontFamily : undefined;
}
