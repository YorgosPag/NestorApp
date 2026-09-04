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
import type { PublicShowcase } from '@/types/agency-profile';

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

/**
 * ⚠️ **ΟΙ ΤΡΕΙΣ ΣΤΑΘΕΡΕΣ ΤΗΣ ΑΠΟΔΟΣΗΣ.** Το `mode` έγινε **υποχρεωτικό** με την Α4.3:
 * η βιτρίνα είναι πλέον **το πάνελ του διακόπτη**, όχι μια λίστα δίπλα του.
 *
 * 🔑 `mode="buy"` και **όχι** `null`: τα δείγματα εδώ είναι όλα `offerKinds: ['sell']`,
 * άρα το πλήθος **δεν αλλάζει** — αλλά η άγκυρα περνά από τη **ζωντανή** διαδρομή
 * φιλτραρίσματος αντί να την παρακάμπτει. Ένα `null` θα έλεγχε τον **παλιό** κώδικα.
 */
const READY = { loading: false, error: null, mode: 'buy', agencies: [] } as const;

/** Μόνο η κατάσταση φόρτωσης — η λειτουργία δηλώνεται ρητά σε κάθε δοκιμή της Β6. */
const READY_STATE = { loading: false, error: null } as const;

describe('Β3 — ΣΙΩΠΑ ΟΤΑΝ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΑΠΟΔΕΙΞΕΙ', () => {
  it('🔴 σε ΦΟΡΤΩΣΗ δεν αποδίδει τίποτα — ποτέ σκελετός', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `loading` από τη συνθήκη εξόδου ⇒ κοκκινίζει.
    //    Ένας σκελετός είναι **υπόσχεση για περιεχόμενο** — και το §8.10 απαγορεύει
    //    ακριβώς τις υποσχέσεις που η βάση μπορεί να μην τηρήσει.
    const { container } = render(<LandingShowcase listings={many(6)} agencies={[]} mode="buy" loading error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('🔴 σε ΣΦΑΛΜΑ δεν αποδίδει τίποτα', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `error !== null` ⇒ κοκκινίζει.
    const { container } = render(
      <LandingShowcase listings={many(6)} agencies={[]} mode="buy" loading={false} error="boom" />,
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

  it('🔴 ΦΟΡΑΕΙ την ταυτότητα του πάνελ που της δίνουν — και ΔΕΝ χάνει το πλάτος', () => {
    // 🔴 **Η ΜΗΧΑΝΙΚΗ ΠΡΟΫΠΟΘΕΣΗ ΤΗΣ Α4.3.12**: με διακόπτη, η σελίδα τυλίγει τη
    //    βιτρίνα σε `TabsContent asChild` ⇒ το Radix περνά εδώ `role` · `id` ·
    //    `aria-labelledby`. Αν αυτά δεν φτάσουν στην ίδια την ενότητα, το
    //    `aria-controls` του κουμπιού **ξανακρέμεται** — και το ελάττωμα επιστρέφει
    //    χωρίς να το δει καμία δοκιμή αυτού του αρχείου.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το άπλωμα `{...panelProps}` ⇒ κοκκινίζει.
    // ⚠️ **Και η ετικέτα**: όταν έρθει `aria-labelledby` από το πάνελ, νικά την `h2` —
    //    το πάνελ ονομάζεται από **το κουμπί** του, όπως ζητά το APG.
    const { container } = render(
      <LandingShowcase
        listings={many(3)}
        {...READY}
        role="tabpanel"
        id="panel-buy"
        aria-labelledby="tab-buy"
      />,
    );

    const section = container.querySelector('section') as HTMLElement;
    expect(section).toHaveAttribute('role', 'tabpanel');
    expect(section).toHaveAttribute('id', 'panel-buy');
    expect(section).toHaveAttribute('aria-labelledby', 'tab-buy');
    expect(section).toHaveAttribute('data-shell-span', 'full');
  });

  it('🔴 ΧΩΡΙΣ πάνελ, την ετικέτα τη δίνει η δική της επικεφαλίδα', () => {
    // ⚠️ Το `?? headingId` δεν είναι εφεδρεία «για καλό και για κακό»: χωρίς διακόπτη
    //    **δεν υπάρχει** κουμπί να ονομάσει την ενότητα, και μια ανώνυμη `section` δεν
    //    εκτίθεται καν ως ορόσημο.
    const { container } = render(<LandingShowcase listings={many(3)} {...READY} />);

    const section = container.querySelector('section') as HTMLElement;
    const labelledBy = section.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)).toBe(
      screen.getByRole('heading', { level: 2 }),
    );
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

describe('Β6 — 🔴 ΤΟ ΠΑΝΕΛ ΤΟΥ ΔΙΑΚΟΠΤΗ, ΣΤΗΝ ΟΘΟΝΗ (Α4.3)', () => {
  // 🔴 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΜΟΝΟ ΣΤΟ `landing-modes.test.ts`.** Εκεί ρωτάμε *«ποιες
  //    αγγελίες;»* — καθαρή συνάρτηση. Εδώ ρωτάμε *«τι ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ;»*, και το
  //    ελάττωμα της Α4.3 ήταν **ακριβώς** στο ορατό μισό: το βρήκε **μάτι σε
  //    στιγμιότυπο**, με 20/20 άγκυρες πράσινες. Το §8.49 το έχει ήδη μετρήσει
  //    **τέσσερις φορές σε τέσσερις συνεδρίες**.

  function profile(companyId: string, displayName: string): PublicShowcase {
    return {
      companyId,
      displayName,
      alias: companyId,
      credentials: [],
    } as unknown as PublicShowcase;
  }

  const PROS = [profile('c1', 'Υδραυλικά Ρήγας'), profile('c2', 'Μελέτες Άλφα')];

  it('🔴 στους ΕΠΑΓΓΕΛΜΑΤΙΕΣ δεν φτάνει ΚΑΜΙΑ αγγελία — ούτε μία εικόνα ακινήτου', () => {
    // 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΤΟΥ §1.3, ΑΥΤΟΛΕΞΕΙ**: η οθόνη έλεγε *«ψάχνεις επαγγελματία»*
    //    και από κάτω έδειχνε **διαμερίσματα** — σε ανθρώπους που ψάχνουν **πρόσωπο
    //    εμπιστοσύνης** (Α5).
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `landingPanelListings` να επιστρέφει αγγελίες και για
    //    το `pros` ⇒ κοκκινίζει και στα τρία σκέλη.
    render(<LandingShowcase mode="pros" listings={many(6)} agencies={PROS} {...READY_STATE} />);

    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.queryByText('Τ01')).not.toBeInTheDocument();
    expect(screen.getByText('Υδραυλικά Ρήγας')).toBeInTheDocument();
  });

  it('🔴 ο ΤΙΤΛΟΣ ακολουθεί το περιεχόμενο — αλλιώς λέει ψέματα μία γραμμή πιο πάνω', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάρφωσε το `landing.showcase.heading` ⇒ κοκκινίζει. Το «Δες
    //    τι υπάρχει ήδη» πάνω από πρόσωπα διαβάζεται ως «να τα ακίνητα».
    const { rerender } = render(
      <LandingShowcase mode="buy" listings={many(3)} agencies={PROS} {...READY_STATE} />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'search-results:landing.showcase.heading',
    );

    rerender(
      <LandingShowcase mode="pros" listings={many(3)} agencies={PROS} {...READY_STATE} />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'search-results:landing.showcase.prosHeading',
    );
  });

  it('🔴 οι κάρτες προσώπων μπαίνουν ΜΕΣΑ στο ίδιο πλέγμα — όχι σε δεύτερη ενότητα', () => {
    // 🔑 **ΕΝΑ πλέγμα, δύο είδη κάρτας** (N.18): μια δεύτερη `<section><ul>` για τους
    //    επαγγελματίες θα ήταν **δίδυμος κλώνος** της ίδιας διάταξης — ακριβώς το σχήμα
    //    που το `jscpd` πιάνει ανεξάρτητα ονόματος.
    const { container } = render(
      <LandingShowcase mode="pros" listings={[]} agencies={PROS} {...READY_STATE} />,
    );

    expect(container.querySelectorAll('section')).toHaveLength(1);
    expect(container.querySelectorAll('section > ul > li')).toHaveLength(PROS.length);
    expect(container.querySelector('section')).toHaveAttribute('data-shell-span', 'full');
  });

  it('🔴 ΧΩΡΙΣ ΕΠΑΓΓΕΛΜΑΤΙΕΣ σιωπά — ποτέ επικεφαλίδα πάνω από τίποτα', () => {
    // Ίδιος κανόνας με το Β3: ισχυρισμός χωρίς απόδειξη είναι το χειρότερο που μπορεί
    // να κάνει αυτή η οθόνη (§8.10).
    const { container } = render(
      <LandingShowcase mode="pros" listings={many(6)} agencies={[]} {...READY_STATE} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('🔴 ΧΩΡΙΣ ΔΙΑΚΟΠΤΗ (`mode={null}`) δείχνει ΟΛΕΣ — φίλτρο χωρίς χειριστήριο = απώλεια', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `null` να φιλτράρει ⇒ κοκκινίζει. Ο επισκέπτης θα
    //    έβλεπε λιγότερα απ' όσα υπάρχουν, **χωρίς κανένα κουμπί να το αναιρέσει**.
    const { container } = render(
      <LandingShowcase mode={null} listings={many(3)} agencies={PROS} {...READY_STATE} />,
    );
    expect(container.querySelectorAll('section > ul > li')).toHaveLength(3);
  });
});
