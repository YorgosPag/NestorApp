/**
 * @fileoverview **`sizes` του lightbox = ό,τι ζωγραφίζεται** (ADR-899 §3.7, Π1).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Λ1: κάθετη φωτογραφία σε οριζόντιο κουτί δηλώνει το ΠΛΑΤΟΣ του κουτιού (μία βαθμίδα παραπάνω — μετρημένο §9).
 * - Λ2: χωρίς διαστάσεις ή χωρίς μέτρηση επινοείται αναλογία αντί για το `VIEWPORT_SIZES`.
 * - Λ3: η στρογγύλευση του κουτιού προς τα κάτω υποεκτιμά (θόλωμα) · μικρή εικόνα «μεγεθύνεται» στο `sizes`.
 * - Λ4: το `<img>` δεν παίρνει το μετρημένο `sizes`.
 */

import { render, screen } from '@testing-library/react';

import { containedWidth } from '@/lib/images/image-dimensions';

import { PhotoLightbox, VIEWPORT_SIZES, lightboxSizesOf, type LightboxPhoto } from '../PhotoLightbox';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const PORTRAIT: LightboxPhoto = { key: 'p', src: '/p.webp', alt: 'p', width: 1200, height: 1600 };
const LANDSCAPE: LightboxPhoto = { key: 'l', src: '/l.webp', alt: 'l', width: 1600, height: 739 };

describe('lightboxSizesOf', () => {
  it('🔴 Λ1 κάθετη σε οριζόντιο κουτί ⇒ το ΥΨΟΣ κρίνει', () => {
    // Κουτί 1680×1072 (+½ σκαλοπατιού = 1688×1080): η 3:4 ζωγραφίζεται 1080 × 3/4 = 810 css px πλάτος, όχι 1680.
    expect(lightboxSizesOf({ width: 1680, height: 1072 }, PORTRAIT)).toBe('810px');
    expect(lightboxSizesOf({ width: 1680, height: 1072 }, LANDSCAPE)).toBe('1600px');
  });

  it('🔴 Λ2 χωρίς διαστάσεις / χωρίς μέτρηση ⇒ το σημερινό sizes', () => {
    expect(lightboxSizesOf({ width: 1680, height: 1072 }, { key: 'x', src: '/x', alt: 'x' })).toBe(VIEWPORT_SIZES);
    expect(lightboxSizesOf({ width: 0, height: 0 }, PORTRAIT)).toBe(VIEWPORT_SIZES);
  });

  it('🔴 Λ3 άνω φράγμα του στρογγυλεμένου κουτιού · ποτέ πάνω από την εικόνα', () => {
    expect(lightboxSizesOf({ width: 400, height: 2000 }, LANDSCAPE)).toBe('408px');
    expect(lightboxSizesOf({ width: 4000, height: 4000 }, { ...PORTRAIT, width: 600, height: 400 })).toBe('600px');
    expect(containedWidth({ width: 0, height: 10 }, { width: 10, height: 10 })).toBe(0);
  });
});

describe('PhotoLightbox — μετρημένο κουτί', () => {
  const realObserver = global.ResizeObserver;
  const realRect = HTMLElement.prototype.getBoundingClientRect;

  beforeAll(() => {
    global.ResizeObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 1680, 1072);
  });
  afterAll(() => {
    global.ResizeObserver = realObserver;
    HTMLElement.prototype.getBoundingClientRect = realRect;
  });

  it('🔴 Λ4 το <img> παίρνει το sizes του object-contain', () => {
    render(<PhotoLightbox photos={[PORTRAIT]} floorplans={[]} openIndex={0} onNavigate={() => undefined} />);
    expect(screen.getByAltText('p').getAttribute('sizes')).toBe(lightboxSizesOf({ width: 1680, height: 1072 }, PORTRAIT));
  });
});
