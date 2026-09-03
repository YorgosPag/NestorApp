/**
 * @jest-environment jsdom
 *
 * @fileoverview **ΤΟ ΟΡΑΤΟ ΜΙΣΟ ΤΗΣ ΑΠΟΔΕΙΞΗΣ** (ADR-777 §8.49).
 * @related ADR-777 §8.49 · ADR-841 §7 Α2.4 (LCP) · components/search/LandingShowcase
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΟ `landing-showcase.test.ts`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Εκείνο ρωτά *«ποιες αγγελίες;»* — καθαρή συνάρτηση. Αυτό ρωτά *«τι φτάνει στην
 * οθόνη;»*, και **τρεις φορές σε τρεις συνεδρίες** (ADR-841 Α17.6) το ελάττωμα ήταν
 * στο **ορατό** μισό, με το λογικό μισό πράσινο.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { LandingShowcase } from '../LandingShowcase';
import { LANDING_SHOWCASE_LIMIT } from '@/lib/listings/listing-coverage';
import type { PublicListing } from '@/types/public-listing';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function listing(id: string, title: string): PublicListing {
  return {
    id,
    title,
    gallery: [
      {
        url: `https://shelf/${id}.webp`,
        width: 1200,
        height: 900,
        altKey: 'search-results:detail.media.galleryAlt',
        sources: [],
      },
    ],
    floorplans: [],
    coverImage: null,
    authorship: 'owner-declared',
    commercial: { askingPrice: 100000, finalPrice: null, rentPrice: null, nightlyRate: null },
    commercialStatus: 'for-sale',
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'owner-declined' },
    areaSqm: 90,
    floor: null,
    bedrooms: null,
    legality: [],
    agencyName: null,
    agencyId: null,
  } as unknown as PublicListing;
}

function many(count: number): readonly PublicListing[] {
  return Array.from({ length: count }, (_, i) =>
    listing(`id-${String(i + 1).padStart(2, '0')}`, `Τ${String(i + 1).padStart(2, '0')}`),
  );
}

const READY = { loading: false, error: null } as const;

describe('Β3 — ΣΙΩΠΑ ΟΤΑΝ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΑΠΟΔΕΙΞΕΙ', () => {
  it('🔴 σε ΦΟΡΤΩΣΗ δεν αποδίδει τίποτα — ποτέ σκελετός', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `loading` από τη συνθήκη εξόδου ⇒ κοκκινίζει.
    //    Ένας σκελετός είναι **υπόσχεση για περιεχόμενο** — και το §8.10 απαγορεύει
    //    ακριβώς τις υποσχέσεις που η βάση μπορεί να μην τηρήσει.
    const { container } = render(<LandingShowcase listings={many(6)} loading error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('🔴 σε ΣΦΑΛΜΑ δεν αποδίδει τίποτα', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `error !== null` ⇒ κοκκινίζει.
    const { container } = render(
      <LandingShowcase listings={many(6)} loading={false} error="boom" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('🔴 με ΚΑΜΙΑ αγγελία δεν αποδίδει τίποτα — ούτε κενή επικεφαλίδα', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `shown.length === 0` ⇒ κοκκινίζει με σκέτο <h2>.
    //    Επικεφαλίδα «Δες τι υπάρχει ήδη» πάνω από **τίποτα** είναι ο χειρότερος
    //    συνδυασμός: ισχυρισμός χωρίς απόδειξη.
    const { container } = render(<LandingShowcase listings={[]} {...READY} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Β4 — ΤΟ ΠΛΕΓΜΑ ΚΑΙ Η ΥΠΟΣΧΕΣΗ ΤΟΥ `sizes`', () => {
  it('🔴 το δηλωμένο πλάτος εικόνας ΣΥΜΦΩΝΕΙ με το `minmax` του πλέγματος', () => {
    // 🔴 **Ο ΦΡΟΥΡΟΣ ΠΟΥ ΥΠΟΣΧΕΘΗΚΕ ΤΟ DOCBLOCK.** Το `sizes` και το `minmax` είναι
    //    **δύο δηλώσεις του ίδιου αριθμού** σε δύο αρχεία-γραμμές. Αν αποκλίνουν, ο
    //    περιηγητής κατεβάζει λάθος παράγωγο **χωρίς κανένα ορατό σφάλμα**: θολό ή
    //    σπάταλο, σιωπηλά. Καμία άλλη πύλη δεν το ρωτά.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: άλλαξε το `minmax(18rem,…)` σε `minmax(28rem,…)` ⇒ κοκκινίζει.
    const { container } = render(<LandingShowcase listings={many(3)} {...READY} />);

    // ⚠️ **`section > ul`, ΠΟΤΕ `getByRole('list')`**: η ίδια η κάρτα αποδίδει δικό της
    //    `<ul>` για τα είδη προσφοράς ⇒ ο ρόλος βρίσκει **πολλές** λίστες και η δοκιμή
    //    πετά. Το πλέγμα είναι **το άμεσο παιδί της ενότητας**, και μόνο αυτό.
    const list = container.querySelector('section > ul');
    const declaredMin = /minmax\((\d+)rem/.exec(list?.className ?? '')?.[1];
    // ⚠️ **ΜΕΤΑ την παρένθεση**: το `sizes` είναι `(min-width: 40rem) 20rem, 100vw` —
    //    ένα σκέτο `(\d+)rem` πιάνει το **κατώφλι** (40) αντί για το **πλάτος** (20),
    //    και η δοκιμή θα συνέκρινε λάθος αριθμό. Πιάστηκε στην πρώτη εκτέλεση.
    const declaredSize = /\)\s*(\d+)rem/.exec(
      screen.getAllByRole('img')[0].getAttribute('sizes') ?? '',
    )?.[1];

    expect(declaredMin).toBeDefined();
    expect(declaredSize).toBeDefined();
    // Το δηλωμένο πλάτος λήψης δεν επιτρέπεται να είναι **μικρότερο** από το ελάχιστο
    // πλάτος της κάρτας (⇒ θολό), ούτε δυσανάλογα μεγαλύτερο (⇒ σπατάλη bytes).
    expect(Number(declaredSize)).toBeGreaterThanOrEqual(Number(declaredMin));
    expect(Number(declaredSize)).toBeLessThanOrEqual(Number(declaredMin) + 6);
  });

  it('🔴 σπάει έξω από το μέτρο με ΟΝΟΜΑ, ποτέ με αρνητικό περιθώριο', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε το `data-shell-span="full"` ⇒ κοκκινίζει.
    //    Χωρίς αυτό η βιτρίνα στριμώχνεται στο μέτρο ανάγνωσης — και ο επόμενος θα το
    //    «διόρθωνε» με `-mx-*`, που το CHECK 3.63 Κ2 μετρά ως παραβίαση.
    const { container } = render(<LandingShowcase listings={many(3)} {...READY} />);
    expect(container.querySelector('section')).toHaveAttribute('data-shell-span', 'full');
  });
});

describe('Β5 — ΜΟΝΟ ΜΙΑ ΕΙΚΟΝΑ ΕΙΝΑΙ LCP', () => {
  it('🔴 ακριβώς μία `fetchpriority="high"`, όσες κάρτες κι αν υπάρχουν', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `priority={index === 0}` σε `priority` ⇒ κοκκινίζει.
    //    Πολλές εικόνες «υψηλής προτεραιότητας» **ακυρώνουν η μία την άλλη** — το
    //    μετρημένο όφελος (LCP 2,6s → 1,9s) προϋποθέτει ότι είναι **μία**.
    render(<LandingShowcase listings={many(LANDING_SHOWCASE_LIMIT)} {...READY} />);

    const high = screen
      .getAllByRole('img')
      .filter((img) => img.getAttribute('fetchpriority') === 'high');

    expect(high).toHaveLength(1);
  });

  it('🔴 δείχνει το πολύ όσες λέει το όριο, ακόμη κι αν δοθούν περισσότερες', () => {
    const { container } = render(
      <LandingShowcase listings={many(LANDING_SHOWCASE_LIMIT + 5)} {...READY} />,
    );
    // ⚠️ Άμεσα παιδιά του πλέγματος — τα `<li>` των ειδών προσφοράς μέσα στην κάρτα
    //    **δεν** είναι κάρτες (δες Β4).
    expect(container.querySelectorAll('section > ul > li')).toHaveLength(
      LANDING_SHOWCASE_LIMIT,
    );
  });
});
