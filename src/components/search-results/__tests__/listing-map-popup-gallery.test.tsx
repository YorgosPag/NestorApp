/**
 * ΑΓΚΥΡΕΣ — **η περιήγηση φωτογραφιών μέσα στη φούσκα του χάρτη** (ADR-777 §8.58)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΥΠΑΡΧΕΙ: Η ΠΑΓΙΔΑ ΕΙΝΑΙ **ΑΟΡΑΤΗ ΣΤΗΝ ΟΘΟΝΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η φούσκα είχε **όλο** το περιεχόμενό της μέσα σε `<Link>`. Η γκαλερί φέρνει μαζί
 * της **πραγματικά `<button>`** — και `<button>` μέσα σε `<a>` είναι **άκυρη HTML**:
 * ο περιηγητής **αναδομεί σιωπηλά** το δέντρο και το κλικ στο βελάκι ανοίγει την
 * αγγελία αντί να αλλάξει φωτογραφία.
 *
 * 🔑 **Καμία οπτική επιθεώρηση δεν το πιάνει** — η φούσκα φαίνεται σωστή, τα βελάκια
 * φαίνονται σωστά, και η βλάβη εμφανίζεται **μόνο στο κλικ**. Γι' αυτό η Φ2 παρακάτω
 * ρωτά τη **δομή**, όχι την εμφάνιση.
 *
 * ⚠️ **Το `t` επιστρέφει το ΚΛΕΙΔΙ, επίτηδες** — ίδιο ιδίωμα με τα αδέλφια.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * ⚠️ Το `Popup` της MapLibre απαιτεί ζωντανή μηχανή χάρτη. Εδώ γίνεται **διαφανές
 * περίβλημα**: η κρίση αφορά **το περιεχόμενο** της φούσκας, όχι την τοποθέτησή της.
 * Τα props τοποθέτησης (`offset`, `closeOnClick`, `anchor`) έχουν **δικό τους** σχόλιο
 * στην πηγή και δεν ελέγχονται από εδώ.
 */
jest.mock('@/lib/maps/maplibre', () => ({
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}));

beforeAll(() => {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});

import { ListingMapPopup } from '../ListingMapPopup';
import { listingLeadImage } from '@/lib/listings/listing-images';
import { notePhotoPosition, forgetPhotoPosition } from '@/lib/listings/listing-photo-position';
import type { PublicListing, ListingImage } from '@/types/public-listing';

function image(n: number): ListingImage {
  return {
    url: `https://example.test/${n}.jpg`,
    width: 1200,
    height: 900,
    altKey: 'search-results:detail.media.galleryAlt.agency',
    sources: [{ url: `https://example.test/${n}.jpg`, width: 1200 }],
  };
}

/** Αγγελία **στον χάρτη** με **τρεις** φωτογραφίες — το σενάριο του στιγμιότυπου. */
const LISTING: PublicListing = {
  id: 'prop_a0000001-7777-4aaa-8aaa-000000000001',
  commercialStatus: 'for-rent',
  commercial: { askingPrice: null, finalPrice: null, rentPrice: 500, nightlyRate: null },
  stay: null,
  coverImage: null,
  gallery: [image(1), image(2), image(3)],
  type: 'apartment',
  areaSqm: 80,
  offerKinds: ['rent'],
  position: {
    kind: 'known',
    provenance: 'manual',
    point: { lat: 40.64, lng: 22.94 },
    locatedAt: '2026-09-06T00:00:00.000Z',
  },
  place: null,
  authorship: 'agency',
  agencyName: 'ΠΑΓΩΝΗΣ Α.Ε.',
  agencyId: 'comp_a0000001-7777-4aaa-8aaa-000000000001',
  floor: 1,
  bedrooms: 2,
  energyClass: null,
  condition: null,
  renovationYear: null,
  bathrooms: null,
  wc: null,
  totalRooms: null,
  levels: null,
  balconies: null,
  netAreaSqm: null,
  balconyAreaSqm: null,
  terraceAreaSqm: null,
  gardenAreaSqm: null,
  heatingType: null,
  heatingFuel: null,
  coolingType: null,
  waterHeating: null,
  windowFrames: null,
  glazing: null,
  flooring: null,
  orientations: null,
  interiorFeatures: null,
  securityFeatures: null,
  amenities: null,
  title: 'ΔΟΚΙΜΗ Α — Ενοικίαση ΜΕ ενοίκιο',
  legality: [],
  projectedAt: '2026-09-06T00:00:00.000Z',
  listedAt: { kind: 'unknown', reason: 'predates-record' },
};

function draw(listing: PublicListing = LISTING) {
  return render(<ListingMapPopup listing={listing} filterQuery="" onClose={() => {}} />);
}

