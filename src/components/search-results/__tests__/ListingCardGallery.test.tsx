/**
 * ΑΓΚΥΡΕΣ — η περιήγηση φωτογραφιών μέσα στην κάρτα (ADR-777 §8.57)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΥΠΑΡΧΕΙ: Η ΟΘΟΝΗ ΔΕΝ ΜΠΟΡΕΣΕ ΝΑ ΑΠΑΝΤΗΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Η ζωντανή επαλήθευση **απέτυχε να αποδείξει** ότι το βελάκι αλλάζει φωτογραφία, και
 * η αιτία μετρήθηκε: `document.visibilityState === 'hidden'` ⇒ ο Chrome **παγώνει τα
 * `requestAnimationFrame`** και **κάθε ομαλή κύλιση** σε κρυμμένη καρτέλα. Δηλαδή το
 * όργανο δεν μπορούσε να δει τη συμπεριφορά, όχι επειδή λείπει αλλά επειδή **ο ίδιος
 * ο μηχανισμός της δεν τρέχει εκεί**.
 *
 * 🔑 Οι άγκυρες εδώ απαντούν **ντετερμινιστικά** αυτό που ο περιηγητής αρνήθηκε: ο
 * `jsdom` δεν υλοποιεί κύλιση, οπότε το `scrollTo` **περιτυλίγεται** και ρωτάμε τι
 * ζητήθηκε — που είναι ακριβώς το συμβόλαιο του component προς τον περιηγητή.
 *
 * ⚠️ **Το `t` επιστρέφει το ΚΛΕΙΔΙ, επίτηδες** (ίδιο ιδίωμα με τα αδέλφια): άγκυρα
 * που ψάχνει ελληνικό κείμενο σπάει σε κάθε διόρθωση διατύπωσης και σταδιακά χαλαρώνει.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ListingCardGallery } from '../ListingCardGallery';
import type { ListingImage } from '@/types/public-listing';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

/** Ο `jsdom` δεν έχει `IntersectionObserver` — και δεν τον χρειαζόμαστε για την κρίση. */
beforeAll(() => {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
});

const SIZES = '(min-width: 1024px) 22rem, 100vw';

function images(count: number): readonly ListingImage[] {
  return Array.from({ length: count }, (_unused, index) => ({
    url: `https://shelf/${index}.webp`,
    width: 1280,
    height: 960,
    altKey: 'search-results:detail.media.galleryAlt',
    sources: [],
  })) as unknown as readonly ListingImage[];
}

/**
 * Ο κύλινδρος με **μετρήσιμο πλάτος** και **περιτυλιγμένο `scrollTo`**.
 *
 * 🔑 Ο `jsdom` δίνει `clientWidth === 0` σε κάθε στοιχείο και **δεν κυλά ποτέ**. Χωρίς
 * αυτά τα δύο, κάθε ισχυρισμός για τη θέση θα ήταν *«0 === 0»* — πράσινο που σημαίνει
 * «κανείς δεν κοίταξε», το σχήμα που αυτό το repo έχει πληρώσει πολλές φορές.
 */
function instrument(width = 400) {
  const scroller = screen.getByRole('list', { name: /galleryLabel/ });
  Object.defineProperty(scroller, 'clientWidth', { value: width, configurable: true });
  const calls: Array<Record<string, unknown>> = [];
  scroller.scrollTo = ((options: Record<string, unknown>) => {
    calls.push(options);
  }) as typeof scroller.scrollTo;
  return { scroller, calls };
}

// ═══════════════════════════════════════════════════════════════════════════
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// ═══════════════════════════════════════════════════════════════════════════

