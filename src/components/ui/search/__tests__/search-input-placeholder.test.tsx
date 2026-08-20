/**
 * =============================================================================
 * ADR-744 §16 — ΤΟ PLACEHOLDER ΕΙΝΑΙ ΚΕΙΜΕΝΟ, ΠΑΝΤΑ
 * =============================================================================
 *
 * Ο παλιός φρουρός ήταν `placeholder.includes('.') ? t(placeholder) : placeholder`
 * — διάκριση «κλειδί ή κείμενο;» με **ΣΤΙΞΗ**. Δούλευε **κατά τύχη**: το
 * μεταφρασμένο «Αναζήτηση**...**» περιέχει τελείες, άρα ξαναέμπαινε στο `t()`
 * και σωζόταν **μόνο** επειδή το i18next επιστρέφει το ίδιο string σε αστοχία.
 *
 * 🔑 **Το `Κ2` είναι η ουσία**: κείμενο που **τυχαίνει** να είναι υπαρκτό κλειδί
 * ΔΕΝ επιτρέπεται να ξαναμεταφραστεί. Με τον παλιό κώδικα αυτό το test είναι
 * **ΚΟΚΚΙΝΟ** — γι' αυτό είναι άγκυρα και όχι διακόσμηση.
 * =============================================================================
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { SearchInput } from '../SearchInput';
import { SEARCH_CONFIG } from '../constants';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  // Ένας μεταφραστής που ΑΛΛΑΖΕΙ την τιμή, ώστε μια διπλή μετάφραση να φαίνεται.
  useTranslation: () => ({ t: (key: string) => `«${key}»` }),
}));

describe('ADR-744 §16 — SearchInput placeholder', () => {
  it('Κ1: χωρίς prop, η προεπιλογή λύνεται ΑΠΟ ΚΛΕΙΔΙ — ποτέ ωμή στην οθόνη', () => {
    render(<SearchInput value="" onChange={() => {}} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', `«${SEARCH_CONFIG.placeholderDefaultKey}»`);
    // …και το ωμό κλειδί ΔΕΝ φτάνει στην οθόνη.
    expect(input.getAttribute('placeholder')).not.toBe(SEARCH_CONFIG.placeholderDefaultKey);
  });

  it('Κ2: κείμενο με ΤΕΛΕΙΕΣ περνά ΑΥΤΟΥΣΙΟ — καμία δεύτερη μετάφραση', () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="Αναζήτηση..." />);
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Αναζήτηση...');
  });

  it('Κ3: κείμενο που ΤΥΧΑΙΝΕΙ να μοιάζει με κλειδί περνά κι αυτό αυτούσιο', () => {
    // Ο παλιός κώδικας θα το έστελνε στο `t()` και θα έβαφε «placeholders.search».
    render(<SearchInput value="" onChange={() => {}} placeholder="placeholders.search" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'placeholders.search');
  });

  it('Κ4: η σταθερά ΛΕΕΙ ότι είναι κλειδί — το όνομα είναι μέρος του συμβολαίου', () => {
    expect(SEARCH_CONFIG).toHaveProperty('placeholderDefaultKey');
    expect(SEARCH_CONFIG).not.toHaveProperty('placeholderDefault');
  });
});
