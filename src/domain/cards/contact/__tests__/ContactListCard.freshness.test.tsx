/**
 * Άγκυρα του **ΚΑΛΟΥΝΤΑ** — ADR-332 D27 **Ζ8**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΟ ΚΕΝΟ ΠΟΥ ΒΡΗΚΕ Η ΜΕΤΑΛΛΑΞΗ Μ6 (μετρημένο 2026-09-14)
 * ────────────────────────────────────────────────────────────────────────────
 * Το `address-mirror-identity-parity.test.ts` καλεί **το ίδιο** τον προσαρμογέα
 * (`addressInfoPositionView`), άρα φυλάει τον **προσαρμογέα** — όχι το ότι η **κάρτα** τον
 * χρησιμοποιεί. Η μετάλλαξη «η κάρτα ξαναρωτά με ωμό `AddressInfo`» **ΕΠΕΖΗΣΕ** εκείνη τη
 * σουίτα ολόκληρη. Ένα anchor χωρίς κάλυψη του σημείου κλήσης είναι **σχόλιο** (ADR-587 §6.1).
 *
 * ⚠️ **ΟΧΙ mock στο `computeFreshness` και στον δείκτη** — το ίδιο λάθος μετρήθηκε ήδη στο
 * `AddressesSectionWithFullscreen.placement.test.tsx:39-52`: ένα `() => null` εκεί άφησε την
 * αντίστοιχη μετάλλαξη να επιζήσει. Εδώ τρέχουν οι **πραγματικοί**, μέσω `jest.requireActual`.
 *
 * 🔑 **Το δείγμα είναι επιλεγμένο ώστε να ΞΕΧΩΡΙΖΕΙ**: η διεύθυνση έχει `neighborhood`
 * («Κέντρο», ταχυδρομική συνοικία) **διαφορετικό** από το `communityName` («Δημοτική Κοινότητα
 * Τριανδρίας», ΕΛΣΤΑΤ L7). Η απόδειξη (`resolvedFor`) γεννιέται στη γλώσσα του γραφέα, όπου
 * `neighborhood` σημαίνει **την Κοινότητα**. Χωρίς τον προσαρμογέα η κάρτα συγκρίνει «Κέντρο»
 * με «Δημοτική Κοινότητα Τριανδρίας» και καταγγέλλει **ψευδώς** τη θέση ως μπαγιάτικη.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import type { Contact } from '@/types/contacts';

// --- Άκρα: μόνο ό,τι ΔΕΝ αφορά τη φρεσκάδα ---------------------------------
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'el' }),
}));
jest.mock('../useContactCardModel', () => ({
  useContactCardModel: () => ({ id: 'c1', title: 'ALFA', subtitle: '', badges: [], fields: [] }),
}));
jest.mock('../../shared/DomainCard', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    DomainCard: (p: { children?: React.ReactNode }) => R.createElement('article', null, p.children),
  };
});
jest.mock('@/components/shared/addresses/editor', () => {
  const actualIndicator = jest.requireActual<
    typeof import('@/components/shared/addresses/editor/components/AddressFreshnessIndicator')
  >('@/components/shared/addresses/editor/components/AddressFreshnessIndicator');
  const actualFreshness = jest.requireActual<
    typeof import('@/components/shared/addresses/editor/helpers/computeFreshness')
  >('@/components/shared/addresses/editor/helpers/computeFreshness');
  return {
    AddressSourceLabel: () => null,
    // ⚠️ ΟΙ ΠΡΑΓΜΑΤΙΚΟΙ — βλ. κεφαλίδα. Ένα `() => null` εδώ ακυρώνει ολόκληρη την άγκυρα.
    AddressFreshnessIndicator: actualIndicator.AddressFreshnessIndicator,
    computeFreshness: actualFreshness.computeFreshness,
  };
});

import { buildAddressInfoListFromCompanyAddresses } from '@/utils/contacts/address-info-builder';
import { ContactListCard } from '../ContactListCard';

/** Δύο ώρες πριν ⇒ `fresh` από την ηλικία. **Σχετικό** ρολόι: η άγκυρα δεν παλιώνει μόνη της. */
const VERIFIED_AT = Date.now() - 2 * 60 * 60 * 1000;

const BRANCH_STORED: CompanyAddress & { readonly id: string } = {
  id: 'addr_0598edf6-6613-4caf-ac8e-efa0bcf36c3d',
  type: 'branch',
  street: 'Ονειροπόλων',
  number: '42',
  city: 'Τριανδρία',
  postalCode: '54624',
  neighborhood: 'Κέντρο',
  communityName: 'Δημοτική Κοινότητα Τριανδρίας',
  municipalityName: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ',
  regionalUnitName: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ',
  regionName: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
  coordinates: { lat: 40.6229682, lng: 22.9703544 },
  source: 'geocoded',
  verifiedAt: VERIFIED_AT,
  geocodingMetadata: {
    confidence: 0.66,
    accuracy: 'center',
    variantUsed: 8,
    // Η απόδειξη στη γλώσσα του γραφέα: `neighborhood` = η **Κοινότητα**, όχι η συνοικία.
    resolvedFor: {
      street: 'Ονειροπόλων',
      number: '42',
      city: 'Τριανδρία',
      postalCode: '54624',
      neighborhood: 'Δημοτική Κοινότητα Τριανδρίας',
      municipality: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ',
      regionalUnit: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ',
      region: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
    },
  },
};

function contactWith(stored: CompanyAddress & { readonly id: string }): Contact {
  return {
    id: 'cont_test',
    type: 'company',
    companyName: 'ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.',
    addresses: buildAddressInfoListFromCompanyAddresses([stored]),
  } as unknown as Contact;
}

describe('Ζ8 — η ΚΑΡΤΑ ΛΙΣΤΑΣ ρωτά τον κριτή στη γλώσσα του γραφέα', () => {
  it('Ζ8-Λ1 — 🔴 θέση 2 ωρών με συνοικία ≠ Κοινότητα ΔΕΝ καταγγέλλεται ως μπαγιάτικη', () => {
    render(<ContactListCard contact={contactWith(BRANCH_STORED)} />);

    // Ο θετικός ισχυρισμός: λέει «φρέσκια», όχι απλώς «όχι παλιά».
    expect(screen.getByText('editor.freshness.fresh')).toBeInTheDocument();
    expect(screen.queryByText('editor.freshness.stale')).not.toBeInTheDocument();
  });

  it('Ζ8-Λ2 — αρνητικός έλεγχος: ΠΡΑΓΜΑΤΙΚΗ αλλαγή οδού ΚΑΤΑΓΓΕΛΛΕΤΑΙ', () => {
    // Χωρίς αυτό, ένα `computeFreshness` που δεν κοιτά ποτέ την ταυτότητα θα περνούσε το Λ1.
    const moved = { ...BRANCH_STORED, street: 'Τσιμισκή' };
    render(<ContactListCard contact={contactWith(moved)} />);

    expect(screen.getByText('editor.freshness.stale')).toBeInTheDocument();
  });
});
