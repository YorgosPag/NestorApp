/**
 * ADR-923 §5.13 Σ7 — το τυπωμένο QR: ποια βάση επιτρέπεται (απόφαση Giorgio 4), πού δείχνει, πόσο μεγάλο βγαίνει.
 */
import { linkableModelIds, PUBLICATION_QR_INK, PUBLICATION_QR_MODULE_MM, printedLinkBase, printedModelUrl, publicationQrCode } from '../publication-qr';
import { countLayoutQrCodes, type LayoutBlock, type LayoutSection } from '../layout-model';

const MODEL_ID = 'catpm_8f3c2a10-5b7e-4c1d-9a2f-0e6b1d4c7a99';

describe('printedLinkBase — απόφαση 4: η τελική έκδοση τυπώνει μόνο σε δημόσια https', () => {
  it('δημόσια https ⇒ βάση', () => {
    expect(printedLinkBase('final', 'https://nestorconstruct.gr')).toEqual({ kind: 'origin', origin: 'https://nestorconstruct.gr' });
  });

  it.each([
    ['http', 'http://nestorconstruct.gr'],
    ['localhost', 'http://localhost:3000'],
    ['https localhost', 'https://localhost:3000'],
    ['ιδιωτική IP', 'https://192.168.1.10'],
    ['οποιαδήποτε κυριολεκτική IP', 'https://8.8.8.8'],
    ['IPv6', 'https://[::1]'],
    ['ιδιωτική κατάληξη', 'https://nestor.local'],
    ['όνομα container', 'https://nestor-app'],
    ['διαπιστευτήρια στη διεύθυνση', 'https://user:pass@nestorconstruct.gr'],
  ])('🔒 %s ⇒ άρνηση', (_name, origin) => {
    expect(printedLinkBase('final', origin)).toEqual({ kind: 'refused' });
  });

  it('🔒 χωρίς ρυθμισμένη βάση ⇒ άρνηση, ποτέ σχετικός σύνδεσμος', () => {
    expect(printedLinkBase('final', null)).toEqual({ kind: 'refused' });
  });

  it('η προεπισκόπηση δείχνει το QR και πάνω σε localhost: δεν φεύγει από την οθόνη', () => {
    expect(printedLinkBase('preview', 'http://localhost:3000')).toEqual({ kind: 'origin', origin: 'http://localhost:3000' });
  });

  it('η προεπισκόπηση χωρίς βάση βγαίνει χωρίς QR, όχι με άρνηση', () => {
    expect(printedLinkBase('preview', null)).toEqual({ kind: 'none' });
  });
});

describe('printedModelUrl — ο ένας builder της σύντομης διεύθυνσης', () => {
  it('απόλυτη διεύθυνση `/q/<id>`, ποτέ slug', () => {
    expect(printedModelUrl('https://nestorconstruct.gr', MODEL_ID)).toBe(`https://nestorconstruct.gr/q/${MODEL_ID}`);
  });
});

describe('publicationQrCode — το σύμβολο στο μοντέλο διάταξης', () => {
  const code = publicationQrCode(printedModelUrl('https://nestorconstruct.gr', MODEL_ID), 'Σαρώστε');

  it('ζώνη 4 μονάδων, μονάδα 0,5 mm, μαύρο ενός μελανιού', () => {
    expect(code.quietModules).toBe(4);
    expect(code.moduleMm).toBe(PUBLICATION_QR_MODULE_MM);
    expect(code.ink).toEqual(PUBLICATION_QR_INK);
    expect(PUBLICATION_QR_INK.cmyk).toEqual([0, 0, 0, 100]);
  });

  it('μια πραγματική διεύθυνση χωρά σε ≤ 25 mm με τη ζώνη (στόχος GS1 0,495 mm)', () => {
    const sideMm = (code.modules + 2 * code.quietModules) * code.moduleMm;
    expect(sideMm).toBeGreaterThanOrEqual(20);
    expect(sideMm).toBeLessThanOrEqual(25);
  });

  it('κρατά τη διεύθυνση και τη λεζάντα', () => {
    expect(code.url).toBe(`https://nestorconstruct.gr/q/${MODEL_ID}`);
    expect(code.caption).toBe('Σαρώστε');
    expect(code.runs.length).toBeGreaterThan(0);
  });
});

describe('linkableModelIds', () => {
  it('μόνο σελίδες οικογένειας, μία φορά η καθεμία, ταξινομημένες', () => {
    const chapters = [
      { entries: [{ kind: 'variantModel', id: 'b' }, { kind: 'productGrid', id: 'family' }] },
      { entries: [{ kind: 'variantModel', id: 'a' }, { kind: 'priceChanges', id: 'changes' }, { kind: 'variantModel', id: 'b' }] },
    ];
    expect(linkableModelIds(chapters)).toEqual(['a', 'b']);
  });
});

describe('countLayoutQrCodes — η αναφορά μετρά ό,τι τυπώθηκε (§5.13 Σ7 κενό γ)', () => {
  const qr = publicationQrCode(printedModelUrl('https://nestorconstruct.gr', MODEL_ID), 'Σάρωσε');
  const heading = (withQr: boolean): LayoutBlock => ({ kind: 'heading', level: 2, text: 'Οικογένεια', outlined: true, ...(withQr ? { qr } : {}) });
  const section = (blocks: readonly LayoutBlock[]): LayoutSection => ({ id: 's', template: 'family', blocks });

  it('μετρά μόνο επικεφαλίδες που φέρουν σύμβολο, σε όλες τις ενότητες', () => {
    expect(countLayoutQrCodes({ sections: [section([heading(true), heading(false)]), section([heading(true)])] })).toBe(2);
  });

  it('έγγραφο χωρίς QR ⇒ 0, όχι «άγνωστο»', () => {
    expect(countLayoutQrCodes({ sections: [section([heading(false), { kind: 'toc', title: 'Περιεχόμενα' }])] })).toBe(0);
  });
});
