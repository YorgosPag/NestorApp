/**
 * ADR-923 §5.15.2 (Θ.2α-2) — άγκυρες των καθαρών πυρήνων του αναγνώστη εντύπου:
 * `pdfLinkTargetOf` (ποιος σύνδεσμος επιτρέπεται) · `resolvePdfDestinationPage` · `pdfLinkRegionOf` · `pdfPageFromFragment`.
 */

/* global describe, it, expect */

import type { PdfDocProxy, PdfPageProxy } from '../pdf-canvas-config';
import { pdfLinkRegionOf, pdfLinkTargetOf, resolvePdfDestinationPage } from '../pdf-link-target';
import { pdfPageFragment, pdfPageFromFragment } from '../usePdfPageInUrl';

describe('pdfLinkTargetOf — ο ένας κριτής συνδέσμων', () => {
  it.each(['https://aries.gr/fan-coil', 'http://example.com/a', 'mailto:info@aries.gr'])('επιτρέπει %s', (url) => {
    expect(pdfLinkTargetOf({ subtype: 'Link', url })).toMatchObject({ kind: 'external' });
  });

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://x.gr/a', 'όχι url'])('αρνείται %s', (url) => {
    expect(pdfLinkTargetOf({ subtype: 'Link', url })).toBeNull();
  });

  it('ετικέτα: host για web, διεύθυνση για mailto', () => {
    expect(pdfLinkTargetOf({ subtype: 'Link', url: 'https://aries.gr/x?y=1' })).toEqual({ kind: 'external', href: 'https://aries.gr/x?y=1', label: 'aries.gr' });
    expect(pdfLinkTargetOf({ subtype: 'Link', url: 'mailto:info@aries.gr' })).toMatchObject({ label: 'info@aries.gr' });
  });

  it('εσωτερικός: όνομα ή ρητός προορισμός', () => {
    expect(pdfLinkTargetOf({ subtype: 'Link', dest: 'chapter-2' })).toEqual({ kind: 'internal', dest: 'chapter-2' });
    expect(pdfLinkTargetOf({ subtype: 'Link', dest: [{ num: 7, gen: 0 }, { name: 'XYZ' }] })).toMatchObject({ kind: 'internal' });
  });

  it('ό,τι δεν είναι σύνδεσμος ή δεν έχει στόχο ⇒ null', () => {
    expect(pdfLinkTargetOf({ subtype: 'Widget', url: 'https://aries.gr' })).toBeNull();
    expect(pdfLinkTargetOf({ subtype: 'Link' })).toBeNull();
    expect(pdfLinkTargetOf({ subtype: 'Link', dest: [] })).toBeNull();
  });
});

function fakeDoc(numPages: number): PdfDocProxy {
  const doc: Pick<PdfDocProxy, 'numPages' | 'getDestination' | 'getPageIndex'> = {
    numPages,
    getDestination: async (id) => (id === 'chapter-2' ? [{ num: 12, gen: 0 }, { name: 'XYZ' }] : null),
    getPageIndex: async (ref) => (ref.num === 12 ? 1 : 99),
  };
  return doc as unknown as PdfDocProxy;
}

describe('resolvePdfDestinationPage', () => {
  it('όνομα → ρητός → σελίδα 1..N', async () => {
    await expect(resolvePdfDestinationPage(fakeDoc(3), 'chapter-2')).resolves.toBe(2);
  });
  it('ακέραιος δείκτης σελίδας', async () => {
    await expect(resolvePdfDestinationPage(fakeDoc(3), [0, { name: 'Fit' }])).resolves.toBe(1);
  });
  it('άγνωστο όνομα ή σελίδα εκτός εγγράφου ⇒ null', async () => {
    await expect(resolvePdfDestinationPage(fakeDoc(3), 'missing')).resolves.toBeNull();
    await expect(resolvePdfDestinationPage(fakeDoc(3), [{ num: 5, gen: 0 }])).resolves.toBeNull();
  });
});

/** Σελίδα 100×200 μονάδων PDF (αρχή κάτω-αριστερά), με στροφή 0 ή 90. */
function fakePage(): PdfPageProxy {
  const page = {
    getViewport: ({ rotation = 0 }: { scale: number; rotation?: number }) => {
      const turned = rotation % 180 !== 0;
      const toView = (x: number, y: number): [number, number] => (turned ? [y, x] : [x, 200 - y]);
      return {
        width: turned ? 200 : 100,
        height: turned ? 100 : 200,
        convertToViewportRectangle: ([x1, y1, x2, y2]: number[]) => [...toView(x1, y1), ...toView(x2, y2)],
      };
    },
  };
  return page as unknown as PdfPageProxy;
}

describe('pdfLinkRegionOf — κλάσματα της σελίδας όπως φαίνεται', () => {
  it('χωρίς στροφή: η αρχή γυρίζει πάνω-αριστερά', () => {
    expect(pdfLinkRegionOf(fakePage(), [10, 150, 60, 190], 0)).toEqual({ x: 0.1, y: 0.05, width: 0.5, height: 0.2 });
  });
  it('με στροφή: κλάσματα του στραμμένου κουτιού', () => {
    expect(pdfLinkRegionOf(fakePage(), [10, 150, 60, 190], 90)).toEqual({ x: 0.75, y: 0.1, width: 0.2, height: 0.5 });
  });
  it('εκφυλισμένο ή άκυρο ορθογώνιο ⇒ null', () => {
    expect(pdfLinkRegionOf(fakePage(), [10, 10, 10, 50], 0)).toBeNull();
    expect(pdfLinkRegionOf(fakePage(), [10, Number.NaN, 20, 50], 0)).toBeNull();
    expect(pdfLinkRegionOf(fakePage(), undefined, 0)).toBeNull();
  });
});

describe('pdfPageFromFragment — Adobe open parameters', () => {
  it.each([['#page=3', 3], ['page=85', 85], ['#page=3&zoom=200', 3], ['#zoom=200&page=4', 4]])('%s ⇒ %d', (hash, page) => {
    expect(pdfPageFromFragment(hash)).toBe(page);
  });
  it.each(['', '#', '#page=0', '#page=-1', '#page=2.5', '#page=abc', '#editor-lines', '#page=99999999999999999999'])('%s ⇒ null', (hash) => {
    expect(pdfPageFromFragment(hash)).toBeNull();
  });
  it('ο συντάκτης και ο αναγνώστης συμφωνούν', () => {
    expect(pdfPageFromFragment(pdfPageFragment(42))).toBe(42);
  });
});
