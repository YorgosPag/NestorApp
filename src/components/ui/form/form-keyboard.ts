/**
 * @fileoverview **SSoT: τα δύο πλήκτρα που μια φόρμα κειμένου χρειάζεται πέρα από την HTML.**
 * @module components/ui/form/form-keyboard
 * @related ADR-598 «(θ)» · `hooks/useFormSubmission` · `ui/form/FormActions`
 *
 * 1. **Ctrl/⌘+Enter σε `<textarea>` = υποβολή** (Gmail, Slack, GitHub). Η HTML δεν κάνει
 *    implicit submission από textarea (εκεί το Enter είναι νέα γραμμή). Το `requestSubmit()`
 *    περνά από το `onSubmit` της φόρμας — τον ΕΝΑ δρόμο, με τον φύλακα του SSoT — και όχι
 *    από απευθείας κλήση του handler, που θα παρέκαμπτε τη φόρμα.
 * 2. **Enter σε πεδίο «Θέμα» = επόμενο πεδίο, ΟΧΙ αποστολή** (Gmail/Outlook composer). Ένα
 *    email δεν στέλνεται επειδή πατήθηκε Enter στο θέμα.
 *
 * Και τα δύο αγνοούν σύνθεση IME (`isComposing`): εκεί το Enter επιβεβαιώνει χαρακτήρα.
 */

import type { KeyboardEvent, RefObject } from 'react';

type TextControl = HTMLInputElement | HTMLTextAreaElement;

function isComposing(event: KeyboardEvent<TextControl>): boolean {
  return event.nativeEvent.isComposing;
}

/** `onKeyDown` για `<textarea>`: Ctrl/⌘+Enter υποβάλλει τη φόρμα του πεδίου. */
export function submitOnModEnter(event: KeyboardEvent<TextControl>): void {
  if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || isComposing(event)) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

/** `onKeyDown` για μονογραμμικό πεδίο: το Enter μεταφέρει την εστίαση στο `next`, δεν υποβάλλει. */
export function focusNextOnEnter(next: RefObject<HTMLElement | null>) {
  return (event: KeyboardEvent<TextControl>): void => {
    if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || isComposing(event)) return;
    event.preventDefault();
    next.current?.focus();
  };
}