/**
 * 🔴 **ΟΙ ΕΙΚΟΝΕΣ ΖΗΤΟΥΝΤΑΙ ΑΠΟ ΤΗ ΔΟΜΗ, ΟΧΙ ΑΠΟ ΤΟΝ ΡΟΛΟ — ΚΑΙ ΕΙΝΑΙ ΕΥΡΗΜΑ.**
 *
 * Το `getAllByRole('img')` επιστρέφει **μηδέν**: κάθε φωτογραφία ζει μέσα στον
 * **πλεοναστικό** σύνδεσμό της, που είναι `aria-hidden="true"` — άρα ολόκληρο το
 * υποδέντρο λείπει από το δέντρο προσβασιμότητας. Αυτό είναι η **γραπτή, δοκιμασμένη
 * απόφαση του `ListingCard`** *(«δεύτερη διαδρομή για το ποντίκι, μηδέν κόστος για το
 * πληκτρολόγιο»)*, και η φούσκα την **κληρονομεί όπως είναι** — δεν την ανατρέπει εδώ.
 *
 * ⚠️ Το `alt` **δεν χάνεται**: μένει γραμμένο πάνω σε κάθε `<img>`, και ξαναγίνεται
 * ορατό στο δέντρο τη στιγμή που κάποιος αφαιρέσει το `aria-hidden`. Η Φ4 φυλάει
 * ακριβώς αυτή την απόφαση από τη μεριά του πληκτρολογίου.
 */
function photos(container: HTMLElement): readonly HTMLImageElement[] {
  return Array.from(container.querySelectorAll('img'));
}

