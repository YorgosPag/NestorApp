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
 * **Νέος κώδικας: εισάγετε κατευθείαν `isEditableTarget`.**
 *
 * @see src/lib/a11y/keyboard-scope.ts
 * @see src/subapps/dxf-viewer/keyboard/global-shortcut-listener.ts
 */
import { isEditableTarget } from '@/lib/a11y/keyboard-scope';

export function isTypingInFormField(el: Element | null): boolean {
  return isEditableTarget(el);
}
