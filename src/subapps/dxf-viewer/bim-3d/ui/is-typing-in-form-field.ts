/**
 * is-typing-in-form-field — SSoT guard για keyboard listeners του 3D viewport.
 *
 * Επιστρέφει `true` όταν ο χρήστης πληκτρολογεί σε form πεδίο (input / textarea /
 * contenteditable) ώστε οι window-level keydown handlers (shortcuts, polygon-mode
 * clipboard) να ΜΗΝ κλέβουν τα πλήκτρα. Ενιαία υλοποίηση — πριν ήταν inline
 * αντιγραμμένη στο `use3DShortcuts` (Boy-Scout dedupe, N.0.2).
 *
 * @see bim-3d/shortcuts/use3DShortcuts.ts
 * @see bim-3d/viewport/use-polygon-clipboard-shortcuts.ts
 */
export function isTypingInFormField(el: Element | null): boolean {
  if (!el) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.getAttribute('contenteditable') === 'true'
  );
}
