/**
 * ADR-736 — ανίχνευση εξωτερικών αναφορών.
 *
 * Το fixture είναι **συνθετικό αρχείο με πραγματικές τιμές**: οι διαδρομές, τα handles και τα
 * μεγέθη είναι αυτά που **μετρήθηκαν** στο τοπογραφικό του Ι. Νικολάου (10 IMAGE/IMAGEDEF,
 * handles `94E9`/`825C`/`217C`, `Z:\Jobs\…`). Έτσι το test προστατεύει την **πραγματική**
 * περίπτωση χωρίς να μπει αρχείο πελάτη (1,2 MB) στο git.
 *
 * Ο έλεγχος στο **αληθινό** αρχείο υπάρχει στο τέλος, πίσω από env var — βλ. σχόλιο εκεί.
 */

import { buildExternalReferences } from '../dxf-external-reference-reader';
import { splitDxfLines } from '../dxf-line-stream';
import { summarizeExternalReferences } from '../../types/dxf-external-reference';

/** Χτίζει ροή DXF από ζεύγη — ένα ζεύγος ανά δύο γραμμές, όπως το γράφει το AutoCAD. */
function dxf(...pairs: Array<[string, string]>): readonly string[] {
  return splitDxfLines(pairs.map(([code, value]) => `${code}\n${value}`).join('\n'));
}

function section(name: string, ...pairs: Array<[string, string]>): Array<[string, string]> {
  return [['0', 'SECTION'], ['2', name], ...pairs, ['0', 'ENDSEC']];
}

/** Ένα IMAGEDEF όπως ακριβώς το γράφει το δείγμα (μετρημένες τιμές). */
function imagedef(handle: string, path: string, widthPx: number): Array<[string, string]> {
  return [
    ['0', 'IMAGEDEF'],
    ['5', handle],
    ['90', '0'],
    ['1', path],
    ['10', String(widthPx)],
    ['20', '3000'],
    ['11', '0.2645833333333333'],
    ['21', '0.2645833333333333'],
    ['280', '1'],
    ['281', '5'],
  ];
}

describe('buildExternalReferences — raster (το μόνο είδος στο πραγματικό δείγμα)', () => {
  it('διαβάζει τη διαδρομή (group 1), το handle (5) και τα μεγέθη (10/20, 11/21)', () => {
    const lines = dxf(...section('OBJECTS',
      ...imagedef('94E9', 'Z:\\Jobs\\OT\\ΕΥΟΣΜΟΣ\\EYOSMO_1\\047\\2026 ΠΑΓΩΝΗΣ\\1.jpg', 4000),
    ));
    const refs = buildExternalReferences(lines);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      id: '94E9',
      kind: 'raster',
      status: 'missing',
      rawPath: 'Z:\\Jobs\\OT\\ΕΥΟΣΜΟΣ\\EYOSMO_1\\047\\2026 ΠΑΓΩΝΗΣ\\1.jpg',
      basename: '1.jpg',
      sourceHandle: '94E9',
      imageSizePx: { x: 4000, y: 3000 },
      loadedInSource: true,
    });
    expect(refs[0].pixelSizeUnits?.x).toBeCloseTo(0.2645833, 6);
  });

  it('🔴 γεννιέται ΠΑΝΤΑ `missing` — η ανίχνευση ΔΕΝ επιλύει', () => {
    const lines = dxf(...section('OBJECTS', ...imagedef('825C', 'Z:\\Jobs\\dianomi_1.JPG', 241)));
    expect(buildExternalReferences(lines)[0].status).toBe('missing');
    expect(buildExternalReferences(lines)[0].url).toBeUndefined();
  });

  it('ελληνικό όνομα αρχείου επιβιώνει ακέραιο (η σφραγίδα του μηχανικού)', () => {
    const lines = dxf(...section('OBJECTS',
      ...imagedef('217C', 'Z:\\Jobs\\arxeio\\ΣΦΡΑΓΙΔΑ ΜΑΥΡΟΜΙΧΑΛΗΣ.jpg', 465),
    ));
    expect(buildExternalReferences(lines)[0].basename).toBe('ΣΦΡΑΓΙΔΑ ΜΑΥΡΟΜΙΧΑΛΗΣ.jpg');
  });

  it('ΕΝΑ IMAGEDEF = ΜΙΑ αναφορά, ανεξάρτητα από πόσα IMAGE το δείχνουν (σχέση 1:N)', () => {
    // Δύο IMAGE δείχνουν στο ίδιο def (340 → 94E9). Αν παράγαμε αναφορά ανά οντότητα,
    // το ίδιο υπόβαθρο θα ανέβαινε δύο φορές και θα μετριόταν ως δύο συνημμένα.
    const lines = dxf(
      ...section('OBJECTS', ...imagedef('94E9', 'Z:\\Jobs\\1.jpg', 4000)),
      ...section('ENTITIES',
        ['0', 'IMAGE'], ['8', 'ΥΠΟΜΝΗΜΑ'], ['340', '94E9'],
        ['0', 'IMAGE'], ['8', 'ΠΕΡΙΓΡΑΦΗ'], ['340', '94E9'],
      ),
    );
    expect(buildExternalReferences(lines)).toHaveLength(1);
  });

  it('τα 10 συνημμένα του δείγματος → 10 αναφορές, όλες missing', () => {
    const paths = [
      '1.jpg', '2.jpg', '3.jpg', 'dianomi_1.JPG', 'dianomi_2.JPG',
      'diatagma_1993.JPG', 'diatagma_1994_47.JPG', 'google_47.JPG', 'gps_47.JPG',
      'ΣΦΡΑΓΙΔΑ ΜΑΥΡΟΜΙΧΑΛΗΣ.jpg',
    ];
    const lines = dxf(...section('OBJECTS',
      ...paths.flatMap((p, n) => imagedef(`H${n}`, `Z:\\Jobs\\${p}`, 500 + n)),
    ));
    const summary = summarizeExternalReferences(buildExternalReferences(lines));
    expect(summary).toEqual({ total: 10, resolved: 0, missing: 10, unsupported: 0 });
  });
});

