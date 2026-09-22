/**
 * @fileoverview **SSoT: το Enter μέσα σε φόρμα, όπως το ορίζει η HTML — όχι όπως το μιμείται το user-event.**
 * @module test-utils/implicit-submission
 * @related ADR-598 §3 procurement · `components/ui/form/FormActions`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΟ ΟΡΓΑΝΟ ΔΕΝ ΒΛΕΠΕΙ ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΒΛΕΠΕΙ Ο ΦΥΛΛΟΜΕΤΡΗΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * HTML «implicit submission»: το Enter σε πεδίο κάνει κλικ στο **προεπιλεγμένο κουμπί** —
 * το πρώτο κουμπί υποβολής του οποίου **ιδιοκτήτρια φόρμα** είναι η φόρμα. Ένα κουμπί
 * με `form="<id>"` έξω από το `<form>` **είναι** τέτοιο (έτσι δουλεύει το `FormActions`).
 *
 * Το `@testing-library/user-event` 14 ψάχνει μόνο **απογόνους**
 * (`form.querySelector('button[type="submit"]')`) ⇒ ένα test με `keyboard('{Enter}')`
 * θα έλεγε «δεν υποβάλλει» για φόρμα που **στον φυλλομετρητή υποβάλλει**.
 * Μετρημένο 2026-09-21 σε Chromium (Playwright): κουμπί `form=` ⇒ Enter υποβάλλει (1)·
 * φόρμα χωρίς κουμπί υποβολής με δύο πεδία ⇒ δεν υποβάλλει (0).
 *
 * Εδώ ο προεπιλεγμένος εντοπίζεται μέσω `form.elements` (η λίστα **ιδιοκτησίας** της HTML,
 * που περιλαμβάνει τα `form=`) — άρα αν η σύνδεση σπάσει, το test **σκάει**, δεν «περνά».
 */

import { fireEvent } from '@testing-library/react';

/** Το προεπιλεγμένο κουμπί υποβολής της φόρμας, κατά την HTML (ή `null`). */
export function defaultSubmitButton(form: HTMLFormElement): HTMLButtonElement | HTMLInputElement | null {
  for (const element of Array.from(form.elements)) {
    if (
      (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) &&
      element.type === 'submit'
    ) {
      return element;
    }
  }
  return null;
}

/**
 * Enter σε πεδίο της `field.form`, όπως ο φυλλομετρητής: κλικ στο προεπιλεγμένο κουμπί.
 * Ένα απενεργοποιημένο κουμπί δεν έχει «activation behavior» ⇒ τίποτα (όπως στην HTML).
 */
export function pressEnterToSubmit(field: HTMLInputElement | HTMLTextAreaElement): void {
  const form = field.form;
  if (!form) throw new Error('pressEnterToSubmit: field is not owned by a form');
  const button = defaultSubmitButton(form);
  if (!button) throw new Error('pressEnterToSubmit: form has no submit button — Enter would do nothing');
  if (!button.disabled) fireEvent.click(button);
}
