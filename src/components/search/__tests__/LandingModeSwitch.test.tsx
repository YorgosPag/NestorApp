/**
 * @jest-environment jsdom
 *
 * @fileoverview **Ο ΔΙΑΚΟΠΤΗΣ ΤΗΣ ΡΙΖΑΣ** — το ορατό μισό της Α4.
 * @related ADR-841 §7 Α4 · Α5 · components/search/LandingModeSwitch
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { LandingModeSwitch } from '../LandingModeSwitch';
import { LANDING_MODES } from '@/lib/landing/landing-modes';

import el from '@/i18n/locales/el/search-results.json';
import en from '@/i18n/locales/en/search-results.json';
import elMarket from '@/i18n/locales/el/property-market.json';
import enMarket from '@/i18n/locales/en/property-market.json';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('Δ1 — ΤΙ ΑΠΟΔΙΔΕΤΑΙ', () => {
  it('🔴 αποδίδει ΜΟΝΟ τις λειτουργίες που του δόθηκαν', () => {
    render(<LandingModeSwitch modes={['buy', 'rent', 'pros']} value="buy" onChange={jest.fn()} />);

    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.queryByText('search-results:landing.modes.stay')).not.toBeInTheDocument();
  });

  it('🔴 ΣΙΩΠΑ με μία μόνο λειτουργία — διακόπτης χωρίς επιλογή είναι ψέμα', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `modes.length < 2` ⇒ κοκκινίζει.
    //    Ένα μοναδικό «κουμπί» καλεί τον επισκέπτη να το πατήσει και δεν κάνει τίποτα.
    const { container } = render(
      <LandingModeSwitch modes={['buy']} value="buy" onChange={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('🔴 η ενεργή λειτουργία δηλώνεται στην ΥΠΟΒΟΗΘΟΥΜΕΝΗ τεχνολογία', () => {
    render(<LandingModeSwitch modes={['buy', 'rent']} value="rent" onChange={jest.fn()} />);
    expect(screen.getByText('search-results:landing.modes.rent').closest('[role="tab"]'))
      .toHaveAttribute('aria-selected', 'true');
  });
});

describe('Δ2 — ΚΑΘΕ ΛΕΙΤΟΥΡΓΙΑ ΕΧΕΙ ΟΝΟΜΑ, ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ', () => {
  it.each(LANDING_MODES)('🔴 «%s» — κλειδί σε el ΚΑΙ en, χωρίς κενό', (mode) => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε ένα κλειδί από το `en` ⇒ κοκκινίζει.
    //    Χωρίς αυτό, η αγγλική οθόνη θα έδειχνε **ωμό κλειδί** (CHECK 3.51) — και το
    //    `t()` δεν πετά, άρα καμία άλλη δοκιμή δεν θα το έβλεπε.
    for (const bundle of [el, en]) {
      const label = (bundle.landing.modes as Record<string, string>)[mode];
      expect(typeof label).toBe('string');
      expect(label.trim()).not.toBe('');
    }
  });
});

describe('Δ3 — 🔑 ΤΟ ΚΟΥΜΠΙ ΚΑΙ Ο ΠΡΟΟΡΙΣΜΟΣ ΤΟΥ ΛΕΝΕ ΤΟ ΙΔΙΟ', () => {
  it.each([
    ['el', el, elMarket],
    ['en', en, enMarket],
  ])('🔴 [%s] «Επαγγελματίες» = ο τίτλος της σελίδας /pro', (_lang, bundle, market) => {
    // 🔴 **Η ΑΓΚΥΡΑ ΤΗΣ ΑΠΟΦΑΣΗΣ ΤΟΥ GIORGIO (2026-09-04).** Η Α4 έγραφε «Μαστόροι»·
    //    απορρίφθηκε. Η αντικατάσταση **δεν επιλέχθηκε με γούστο**: είναι ο τίτλος της
    //    ίδιας της σελίδας στην οποία οδηγεί το κουμπί.
    //
    //    ⚠️ **Δεν είναι δοκιμή ορθογραφίας — είναι δοκιμή ΤΑΥΤΟΤΗΤΑΣ.** Αν κάποιος
    //    μετονομάσει τον κατάλογο και ξεχάσει το κουμπί (ή το αντίστροφο), ο
    //    επισκέπτης πατά «Χ» και προσγειώνεται σε σελίδα με τίτλο «Ψ» — δύο ονόματα
    //    για ένα πράγμα, που κανένα `grep` δεν θα έβρισκε.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το κλειδί σε «Μαστόροι» ⇒ κοκκινίζει.
    const button = (bundle.landing.modes as Record<string, string>).pros;
    const destination = (market as { mandate: { directory: { title: string } } }).mandate
      .directory.title;

    expect(button).toBe(destination);
  });
});
