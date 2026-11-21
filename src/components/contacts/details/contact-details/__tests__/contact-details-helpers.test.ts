/**
 * ADR-121 Ε4 · ADR-323 — η ΜΙΑ εικόνα της φόρμας επαφής: σε επεξεργασία, η διαφορά πάνω στα αποθηκευμένα.
 * Από αυτή διαβάζουν ΚΑΙ τα πεδία ΚΑΙ η κεφαλίδα (διακόπτες ρόλων) — αλλιώς ο διακόπτης άλλαζε χωρίς να φαίνεται.
 */

import type { ContactFormData } from '@/types/ContactFormTypes';
import { resolveEditingFormData } from '../contact-details-helpers';

const saved = { firstName: 'Γιώργος', activePersonas: ['supplier'] } as unknown as ContactFormData;

describe('resolveEditingFormData', () => {
  it('in edit mode the unsaved persona toggle is what everyone sees', () => {
    const edited: Partial<ContactFormData> = { activePersonas: ['supplier', 'engineer'] } as Partial<ContactFormData>;
    const resolved = resolveEditingFormData(saved, edited, true);
    expect(resolved.activePersonas).toEqual(['supplier', 'engineer']);
    expect(resolved.firstName).toBe('Γιώργος');
  });

  it('outside edit mode the diff is ignored — the saved data is shown', () => {
    const edited = { activePersonas: [] } as Partial<ContactFormData>;
    expect(resolveEditingFormData(saved, edited, false)).toBe(saved);
  });

  it('an empty diff changes nothing', () => {
    expect(resolveEditingFormData(saved, {}, true)).toEqual(saved);
  });
});
