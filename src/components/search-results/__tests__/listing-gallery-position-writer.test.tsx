/**
 * ΑΓΚΥΡΕΣ — **ο ΕΝΑΣ γραφέας της θέσης φωτογραφίας** (ADR-777 §8.58.7)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ ΕΔΩ — ΚΑΙ ΓΙΑΤΙ ΚΑΜΙΑ ΑΛΛΗ ΑΓΚΥΡΑ ΔΕΝ ΤΟ ΕΒΛΕΠΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κρίκος «κάρτα → SSoT → φούσκα» έχει **τρία** κομμάτια, και μέχρι αυτό το αρχείο
 * ελέγχονταν μόνο **δύο**:
 *
 * | Κομμάτι | Ποιος το φυλάει |
 * |---|---|
 * | Το SSoT απαντά σωστά | `lib/listings/__tests__/listing-photo-position.test.ts` |
 * | Η φούσκα **ρωτά** και **πιστεύει** την απάντηση | `listing-map-popup-gallery.test.tsx` (Κ1-Κ3) |
 * | 🔴 **Η κάρτα ΓΡΑΦΕΙ, και ΣΒΗΝΕΙ όταν φεύγει** | **κανείς** — μέχρι εδώ |
 *
 * Χωρίς αυτό, το SSoT θα μπορούσε να μένει **μονίμως άδειο** και **και οι δύο** άλλες
 * σουίτες θα ήταν **πράσινες**: η μία γράφει μόνη της στο store, η άλλη το ίδιο. Δηλαδή
 * το κλασικό *«πράσινο που σημαίνει «δεν κοίταξα»»* — με τη διαφορά ότι εδώ ο
 * παρονομαστής θα ήταν **η ίδια η λειτουργία**.
 *
 * ⚠️ **Ο `jsdom` ΔΕΝ ΕΧΕΙ `IntersectionObserver`**, άρα ο μοναδικός γραφέας του δείκτη
 * **δεν τρέχει ποτέ** μόνος του. Το ψεύτικο παρακάτω **κρατά τον callback** ώστε η
 * άγκυρα να τον καλέσει η ίδια — δηλαδή εκτελεί **τον πραγματικό κώδικα του
 * component**, όχι αντίγραφό του.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

type ObserverCallback = (entries: ReadonlyArray<{ isIntersecting: boolean; target: Element }>) => void;

/** Οι ζωντανοί παρατηρητές, ώστε η άγκυρα να μπορεί να «δει» αντί για τον περιηγητή. */
const observers: Array<{ callback: ObserverCallback; targets: Element[] }> = [];

beforeAll(() => {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    private readonly entry: { callback: ObserverCallback; targets: Element[] };
    constructor(callback: ObserverCallback) {
      this.entry = { callback, targets: [] };
      observers.push(this.entry);
    }
    observe(target: Element) {
      this.entry.targets.push(target);
    }
    unobserve() {}
    disconnect() {
      const at = observers.indexOf(this.entry);
      if (at >= 0) observers.splice(at, 1);
    }
  };
});

beforeEach(() => {
  observers.length = 0;
});

import { ListingCardGallery } from '../ListingCardGallery';
import { photoPositionFor, forgetPhotoPosition } from '@/lib/listings/listing-photo-position';
import type { ListingImage } from '@/types/public-listing';

const LISTING_ID = 'prop_a0000001-7777-4aaa-8aaa-000000000001';

const IMAGES: readonly ListingImage[] = [0, 1, 2].map((n) => ({
  url: `https://example.test/${n}.jpg`,
  width: 1200,
  height: 900,
  altKey: 'search-results:detail.media.galleryAlt.agency',
  sources: [{ url: `https://example.test/${n}.jpg`, width: 1200 }],
}));

/** Λέει στη γκαλερί *«αυτό το slide είναι τώρα ορατό»*, όπως θα έκανε ο περιηγητής. */
function reveal(slideIndex: number): void {
  for (const observer of observers) {
    const target = observer.targets.find(
      (element) => (element as HTMLElement).dataset.slideIndex === String(slideIndex),
    );
    if (target) observer.callback([{ isIntersecting: true, target }]);
  }
}

afterEach(() => forgetPhotoPosition(LISTING_ID));

describe('ADR-777 §8.58.7 — η κάρτα δηλώνει τι βλέπει', () => {
  it('Γ1 — με `reportPositionAs`, η κύλιση στην 3η φωτογραφία ΓΡΑΦΕΤΑΙ στο SSoT', () => {
    render(
      <ListingCardGallery images={IMAGES} sizes="200px" reportPositionAs={LISTING_ID} />,
    );

    reveal(2);

    expect(photoPositionFor(LISTING_ID, 3)).toBe(2);
  });

  it('Γ2 — 🔴 ΧΩΡΙΣ `reportPositionAs` ΔΕΝ ΓΡΑΦΕΤΑΙ ΤΙΠΟΤΑ — αυτή είναι η φούσκα του χάρτη', () => {
    /*
      Είναι το ήμισυ του κανόνα «ένας γραφέας»: αν η γκαλερί έγραφε πάντα, η φούσκα θα
      πατούσε πάνω στη δήλωση της κάρτας με τον δικό της δείκτη — ο βρόχος ανάδρασης
      του §8.58.7, σιωπηλά και χωρίς να τον ζητήσει κανείς.
    */
    render(<ListingCardGallery images={IMAGES} sizes="176px" />);

    reveal(2);

    expect(photoPositionFor(LISTING_ID, 3)).toBe(0);
  });

  it('Γ3 — 🔴 Η ΛΗΘΗ ΤΡΕΧΕΙ ΣΤΟ UNMOUNT: η κάρτα φεύγει, η γραμμή σβήνει', () => {
    const view = render(
      <ListingCardGallery images={IMAGES} sizes="200px" reportPositionAs={LISTING_ID} />,
    );

    reveal(1);
    expect(photoPositionFor(LISTING_ID, 3)).toBe(1);

    view.unmount();

    // Χωρίς αυτό, ο πίνακας μεγαλώνει με κάθε αγγελία που πέρασε ποτέ από την οθόνη.
    expect(photoPositionFor(LISTING_ID, 3)).toBe(0);
  });

  it('Γ4 — ⚠️ ΑΛΛΑΓΗ ΦΩΤΟΓΡΑΦΙΩΝ ΔΕΝ ΣΒΗΝΕΙ ΤΗ ΘΕΣΗ — γι\' αυτό η λήθη ζει σε ΔΙΚΟ ΤΗΣ effect', () => {
    /*
      🔴 Ο παρατηρητής ξαναστήνεται σε κάθε αλλαγή του `total`. Αν η λήθη ζούσε στην
      **ίδια** καθαριότητα, μια ζωντανή ανανέωση του καταλόγου θα έσβηνε τη θέση που ο
      άνθρωπος μόλις διάλεξε — και η φούσκα θα άνοιγε στην πρώτη «χωρίς λόγο».
    */
    const view = render(
      <ListingCardGallery images={IMAGES} sizes="200px" reportPositionAs={LISTING_ID} />,
    );

    reveal(2);
    view.rerender(
      <ListingCardGallery images={IMAGES.slice(0, 2)} sizes="200px" reportPositionAs={LISTING_ID} />,
    );

    // Η δήλωση επιβιώνει· το **ψαλίδισμα** στο νέο σύνολο είναι δουλειά του κριτή.
    expect(photoPositionFor(LISTING_ID, 3)).toBe(2);
    expect(photoPositionFor(LISTING_ID, 2)).toBe(0);
  });
});