describe('buildExternalReferences — XREF (BLOCK flag 70, bitmask ΟΧΙ ισότητα)', () => {
  const xrefBlock = (name: string, flags: string, path: string): Array<[string, string]> => [
    ['0', 'BLOCK'], ['5', `B${name}`], ['2', name], ['70', flags], ['1', path],
  ];

  it('bit 4 → xref· κρατά όνομα block και διαδρομή', () => {
    const lines = dxf(...section('BLOCKS', ...xrefBlock('RYMOTOMIKO', '4', '.\\rym.dwg')));
    expect(buildExternalReferences(lines)[0]).toMatchObject({
      kind: 'xref', status: 'unsupported', detail: 'RYMOTOMIKO',
      basename: 'rym.dwg', isOverlay: false,
    });
  });

  it('🔴 flags 12 (4|8) = overlay — ένας έλεγχος ισότητας `=== 4` θα το ΕΧΑΝΕ', () => {
    const lines = dxf(...section('BLOCKS', ...xrefBlock('OVL', '12', 'x.dwg')));
    const refs = buildExternalReferences(lines);
    expect(refs).toHaveLength(1);
    expect(refs[0].isOverlay).toBe(true);
  });

  it('🔴 flags 20 (4|16) = externally dependent — επίσης xref', () => {
    const lines = dxf(...section('BLOCKS', ...xrefBlock('DEP', '20', 'y.dwg')));
    expect(buildExternalReferences(lines)).toHaveLength(1);
  });

  it('τα blocks του δείγματος (flags 0 και 1) ΔΕΝ είναι xref', () => {
    // Μετρημένο: 18 blocks, flags μόνο 0/1. Το `1` = anonymous block, άσχετο με xref.
    const lines = dxf(...section('BLOCKS',
      ['0', 'BLOCK'], ['2', 'DEN13'], ['70', '0'],
      ['0', 'BLOCK'], ['2', '*D6'], ['70', '1'],
      ['0', 'BLOCK'], ['2', 'Κολόνα_ΔΕΗ'], ['70', '0'],
    ));
    expect(buildExternalReferences(lines)).toEqual([]);
  });
});

describe('buildExternalReferences — underlay / OLE / data link (ανιχνεύονται, δεν αποδίδονται)', () => {
  it('PDFDEFINITION → pdf-underlay με σελίδα (group 2)', () => {
    const lines = dxf(...section('OBJECTS',
      ['0', 'PDFDEFINITION'], ['5', 'PD1'], ['1', 'C:\\docs\\topo.pdf'], ['2', 'Sheet1'],
    ));
    expect(buildExternalReferences(lines)[0]).toMatchObject({
      kind: 'pdf-underlay', status: 'unsupported', basename: 'topo.pdf', detail: 'Sheet1',
    });
  });

  it('DWF και DGN definitions χαρτογραφούνται στα δικά τους είδη', () => {
    const lines = dxf(...section('OBJECTS',
      ['0', 'DWFDEFINITION'], ['5', 'W1'], ['1', 'a.dwf'],
      ['0', 'DGNDEFINITION'], ['5', 'G1'], ['1', 'b.dgn'],
    ));
    expect(buildExternalReferences(lines).map((r) => r.kind)).toEqual(['dwf-underlay', 'dgn-underlay']);
  });

  it('🔴 OLE2FRAME είναι `unsupported`, ΠΟΤΕ `missing` — τα bytes είναι ΜΕΣΑ στο αρχείο', () => {
    const lines = dxf(...section('ENTITIES',
      ['0', 'OLE2FRAME'], ['5', 'OL1'], ['3', 'Excel.Sheet.12'], ['310', 'DEADBEEF'],
    ));
    const ref = buildExternalReferences(lines)[0];
    expect(ref.status).toBe('unsupported');
    expect(ref.status).not.toBe('missing');
    expect(ref).toMatchObject({ kind: 'ole-embedded', rawPath: '', detail: 'Excel.Sheet.12' });
  });

  it('DATALINK → data-link (κωδικοί ΜΗ επαληθευμένοι σε πραγματικό αρχείο — βλ. σχόλιο reader)', () => {
    const lines = dxf(...section('OBJECTS',
      ['0', 'DATALINK'], ['5', 'DL1'], ['1', 'Πίνακας εμβαδών'], ['302', 'C:\\xls\\emvada.xlsx'],
    ));
    expect(buildExternalReferences(lines)[0]).toMatchObject({
      kind: 'data-link', status: 'unsupported', basename: 'emvada.xlsx', detail: 'Πίνακας εμβαδών',
    });
  });
});

