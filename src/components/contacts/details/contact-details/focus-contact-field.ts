import { revealInScroll } from '@/lib/a11y/reveal-in-scroll';

const MAX_FRAMES = 20; // ~330ms στα 60fps — αρκετά για ένα tab switch

/**
 * Μεταφέρει τον χρήστη **στο** πρόβλημα: εστίαση + κύλιση στο πρώτο άκυρο πεδίο.
 *
 * Γιατί χρειάζεται αναμονή καρτέλας: το Radix κρατά **όλα** τα panels
 * προσαρτημένα και κρύβει τα ανενεργά με CSS. Άρα το `querySelector` βρίσκει το
 * πεδίο ακόμη κι όταν ανήκει σε άλλη καρτέλα — αλλά `focus()` και
 * `scrollIntoView()` σε κρυμμένο στοιχείο δεν κάνουν **τίποτα**. Πρέπει να
 * περιμένουμε να εφαρμοστεί η αλλαγή καρτέλας και το στοιχείο να γίνει ορατό
 * (`offsetParent !== null`), αλλιώς το μήνυμα λάθους μένει το μόνο σήμα.
 *
 * Εξήχθη από τον `useContactDetailsController` (όριο 500 γραμμών, N.7.1) — καμία κατάσταση, καθαρή πράξη DOM.
 */
export function focusContactField(fieldName?: string): void {
  if (!fieldName || typeof document === 'undefined') {
    return;
  }

  const selector = `[name="${fieldName}"], #${fieldName}`;

  const attempt = (framesLeft: number) => {
    const element = document.querySelector(selector);
    const isVisible = element instanceof HTMLElement && element.offsetParent !== null;

    if (!isVisible) {
      if (framesLeft > 0) window.requestAnimationFrame(() => attempt(framesLeft - 1));
      return;
    }

    element.focus();
    revealInScroll(element, { urgency: 'requested', block: 'center' });
  };

  window.requestAnimationFrame(() => attempt(MAX_FRAMES));
}
