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
import { Tabs } from '@/components/ui/tabs';
import { LANDING_MODES, type LandingMode } from '@/lib/landing/landing-modes';

import el from '@/i18n/locales/el/search-results.json';
import en from '@/i18n/locales/en/search-results.json';
import elMarket from '@/i18n/locales/el/property-market.json';
import enMarket from '@/i18n/locales/en/property-market.json';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * ⚠️ **Ο ΔΙΑΚΟΠΤΗΣ ΔΕΝ ΚΑΤΕΧΕΙ ΠΙΑ ΤΗ ΡΙΖΑ ΤΩΝ `Tabs`** *(Α4.3.12)* — ανέβηκε στο `main`
 * της σελίδας, ώστε το πάνελ να είναι **άμεσο τέκνο** του μέτρου *(Α4.3.6)*. Άρα εδώ η
 * ρίζα δίνεται από τη δοκιμή: είναι το **περιβάλλον** του component, όχι μέρος του.
 *
 * 🔑 Και γι' αυτό το *«σιωπά με ένα κουμπί»* **δεν** ελέγχεται πια με «κενό `container`»:
 * ο `container` κρατά τη ρίζα. Η ερώτηση είναι *«υπάρχει `tablist`;»*, που είναι και η
 * σωστή ερώτηση — το ελάττωμα θα ήταν **ορατό χειριστήριο**, όχι «κάποιο DOM».
 */
function renderSwitch(modes: readonly LandingMode[], value: LandingMode) {
  return render(
    <Tabs value={value}>
      <LandingModeSwitch modes={modes} value={value} />
    </Tabs>,
  );
}

describe('Δ1 — ΤΙ ΑΠΟΔΙΔΕΤΑΙ', () => {
  it('🔴 αποδίδει ΜΟΝΟ τις λειτουργίες που του δόθηκαν', () => {
    renderSwitch(['buy', 'rent', 'pros'], 'buy');

    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.queryByText('search-results:landing.modes.stay')).not.toBeInTheDocument();
  });

  it('🔴 ΣΙΩΠΑ με μία μόνο λειτουργία — διακόπτης χωρίς επιλογή είναι ψέμα', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `landingSwitchIsVisible` ⇒ κοκκινίζει.
    //    Ένα μοναδικό «κουμπί» καλεί τον επισκέπτη να το πατήσει και δεν κάνει τίποτα.
    const { container } = renderSwitch(['buy'], 'buy');

    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('🔴 η ενεργή λειτουργία δηλώνεται στην ΥΠΟΒΟΗΘΟΥΜΕΝΗ τεχνολογία', () => {
    renderSwitch(['buy', 'rent'], 'rent');
    expect(screen.getByText('search-results:landing.modes.rent').closest('[role="tab"]'))
      .toHaveAttribute('aria-selected', 'true');
  });

  it('🔴 ΜΟΝΟ το ενεργό κουμπί δηλώνει `aria-controls` — τα άλλα δεν έχουν πού να δείξουν', () => {
    // 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΤΗΣ Α4.3.10 ΣΤΗ ΡΙΖΑ ΤΟΥ** *(Α4.3.12)*: το Radix γράφει
    //    `aria-controls` σε **κάθε** trigger, ενώ αποδίδει **μόνο** το πάνελ του
    //    επιλεγμένου. Ο κανόνας του έργου είναι ήδη γραμμένος αλλού — δείκτης σε
    //    ανύπαρκτο στοιχείο είναι σφάλμα ARIA, **χειρότερο από την απουσία του**
    //    *(`searchable-combobox.tsx:364` · `TableFormatCellsTabs.tsx:98`)*, και είναι
    //    ακριβώς η γραφή του React Aria *(`useTab`)*.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `SUPPRESS_ARIA_CONTROLS` ⇒ κοκκινίζει με 3 στα 3.
    //    *(Ότι ο δείκτης ΛΥΝΕΤΑΙ το ρωτά το `landing-tabpanel.test.tsx` — εδώ δεν
    //    υπάρχει πάνελ, και μια δοκιμή που το προσποιούνταν θα φύλαγε το ψεύτικο.)*
    renderSwitch(['buy', 'rent', 'pros'], 'rent');

    const declared = screen.getAllByRole('tab').filter((tab) => tab.hasAttribute('aria-controls'));

    expect(declared).toHaveLength(1);
    expect(declared[0]).toHaveAttribute('aria-selected', 'true');
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