describe('buildExternalReferences — ανθεκτικότητα', () => {
  it('αρχείο χωρίς OBJECTS/BLOCKS (R12 export) → κενή λίστα, ΟΧΙ σφάλμα', () => {
    const lines = dxf(...section('ENTITIES', ['0', 'LINE'], ['8', '0']));
    expect(buildExternalReferences(lines)).toEqual([]);
  });

  it('εντελώς κενή είσοδος → κενή λίστα', () => {
    expect(buildExternalReferences([])).toEqual([]);
    expect(buildExternalReferences(splitDxfLines(''))).toEqual([]);
  });

  it('IMAGEDEF χωρίς διαδρομή δεν ρίχνει τον parser', () => {
    const lines = dxf(...section('OBJECTS', ['0', 'IMAGEDEF'], ['5', 'X1'], ['280', '0']));
    expect(buildExternalReferences(lines)[0]).toMatchObject({
      rawPath: '', basename: '', loadedInSource: false,
    });
  });

  it('κολοβό αρχείο (λείπει το ENDSEC) δίνει ό,τι πρόλαβε αντί να χάσει τη section', () => {
    const lines = dxf(
      ['0', 'SECTION'], ['2', 'OBJECTS'],
      ...imagedef('94E9', 'Z:\\Jobs\\1.jpg', 4000),
    );
    expect(buildExternalReferences(lines)).toHaveLength(1);
  });

  it('η σειρά είναι ντετερμινιστική: OBJECTS → BLOCKS → ENTITIES (idempotent επανεισαγωγή)', () => {
    const lines = dxf(
      ...section('OBJECTS', ...imagedef('R1', 'a.jpg', 10)),
      ...section('BLOCKS', ['0', 'BLOCK'], ['5', 'B1'], ['2', 'X'], ['70', '4'], ['1', 'x.dwg']),
      ...section('ENTITIES', ['0', 'OLE2FRAME'], ['5', 'O1'], ['3', 'Word.Document.12']),
    );
    const once = buildExternalReferences(lines);
    expect(once.map((r) => r.kind)).toEqual(['raster', 'xref', 'ole-embedded']);
    expect(buildExternalReferences(lines)).toEqual(once);
  });
});

/**
 * Έλεγχος στο **πραγματικό** αρχείο του πελάτη — σκοπίμως εκτός προεπιλογής.
 *
 * Το αρχείο ζει στον φάκελο του πελάτη (`F:\`, **μόνο ανάγνωση**) και **δεν μπαίνει στο git**.
 * Τρέξ' το ρητά όταν θέλεις απόδειξη σε αληθινά bytes:
 *
 *   DXF_REAL_SAMPLE="F:\…\47_ergasia.dxf" npx jest dxf-external-reference-reader
 */
const realSample = process.env.DXF_REAL_SAMPLE;
const describeReal = realSample ? describe : describe.skip;

describeReal('buildExternalReferences — ΠΡΑΓΜΑΤΙΚΟ αρχείο (opt-in μέσω DXF_REAL_SAMPLE)', () => {
  it('βρίσκει 10 raster, 0 xref, 0 underlay, 0 OLE — όπως μετρήθηκε', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    const content = fs.readFileSync(realSample as string, 'utf8');
    const refs = buildExternalReferences(splitDxfLines(content));

    expect(summarizeExternalReferences(refs)).toEqual({
      total: 10, resolved: 0, missing: 10, unsupported: 0,
    });
    expect(refs.every((r) => r.kind === 'raster')).toBe(true);
    expect(refs.every((r) => r.rawPath.startsWith('Z:\\'))).toBe(true);
    expect(new Set(refs.map((r) => r.basename)).size).toBe(10);
  });
});
