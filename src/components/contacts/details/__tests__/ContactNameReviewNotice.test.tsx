/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 §9.1 Α1 — η καρτέλα **προτείνει**, ο άνθρωπος **αποφασίζει**· καμία εγγραφή χωρίς πάτημα.
 *
 * Μεταλλάξεις (2026-09-26): (α) «Κράτα ως έχει» γράφει και ονόματα ⇒ κοκκινίζει το Ε3·
 * (β) το σήμα δεν σβήνει στην εφαρμογή ⇒ κοκκινίζει το Ε2.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => (params ? `${key}|${Object.values(params).join('|')}` : key),
  }),
}));

const updateContact = jest.fn(async () => undefined);
jest.mock('@/services/contacts.service', () => ({
  ContactsService: { updateContact: (...args: unknown[]) => updateContact(...(args as [])) },
}));

import { ContactNameReviewNotice } from '../ContactNameReviewNotice';
import type { Contact } from '@/types/contacts';

const contact = (nameReview: unknown) => ({
  id: 'cont_1', type: 'individual', firstName: 'Παπαδοπούλου Μαρία', lastName: '', nameReview,
}) as unknown as Contact;
const review = { source: 'account-display-name', raw: 'Παπαδοπούλου Μαρία' };

describe('ContactNameReviewNotice', () => {
  beforeEach(() => updateContact.mockClear());

  it('Ε1 — χωρίς σήμα ⇒ τίποτα', () => {
    const { container } = render(<ContactNameReviewNotice contact={contact(undefined)} />);
    expect(container.textContent).toBe('');
  });

  it('Ε2 — αντιστροφή + εφαρμογή ⇒ όνομα/επώνυμο γράφονται ΚΑΙ το σήμα σβήνει', async () => {
    const onConfirmed = jest.fn();
    render(<ContactNameReviewNotice contact={contact(review)} onConfirmed={onConfirmed} />);
    expect(screen.getByText('contacts:nameReview.proposal|Παπαδοπούλου|Μαρία')).toBeTruthy();
    fireEvent.click(screen.getByText('contacts:nameReview.swap'));
    expect(screen.getByText('contacts:nameReview.proposal|Μαρία|Παπαδοπούλου')).toBeTruthy();
    fireEvent.click(screen.getByText('contacts:nameReview.apply'));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    expect(updateContact).toHaveBeenCalledWith('cont_1', {
      firstName: 'Μαρία', lastName: 'Παπαδοπούλου', displayName: 'Μαρία Παπαδοπούλου', nameReview: null,
    });
  });

  it('Ε3 — «Κράτα ως έχει» ⇒ σβήνει ΜΟΝΟ το σήμα, τα ονόματα δεν αγγίζονται', async () => {
    render(<ContactNameReviewNotice contact={contact(review)} />);
    fireEvent.click(screen.getByText('contacts:nameReview.keep'));
    await waitFor(() => expect(updateContact).toHaveBeenCalledWith('cont_1', { nameReview: null }));
  });
});
