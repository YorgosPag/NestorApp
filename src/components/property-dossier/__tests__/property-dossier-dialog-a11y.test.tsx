/**
 * Α38.4 — ADR-866 §2.10 Π1: το λάθος του ονόματος ζει **στο πεδίο** και η απόρριψη **εστιάζει** εκεί.
 *
 * 🔴 Ζωντανή επαλήθευση 2026-09-19: το μήνυμα ήταν λίστα **κάτω από το «Είδος»**· το πεδίο χωρίς `aria-invalid` /
 * `aria-describedby`· η εστίαση έμενε στο κουμπί· και «γράφω-σβήνω-φεύγω» **έκρυβε** το λάθος (το «αγγίχτηκε»
 * κρινόταν από την τιμή).
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/property-dossier/property-dossier.service', () => ({
  newPropertyDossierId: () => 'pdos_test',
  createPropertyDossierRequest: jest.fn(),
  updatePropertyDossierDetails: jest.fn(),
}));

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createPropertyDossierRequest } from '@/services/property-dossier/property-dossier.service';
import { PropertyDossierDialog } from '../PropertyDossierDialog';

const REQUIRED = 'property-market:dossier.invariant.label-required';

function renderCreate() {
  render(<PropertyDossierDialog mode={{ kind: 'create' }} onClose={jest.fn()} />);
  return screen.getByRole('textbox', { name: 'property-market:dossier.dialog.labelLabel' });
}

describe('Α38.4 — λάθος πεδίου, προσβάσιμο', () => {
  it('υποβολή κενού ⇒ λάθος ΣΤΟ πεδίο (aria-invalid + aria-describedby) · εστίαση στο πεδίο · καμία κλήση', async () => {
    const input = renderCreate();
    // ⚠️ Ο Radix Dialog εστιάζει ΜΟΝΟΣ του στο πρώτο πεδίο όταν ανοίγει — η εστίαση πάει πρώτα στο κουμπί (όπως με
    // Tab/κλικ στην πράξη), αλλιώς η άγκυρα θα περνούσε και χωρίς `setFocus` (μετρημένο: μετάλλαξη Μ13 🟢).
    const submitButton = screen.getByRole('button', { name: 'property-market:dossier.dialog.create' });
    act(() => { submitButton.focus(); });
    await act(async () => { fireEvent.click(submitButton); });

    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(REQUIRED);
    expect(document.activeElement).toBe(input);
    expect(createPropertyDossierRequest).not.toHaveBeenCalled();
  });

  it('άδεια φόρμα που μόλις άνοιξε ⇒ ΚΑΝΕΝΑ λάθος (δεν επιπλήττουμε πριν πληκτρολογήσει)', () => {
    const input = renderCreate();
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText(REQUIRED)).toBeNull();
  });

  it('γράφω → σβήνω → φεύγω ⇒ το λάθος ΦΑΙΝΕΤΑΙ (το «αγγίχτηκε» το λέει η φόρμα, όχι η τιμή)', async () => {
    const input = renderCreate();
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Α' } });
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
    });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(REQUIRED)).toBeTruthy();
  });
});