describe('ADR-777 §8.58 — η φούσκα του χάρτη αποκτά περιήγηση φωτογραφιών', () => {
  it('Φ1 — ζωγραφίζει ΟΛΕΣ τις φωτογραφίες, όχι μόνο την πρώτη', () => {
    const { container } = draw();

    // Η ασυμμετρία που μετρήθηκε στο στιγμιότυπο: η κάρτα είχε τρεις, η φούσκα μία.
    expect(photos(container)).toHaveLength(3);
  });

  it('Φ2 — 🔴 ΚΑΝΕΝΑ ΒΕΛΑΚΙ ΔΕΝ ΕΙΝΑΙ ΜΕΣΑ ΣΕ ΣΥΝΔΕΣΜΟ — άκυρη HTML που σπάει ΜΟΝΟ στο κλικ', () => {
    const { container } = draw();

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of Array.from(buttons)) {
      expect(button.closest('a')).toBeNull();
    }
  });

  it('Φ3 — ο ονομαστικός σύνδεσμος είναι ο ΤΙΤΛΟΣ, και απλώνει link-overlay σε όλη τη φούσκα', () => {
    const { container } = draw();

    // Ο τίτλος είναι ο **ένας** σύνδεσμος που φτάνει το πληκτρολόγιο· οι σύνδεσμοι των
    // φωτογραφιών είναι πλεοναστικοί (`tabIndex={-1}` + `aria-hidden`).
    const named = screen.getByRole('link', { name: LISTING.title });
    expect(named.className).toContain('after:absolute');
    expect(named.className).toContain('after:inset-0');

    // ⚠️ Χωρίς `relative` στον πρόγονο, το `inset-0` απλώνεται σε ό,τι βρει πιο πάνω —
    //    εδώ, ολόκληρο τον χάρτη.
    const article = container.querySelector('article');
    expect(article).toHaveClass('relative');
  });

  it('Φ4 — οι σύνδεσμοι των φωτογραφιών είναι ΠΛΕΟΝΑΣΜΑΤΙΚΟΙ: μηδέν επιπλέον στάσεις `Tab`', () => {
    draw();

    // Τρεις φωτογραφίες ⇒ τρεις κρυφοί σύνδεσμοι + ένας ονομαστικός. Αν έσπαγε το
    // `aria-hidden`, ο άνθρωπος με αναγνώστη οθόνης θα άκουγε τον ίδιο προορισμό 4 φορές.
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('Φ5 — η ΠΡΩΤΗ φωτογραφία μένει αυτή που έδειχνε η φούσκα ΠΡΙΝ (καμία αλλαγή σε ό,τι βλέπει πρώτο)', () => {
    const { container } = draw();

    const lead = listingLeadImage(LISTING);
    expect(lead).not.toBeNull();
    expect(photos(container)[0]).toHaveAttribute('src', lead?.url);
  });

  it('Φ6 — αγγελία ΧΩΡΙΣ φωτογραφίες: η φούσκα μένει, η γκαλερί σιωπά, ο τίτλος οδηγεί', () => {
    const { container } = draw({ ...LISTING, gallery: [] });

    expect(photos(container)).toHaveLength(0);
    expect(screen.getByRole('link', { name: LISTING.title })).toBeInTheDocument();
  });

  it('Φ7 — το `sizes` της εικόνας συμφωνεί με το ΠΡΑΓΜΑΤΙΚΟ πλάτος της φούσκας (`w-44` = 176px)', () => {
    const { container } = draw();

    // 🔴 Αποκλίνοντα, τα δύο αφήνουν την οθόνη **σωστή** και τον επιλογέα πηγής
    //    **λάθος** — σφάλμα που καμία οπτική επιθεώρηση δεν πιάνει.
    expect(container.querySelector('article')).toHaveClass('w-44');
    expect(photos(container)[0]).toHaveAttribute('sizes', '176px');
  });

  /* ─────────────────────────────────────────────────────────────────────────
     ADR-777 §8.58.7 — Η ΚΛΗΡΟΝΟΜΙΑ ΑΡΧΙΚΗΣ ΘΕΣΗΣ

     🔴 Ο `jsdom` **δεν έχει διάταξη**: `clientWidth` = 0, άρα το `scrollTo` της
     γκαλερί δεν μπορεί να μετρηθεί εδώ — αυτό ανήκει στον περιηγητή. Αυτό που
     **μπορεί** και **πρέπει** να μετρηθεί είναι το ΣΥΜΒΟΛΑΙΟ: ότι η φούσκα
     **ρωτά** το SSoT και **παραδίδει** την απάντηση στη γκαλερί ως `initialIndex`.

     ⚠️ Γι' αυτό η Κ2 κατασκοπεύει το prop αντί για το DOM: ένα τεστ που κοίταζε
     `scrollLeft` θα ήταν **μονίμως πράσινο για λάθος λόγο** (0 === 0).
     ───────────────────────────────────────────────────────────────────────── */
  describe('Κληρονομιά αρχικής θέσης (§8.58.7)', () => {
    afterEach(() => forgetPhotoPosition(LISTING.id));

    it('Κ1 — καμία δήλωση από την κάρτα ⇒ η φούσκα ξεκινά από την ΠΡΩΤΗ', () => {
      const { container } = draw();
      expect(photos(container)[0]).toHaveAttribute('src', listingLeadImage(LISTING)?.url);
    });

    it('Κ2 — 🔑 Η ΚΑΡΤΑ ΕΙΧΕ ΞΕΦΥΛΛΙΣΕΙ ΣΤΗΝ 3η ⇒ Η ΦΟΥΣΚΑ ΑΝΟΙΓΕΙ ΕΚΕΙ', () => {
      notePhotoPosition(LISTING.id, 2);
      draw();

      /*
        🔴 **ΜΕΤΡΙΕΤΑΙ Η ΦΩΝΗ, ΟΧΙ ΤΟ PROP — ΚΑΙ Η ΕΠΙΛΟΓΗ ΕΙΝΑΙ Η ΑΓΚΥΡΑ.**

        Ο `jsdom` **δεν έχει διάταξη** (`clientWidth` = 0), άρα το `scrollLeft` που θα
        ακολουθούσε είναι **αμέτρητο εδώ** — ένα τεστ πάνω του θα ήταν μονίμως πράσινο
        για λάθος λόγο (`0 === 0`). Και ένας κατάσκοπος στο prop θα επιβεβαίωνε μόνο
        ότι *«περάσαμε αριθμό»*, όχι ότι **η γκαλερί τον πίστεψε**.

        🔑 Το `aria-label` των βελακιών παράγεται από τον **δείκτη κατάστασης** της
        γκαλερί — δηλαδή είναι η ίδια η απόδειξη ότι ο σπόρος φύτρωσε, **και**
        ταυτόχρονα αυτό που θα ακούσει ο άνθρωπος με αναγνώστη οθόνης.

        Με 3 φωτογραφίες και δείκτη `2` *(η τελευταία)*: το «Προηγούμενη» οδηγεί στη
        **2η** και το «Επόμενη» τυλίγεται στην **1η** (§8.57.7, λούπα).
      */
      const previous = screen.getByLabelText(/previousAria/);
      expect(previous.getAttribute('aria-label')).toContain('"current":2');

      const next = screen.getByLabelText(/nextAria/);
      expect(next.getAttribute('aria-label')).toContain('"current":1');
    });

    it('Κ2β — 🔴 ΜΕΤΑΛΛΑΞΗ ΣΤΗΝ ΙΔΙΑ ΤΗΝ ΑΓΚΥΡΑ: χωρίς δήλωση, οι ΙΔΙΕΣ φωνές λένε ΑΛΛΟΥΣ αριθμούς', () => {
      // Χωρίς αυτό, η Κ2 θα μπορούσε να περνά για λόγο άσχετο με την κληρονομιά.
      draw();

      expect(screen.getByLabelText(/previousAria/).getAttribute('aria-label')).toContain('"current":3');
      expect(screen.getByLabelText(/nextAria/).getAttribute('aria-label')).toContain('"current":2');
    });

    it('Κ3 — 🔴 Η ΦΟΥΣΚΑ ΔΕΝ ΓΡΑΦΕΙ ΠΟΤΕ: μετά το άνοιγμά της, το SSoT μένει ΑΘΙΚΤΟ', () => {
      notePhotoPosition(LISTING.id, 2);
      draw();

      // Αν η φούσκα δήλωνε `reportPositionAs`, ο δικός της παρατηρητής θα έγραφε `0`
      // πάνω από το `2` της κάρτας — ο βρόχος ανάδρασης του §8.58.7, σιωπηλά.
      const { photoPositionFor } = require('@/lib/listings/listing-photo-position') as typeof import('@/lib/listings/listing-photo-position');
      expect(photoPositionFor(LISTING.id, 3)).toBe(2);
    });
  });
});
