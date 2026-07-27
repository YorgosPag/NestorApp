/**
 * is-typing-in-form-field — ΔΕΝ είναι πια υλοποίηση· είναι **ονομασία** του SSoT.
 *
 * ADR-711: ο έλεγχος «γράφει ο χρήστης σε πεδίο;» υπήρχε σε δέκα και πλέον αντίγραφα
 * με τέσσερα ονόματα (`isTypingInFormField`, `isEditableFocus`, `isInputFocused`, και
 * inline παραλλαγές). Η μία υλοποίηση ζει τώρα στο `@/lib/a11y/keyboard-scope`, όπου
 * κάθεται δίπλα στη **δεύτερη** ερώτηση που έλειπε — «κατέχει modal το πληκτρολόγιο;»
 * — και η οποία ήταν η ρίζα των ελαττωμάτων Ε1/Ε4 (ADR-364 §10.15).
 *
 * Το αρχείο μένει ως λεπτό re-export ώστε οι υπάρχοντες καταναλωτές να μη σπάσουν.
 * **Νέος κώδικας: εισάγετε κατευθείαν `isTextEntryTarget`.**
 *
 * ⚠️ ADR-711 §5.6 — το όνομα εδώ («typing in form field») είναι ακριβώς η **ερώτηση 1**:
 * γράφει ο χρήστης **κείμενο**; Οι δύο καταναλωτές του (`use-bim3d-entity-clipboard`,
 * `use-polygon-clipboard-shortcuts`) ρωτούν για Ctrl+C/Ctrl+V, δηλαδή **δεν** κλέβουν
 * εκτυπώσιμο χαρακτήρα — άρα η ερώτηση 1 είναι η σωστή και μένουν αμετάβλητοι. Αν κάποτε
 * κάποιος εδώ αρχίσει να κλέβει σκέτο χαρακτήρα, θέλει `consumesTypedCharacters`.
 *
 * @see src/lib/a11y/keyboard-scope.ts — οι δύο ερωτήσεις
 * @see src/subapps/dxf-viewer/keyboard/global-shortcut-listener.ts
 */
import { isTextEntryTarget } from '@/lib/a11y/keyboard-scope';

export function isTypingInFormField(el: Element | null): boolean {
  return isTextEntryTarget(el);
}
