/**
 * @jest-environment jsdom
 *
 * @fileoverview **Η ΟΘΟΝΗ ΤΗΣ ΚΑΤΟΨΗΣ** — τι λέει σε όποιον δεν τη βλέπει (ADR-841 §7 Α17).
 * @related ADR-841 §7 Α17 · §9 Ο-20 · components/listing-detail/ListingFloorplans
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΟΡΑΤΟ ΜΙΣΟ ΤΟΥ Ο-20
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η άγκυρα `lib/listings/__tests__/listing-floorplan-separation` ρωτά *πού κάθεται* η
 * κάτοψη μέσα στο έγγραφο. Αυτή ρωτά **τι ακούει ο άνθρωπος** — και η **Α15** μέτρησε
 * ότι το πιο σοβαρό μισό ήταν πάντα το **ορατό**, όχι το αποθηκευμένο.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ListingFloorplans } from '../ListingFloorplans';
import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import { LISTING_FLOORPLAN_PROVENANCE_KEYS } from '@/lib/listings/listing-material';
import type { ListingAuthorship, ListingFloorplan, PublicListing } from '@/types/public-listing';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

const AT = '2026-08-20T10:00:00.000Z';

function declaredPlan(url = 'https://shelf/plan.webp', authorship: ListingAuthorship = 'owner-declared'): ListingFloorplan {
  return {
    provenance: 'declared',
    at: AT,
    value: {
      url,
      width: 1280,
      height: 960,
      altKey: LISTING_MATERIAL_KEYS[authorship].floorplanAlt,
      sources: [],
    },
  };
}

function listing(floorplans: readonly ListingFloorplan[], authorship: ListingAuthorship = 'owner-declared'): PublicListing {
  return { authorship, coverImage: null, gallery: [], floorplans } as unknown as PublicListing;
}

describe('Φ1 — Η ΚΑΤΟΨΗ ΑΝΑΚΟΙΝΩΝΕΤΑΙ ΩΣ ΚΑΤΟΨΗ', () => {
  it('🔴 το `alt` ζητά το κλειδί ΤΗΣ ΚΑΤΟΨΗΣ, ΧΩΡΙΣ αρίθμηση', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: πέρασε `{ index, total }` στο `t(image.altKey, …)` ⇒ κοκκινίζει.
    //    Το «3 από 8» δεν έχει νόημα για σχέδιο — είναι η θέση σε **σειρά φωτογραφιών**.
    render(<ListingFloorplans listing={listing([declaredPlan()])} />);

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('alt', LISTING_MATERIAL_KEYS['owner-declared'].floorplanAlt);
  });

  it('🔴 η σημείωση λέει «Η ΚΑΤΟΨΗ», ΠΟΤΕ «οι φωτογραφίες» — και το βρήκε ΠΕΡΠΑΤΗΜΑ', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `floorplanNote` σε `sourceNote` ⇒ κοκκινίζει.
    //    Η πρώτη υλοποίηση **έκανε ακριβώς αυτό**, και η οθόνη τύπωσε *«Οι ΦΩΤΟΓΡΑΦΙΕΣ
    //    είναι υλικό του κατόχου»* **κάτω από μια κάτοψη**, δύο φορές. Καμία άγκυρα δεν
    //    το έπιασε — το είδε **άνθρωπος** στη σελίδα (ADR-841 §7 Α17).
    render(<ListingFloorplans listing={listing([declaredPlan()])} />);

    expect(
      screen.getByText(LISTING_MATERIAL_KEYS['owner-declared'].floorplanNote),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(LISTING_MATERIAL_KEYS['owner-declared'].sourceNote),
    ).not.toBeInTheDocument();
  });

  it('🔴 αγγελία ΓΡΑΦΕΙΟΥ ⇒ η σημείωση ζητά το κλειδί ΓΡΑΦΕΙΟΥ', () => {
    render(<ListingFloorplans listing={listing([declaredPlan('https://shelf/a.webp', 'agency')], 'agency')} />);
    expect(screen.getByText(LISTING_MATERIAL_KEYS.agency.floorplanNote)).toBeInTheDocument();
  });

  it('🏆 λέει ΑΝ ΤΗ ΣΧΕΔΙΑΣΕ ΑΝΘΡΩΠΟΣ — η γραμμή που η Zillow δεν έχει', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάρφωσε το κλειδί σε κυριολεκτικό ⇒ πράσινο σήμερα, **ψέμα**
    //    την ημέρα της Φ4. Γι' αυτό η άγκυρα ρωτά τον **χάρτη**, όχι τη σταθερά.
    render(<ListingFloorplans listing={listing([declaredPlan()])} />);
    expect(screen.getByText(LISTING_FLOORPLAN_PROVENANCE_KEYS.declared)).toBeInTheDocument();
  });
});

describe('Φ2 — Η ΑΠΟΥΣΙΑ ΣΙΩΠΑ, ΚΑΙ ΤΟ ΜΑΝΤΕΜΑ ΔΕΝ ΦΤΑΝΕΙ ΣΤΟΝ ΑΓΟΡΑΣΤΗ', () => {
  it('⛔ καμία κάτοψη ⇒ ΤΙΠΟΤΑ — ποτέ «δεν υπάρχει κάτοψη»', () => {
    // ⚠️ Αντίθετα από τη συλλογή, που **οφείλει** να υπάρχει: η κάτοψη είναι
    //    προαιρετική, και μια πρόταση «δεν υπάρχει» θα κατηγορούσε τον κάτοχο για πεδίο
    //    που κανείς δεν του ζήτησε.
    const { container } = render(<ListingFloorplans listing={listing([])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('🔴 κάτοψη που ΜΑΝΤΕΨΕ μοντέλο και ΔΕΝ ενέκρινε άνθρωπος ΔΕΝ εμφανίζεται (ADR-842 Α7)', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε το `.filter(isPubliclyPresentable)` ⇒ κοκκινίζει. Ο
    //    κριτής **υπάρχει ήδη** και δεν ξαναγράφτηκε — αυτό είναι το νόημα του να
    //    χρησιμοποιείται το `SourcedAttribute` αντί για νέο δοχείο.
    const guessed = {
      provenance: 'inferred',
      at: AT,
      confidence: 0.9,
      confirmedAt: null,
      value: declaredPlan().value,
    } as unknown as ListingFloorplan;

    const { container } = render(<ListingFloorplans listing={listing([guessed])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('🔑 η ίδια κάτοψη ΜΕ ανθρώπινη έγκριση εμφανίζεται — ο κριτής δεν είναι «κρύψε τα πάντα»', () => {
    const confirmed = {
      provenance: 'inferred',
      at: AT,
      confidence: 0.9,
      confirmedAt: '2026-08-21T09:00:00.000Z',
      value: declaredPlan().value,
    } as unknown as ListingFloorplan;

    render(<ListingFloorplans listing={listing([confirmed])} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText(LISTING_FLOORPLAN_PROVENANCE_KEYS.inferred)).toBeInTheDocument();
  });
});