describe('Π — ο παρονομαστής', () => {
  it('Π1: ΜΙΑ φωτογραφία ⇒ ζωγραφίζεται, αλλά ΚΑΝΕΝΑ χειριστήριο', () => {
    // Δύο βελάκια πάνω σε μία φωτογραφία είναι υπόσχεση που δεν τηρείται.
    render(<ListingCardGallery images={images(1)} sizes={SIZES} />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('Π2: ΚΑΜΙΑ φωτογραφία ⇒ τίποτα — η απουσία ΔΕΝ γεμίζει', () => {
    const { container } = render(<ListingCardGallery images={images(0)} sizes={SIZES} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Π3: ΤΡΕΙΣ φωτογραφίες ⇒ τρία slides και δύο βελάκια', () => {
    render(<ListingCardGallery images={images(3)} sizes={SIZES} />);
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ — Η ΚΙΝΗΣΗ: ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ Ο ΠΕΡΙΗΓΗΤΗΣ ΑΡΝΗΘΗΚΕ ΝΑ ΑΠΑΝΤΗΣΕΙ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ — τα βελάκια κυλούν ΑΥΤΟΝ τον κύλινδρο', () => {
  it('🔴 Κ1: «Επόμενη» ζητά κύλιση κατά ΕΝΑ ΠΛΑΤΟΣ — όχι σταθερό αριθμό pixel', () => {
    render(<ListingCardGallery images={images(3)} sizes={SIZES} />);
    const { calls } = instrument(400);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(calls).toEqual([{ left: 400 }]);
  });

  it('🔴 Κ2: ΤΟ ΠΛΑΤΟΣ ΔΙΑΒΑΖΕΤΑΙ ΤΗ ΣΤΙΓΜΗ ΤΟΥ ΚΛΙΚ, όχι στην απόδοση', () => {
    // Η κάρτα αλλάζει πλάτος με το παράθυρο και με το φύλλο. Παγωμένο στιγμιότυπο θα
    // έστελνε τον άνθρωπο **ανάμεσα** σε δύο φωτογραφίες (κανόνας 2 του ADR-040).
    render(<ListingCardGallery images={images(3)} sizes={SIZES} />);
    const { scroller, calls } = instrument(400);
    Object.defineProperty(scroller, 'clientWidth', { value: 250, configurable: true });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(calls).toEqual([{ left: 250 }]);
  });

  it('🔴 Κ3: ΚΑΝΕΝΑ `behavior` στην κλήση — η ομαλότητα ανήκει στο CSS', () => {
    // Μετρημένο ζωντανά: `behavior: "smooth"` σε κρυμμένη καρτέλα ΔΕΝ κινεί τίποτα και
    // αποτυγχάνει ΣΙΩΠΗΛΑ. Η μετάβαση δεν επιτρέπεται να εξαρτάται από το animation.
    render(<ListingCardGallery images={images(2)} sizes={SIZES} />);
    const { calls } = instrument(300);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(calls[0]).not.toHaveProperty('behavior');
  });

  it('Κ4: ο κύλινδρος δηλώνει ομαλότητα στο CSS, με σεβασμό στο reduced-motion', () => {
    render(<ListingCardGallery images={images(2)} sizes={SIZES} />);
    const scroller = screen.getByRole('list', { name: /galleryLabel/ });
    expect(scroller.className).toContain('scroll-smooth');
    expect(scroller.className).toContain('motion-reduce:scroll-auto');
  });

  it('🔴 Κ5: Ο ΚΥΛΙΝΔΡΟΣ ΔΕΝ ΦΕΡΕΙ ΤΗΝ ΚΛΑΣΗ `flex` — ο καθολικός κανόνας τη σκοτώνει', () => {
    // `@media (max-width: 640px) { .flex, .grid { overflow-x: hidden !important } }`
    // στο globals.css. Με σκέτο `flex` μετρήθηκε `overflow-x: hidden` σε πλάτος 535px,
    // δηλαδή **μηδέν swipe σε κινητό** — εκεί ακριβώς που είναι ο κύριος τρόπος.
    render(<ListingCardGallery images={images(2)} sizes={SIZES} />);
    const scroller = screen.getByRole('list', { name: /galleryLabel/ });
    expect(scroller.classList.contains('flex')).toBe(false);
    expect(scroller.classList.contains('grid')).toBe(false);
    expect(scroller.className).toContain('[display:flex]');
    expect(scroller.className).toContain('overflow-x-auto');
  });

  it('🔴 Κ6: το swipe ΔΕΝ ΔΙΑΡΡΕΕΙ στη λίστα από πίσω', () => {
    render(<ListingCardGallery images={images(2)} sizes={SIZES} />);
    expect(screen.getByRole('list', { name: /galleryLabel/ }).className).toContain(
      'overscroll-x-contain',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Α — ΤΑ ΑΚΡΑ: το κουμπί που δεν έχει πού να πάει
// ═══════════════════════════════════════════════════════════════════════════

describe('Α — τα άκρα', () => {
  it('Α1: στην ΠΡΩΤΗ φωτογραφία το «Προηγούμενη» είναι ανενεργό', () => {
    render(<ListingCardGallery images={images(3)} sizes={SIZES} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('🔴 Α2: το «Προηγούμενη» ΔΕΝ εκφωνεί ΠΟΤΕ «0» — μετρήθηκε στην οθόνη', () => {
    // Πρώτη γραφή: `current: index` ⇒ στην πρώτη φωτογραφία το κουμπί έλεγε «(0/3)»,
    // αριθμό που δεν υπάρχει. Ο αριθμός είναι ο ΠΡΟΟΡΙΣΜΟΣ, ποτέ αρνητικός δείκτης.
    render(<ListingCardGallery images={images(3)} sizes={SIZES} />);
    const label = screen.getByRole('button', { name: /previous/i }).getAttribute('aria-label');
    expect(label).toContain('"current":1');
    expect(label).not.toContain('"current":0');
  });

  it('Α3: το «Επόμενη» δηλώνει τον ΠΡΟΟΡΙΣΜΟ και το σύνολο', () => {
    render(<ListingCardGallery images={images(3)} sizes={SIZES} />);
    const label = screen.getByRole('button', { name: /next/i }).getAttribute('aria-label');
    expect(label).toContain('"current":2');
    expect(label).toContain('"total":3');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Σ — ΤΟ ΣΥΜΒΟΛΑΙΟ ΠΡΟΣ ΤΗΝ ΚΑΡΤΑ ΚΑΙ ΠΡΟΣ ΤΗ ΒΟΗΘΗΤΙΚΗ ΤΕΧΝΟΛΟΓΙΑ
// ═══════════════════════════════════════════════════════════════════════════

describe('Σ — το συμβόλαιο', () => {
  it('Σ1: κάθε slide δηλώνει ΡΟΛΟ και ΘΕΣΗ (APG carousel)', () => {
    render(<ListingCardGallery images={images(2)} sizes={SIZES} />);
    const slides = screen.getAllByRole('group');
    expect(slides).toHaveLength(2);
    expect(slides[0].getAttribute('aria-roledescription')).toBe('slide');
    expect(slides[0].getAttribute('aria-label')).toContain('"current":1');
    expect(slides[1].getAttribute('aria-label')).toContain('"current":2');
  });

  it('Σ2: ο κύλινδρος δηλώνεται ως carousel', () => {
    render(<ListingCardGallery images={images(2)} sizes={SIZES} />);
    expect(
      screen.getByRole('list', { name: /galleryLabel/ }).getAttribute('aria-roledescription'),
    ).toBe('carousel');
  });

  it('🔴 Σ3: ΜΟΝΟ η πρώτη φωτογραφία της πρώτης κάρτας είναι προτεραιότητας', () => {
    // Πολλές εικόνες υψηλής προτεραιότητας ακυρώνουν η μία την άλλη (ADR-841 Α2.4).
    render(<ListingCardGallery images={images(3)} sizes={SIZES} priority />);
    const imgs = screen.getAllByRole('img');
    expect(imgs[0]).toHaveAttribute('loading', 'eager');
    expect(imgs[1]).toHaveAttribute('loading', 'lazy');
    expect(imgs[2]).toHaveAttribute('loading', 'lazy');
  });

  it('Σ4: χωρίς `priority`, ΚΑΜΙΑ δεν είναι eager', () => {
    render(<ListingCardGallery images={images(2)} sizes={SIZES} />);
    for (const img of screen.getAllByRole('img')) {
      expect(img).toHaveAttribute('loading', 'lazy');
    }
  });

  it('🔴 Σ5: ο σύνδεσμος της φωτογραφίας είναι ΠΛΕΟΝΑΣΜΑΤΙΚΟΣ — έξω από το πληκτρολόγιο', () => {
    // Χωρίς αυτό, 9 κάρτες × N φωτογραφίες = δεκάδες επιπλέον στάσεις `Tab` προς τον
    // ΙΔΙΟ προορισμό, και διπλή εκφώνηση σε κάθε μία.
    render(
      <ListingCardGallery
        images={images(2)}
        sizes={SIZES}
        renderSlideLink={(child) => (
          <a href="/listing/x" tabIndex={-1} aria-hidden="true">
            {child}
          </a>
        )}
      />,
    );
    for (const link of document.querySelectorAll('a')) {
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('Σ6: χωρίς `renderSlideLink` δεν γεννιέται ΚΑΝΕΝΑΣ σύνδεσμος', () => {
    render(<ListingCardGallery images={images(2)} sizes={SIZES} />);
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
