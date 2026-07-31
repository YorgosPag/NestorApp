/**
 * ADR-736 Φ3α — η ΣΚΑΛΑ ταύτισης. Καθαρή λογική, μηδέν browser.
 *
 * Το βαρύ σενάριο είναι το τελευταίο: **το πραγματικό τοπογραφικό**, όπου κανένα όνομα δεν
 * ταιριάζει και τα πάντα κρέμονται από τις διαστάσεις σε pixels.
 */

import type { DxfExternalReference } from '../../types/dxf-external-reference';
import { matchExternalReferences, type ReferenceMatchDeps } from '../dxf-external-reference-match';

/** Ελαφρύ `File` — δεν χρειάζεται πραγματικό περιεχόμενο, η ταύτιση δεν διαβάζει bytes. */
const file = (name: string): File => new File([new Uint8Array([1])], name);

function ref(overrides: Partial<DxfExternalReference> = {}): DxfExternalReference {
  return {
    id: 'H1',
    kind: 'raster',
    status: 'missing',
    rawPath: 'Z:\\Jobs\\dianomi_1.JPG',
    basename: 'dianomi_1.JPG',
    sourceHandle: 'H1',
    ...overrides,
  };
}

/** Οι διαστάσεις έρχονται injected — γι' αυτό ολόκληρη η σκάλα ελέγχεται χωρίς εικόνες. */
function depsWithSizes(sizes: Record<string, { x: number; y: number }>): ReferenceMatchDeps {
  return { pixelSizeOf: async (f) => sizes[f.name] ?? null };
}

const NO_SIZES: ReferenceMatchDeps = { pixelSizeOf: async () => null };

describe('matchExternalReferences — η σκάλα', () => {
  it('1) ακριβές όνομα', async () => {
    const r = await matchExternalReferences([ref()], [file('dianomi_1.JPG'), file('άλλο.jpg')], NO_SIZES);
    expect(r.matched).toEqual([{ refId: 'H1', file: expect.any(File), reason: 'exact-name' }]);
    expect(r.matched[0].file.name).toBe('dianomi_1.JPG');
  });

  it('2) όνομα ανεξαρτήτως πεζών/κεφαλαίων — τα Windows είναι case-insensitive', async () => {
    // Ο τοπογράφος γράφει `dianomi_1.JPG` και στέλνει `dianomi_1.jpg` χωρίς να το καταλάβει.
    const r = await matchExternalReferences([ref()], [file('dianomi_1.jpg')], NO_SIZES);
    expect(r.matched[0].reason).toBe('case-insensitive-name');
  });

  it('3) όνομα χωρίς κατάληξη — ξανα-εξαγωγή σε άλλη μορφή', async () => {
    const r = await matchExternalReferences(
      [ref({ basename: '1.jpg', rawPath: 'Z:\\1.jpg' })],
      [file('1.png')],
      NO_SIZES,
    );
    expect(r.matched[0].reason).toBe('stem');
  });

  it('4) διαστάσεις σε pixels — όταν το αρχείο έχει ΜΕΤΟΝΟΜΑΣΤΕΙ', async () => {
    const r = await matchExternalReferences(
      [ref({ imageSizePx: { x: 690, y: 500 } })],
      [file('ΤΕΛΙΚΟ σκαναρισμα.jpg')],
      depsWithSizes({ 'ΤΕΛΙΚΟ σκαναρισμα.jpg': { x: 690, y: 500 } }),
    );
    expect(r.matched[0].reason).toBe('pixel-size');
  });

  it('το ΙΣΧΥΡΟΤΕΡΟ πέρασμα κερδίζει όταν ισχύουν πολλά', async () => {
    const r = await matchExternalReferences(
      [ref({ imageSizePx: { x: 690, y: 500 } })],
      [file('dianomi_1.JPG')],
      depsWithSizes({ 'dianomi_1.JPG': { x: 690, y: 500 } }),
    );
    expect(r.matched[0].reason).toBe('exact-name');
  });

  it('ΣΥΝΕΧΙΖΕΙ τη σκάλα όταν ένα πέρασμα είναι διφορούμενο — «σταματά στο πρώτο ΜΟΝΟΣΗΜΑΝΤΟ»', async () => {
    // Δύο αρχεία με stem «1» (1.png, 1.webp) ⇒ το πέρασμα 3 δεν αποφασίζει. Το πέρασμα 4
    // (διαστάσεις) διαλέγει ένα. Αν η σκάλα σταματούσε στο πρώτο πέρασμα ΜΕ ΥΠΟΨΗΦΙΟΥΣ, το
    // αρχείο θα έμενε αναπάντητο ενώ η απάντηση ήταν διαθέσιμη ένα σκαλί πιο κάτω.
    const r = await matchExternalReferences(
      [ref({ basename: '1.jpg', rawPath: 'Z:\\1.jpg', imageSizePx: { x: 800, y: 600 } })],
      [file('1.png'), file('1.webp')],
      depsWithSizes({ '1.png': { x: 800, y: 600 }, '1.webp': { x: 1024, y: 768 } }),
    );
    expect(r.ambiguous).toEqual([]);
    expect(r.matched[0].file.name).toBe('1.png');
    expect(r.matched[0].reason).toBe('pixel-size');
  });
});

describe('matchExternalReferences — πότε ΔΕΝ αποφασίζει', () => {
  it('δύο υποψήφιοι σε κάθε πέρασμα ⇒ διφορούμενη, με το ΠΡΩΤΟ (ισχυρότερο) σύνολο', async () => {
    const r = await matchExternalReferences(
      [ref({ basename: '1.jpg', rawPath: 'Z:\\1.jpg', imageSizePx: { x: 800, y: 600 } })],
      [file('1.png'), file('1.webp')],
      depsWithSizes({ '1.png': { x: 800, y: 600 }, '1.webp': { x: 800, y: 600 } }),
    );
    expect(r.matched).toEqual([]);
    expect(r.ambiguous).toHaveLength(1);
    expect(r.ambiguous[0].reason).toBe('stem');
    expect(r.ambiguous[0].candidates.map((f) => f.name)).toEqual(['1.png', '1.webp']);
  });

  it('🔴 ΔΥΟ αναφορές διεκδικούν ΤΟ ΙΔΙΟ αρχείο ⇒ ΚΑΜΙΑ δεν το παίρνει', async () => {
    // Δύο σαρώσεις διαταγμάτων με ίδιες διαστάσεις, ο χρήστης έδωσε μόνο τη μία. Χωρίς τον
    // κανόνα αποκλειστικότητας, ΚΑΙ ΟΙ ΔΥΟ θα «επιλύονταν» στην ίδια εικόνα ⇒ λάθος υπόβαθρο
    // σε λάθος θέση, ΣΙΩΠΗΛΑ. Το «δεν ξέρω» είναι ασύγκριτα φθηνότερο από το «λάθος με σιγουριά».
    const refs = [
      ref({ id: 'A', sourceHandle: 'A', basename: 'diatagma_1993.JPG', imageSizePx: { x: 690, y: 500 } }),
      ref({ id: 'B', sourceHandle: 'B', basename: 'diatagma_1994.JPG', imageSizePx: { x: 690, y: 500 } }),
    ];
    const r = await matchExternalReferences(
      refs,
      [file('scan.jpg')],
      depsWithSizes({ 'scan.jpg': { x: 690, y: 500 } }),
    );
    expect(r.matched).toEqual([]);
    expect(r.ambiguous.map((a) => a.refId).sort()).toEqual(['A', 'B']);
  });

  it('τίποτα δεν ταιριάζει ⇒ unmatched (φυσιολογική κατάσταση, όχι σφάλμα)', async () => {
    const r = await matchExternalReferences([ref()], [file('τιποτα.jpg')], NO_SIZES);
    expect(r.unmatchedRefIds).toEqual(['H1']);
    expect(r.matched).toEqual([]);
    expect(r.ambiguous).toEqual([]);
  });

  it('αναφορά ΧΩΡΙΣ imageSizePx δεν συμμετέχει στο πέρασμα 4', async () => {
    const r = await matchExternalReferences(
      [ref({ imageSizePx: undefined })],
      [file('ασχετο.jpg')],
      depsWithSizes({ 'ασχετο.jpg': { x: 690, y: 500 } }),
    );
    expect(r.unmatchedRefIds).toEqual(['H1']);
  });

  it('αρχείο που δεν αποκωδικοποιείται (π.χ. TIFF) δεν εμποδίζει τα περάσματα ονόματος', async () => {
    const r = await matchExternalReferences([ref()], [file('dianomi_1.JPG')], NO_SIZES);
    expect(r.matched[0].reason).toBe('exact-name');
  });
});

describe('matchExternalReferences — τι ΔΕΝ αγγίζει', () => {
  it('μόνο raster: xref/underlay/OLE/data link ανιχνεύονται αλλά ΔΕΝ επιλύονται', async () => {
    const nonRaster = ref({ id: 'X', kind: 'xref', basename: 'base.dwg' });
    const r = await matchExternalReferences([nonRaster], [file('base.dwg')], NO_SIZES);
    expect(r.matched).toEqual([]);
    expect(r.unmatchedRefIds).toEqual([]); // ούτε καν υποψήφια — δεν είναι στο scope
  });

  it('ήδη resolved αναφορά δεν ξαναταυτίζεται', async () => {
    const done = ref({ status: 'resolved', url: 'https://storage/x.jpg' });
    const r = await matchExternalReferences([done], [file('dianomi_1.JPG')], NO_SIZES);
    expect(r.matched).toEqual([]);
  });

  it('κενή λίστα αρχείων ⇒ όλα unmatched, μηδέν κλήση αποκωδικοποίησης', async () => {
    const pixelSizeOf = jest.fn(async () => null);
    const r = await matchExternalReferences([ref()], [], { pixelSizeOf });
    expect(r.unmatchedRefIds).toEqual(['H1']);
    expect(pixelSizeOf).not.toHaveBeenCalled();
  });
});

describe('matchExternalReferences — ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΤΟΠΟΓΡΑΦΙΚΟ (Ι. Νικολάου)', () => {
  // Οι 10 διαδρομές είναι απόλυτες στον δίσκο `Z:` του τοπογράφου· τα 9 αρχεία υπάρχουν
  // δίπλα στο `.dxf` αλλά **με εντελώς άλλα ονόματα**. Άρα ΚΑΝΕΝΑ πέρασμα ονόματος δεν
  // πιάνει τίποτα — όλη η αξία της Φ3 είναι στο πέρασμα διαστάσεων.
  //
  // 🔴 **Οι διαστάσεις είναι ΜΕΤΡΗΜΕΝΕΣ, όχι επινοημένες** (2026-07-31): τα `10`/`20` κάθε
  // `IMAGEDEF` του `47_ergasia.dxf`, και οι κεφαλίδες SOF των 9 παραδοτέων JPG. Μέχρι τότε
  // αυτό το fixture είχε **δέκα διαφορετικές** φανταστικές διαστάσεις και «αποδείκνυε» 9/10
  // χωρίς καμία ενέργεια χρήστη. Στην πραγματικότητα οι τρεις φωτογραφίες αυτοψίας είναι
  // **και οι τρεις 4000×1800** — ίδια και στο σχέδιο και στον δίσκο — άρα το πέρασμα
  // διαστάσεων βλέπει τρεις υποψηφίους για τρεις αναφορές και **σωστά** αρνείται. Το σωστό
  // αποτέλεσμα είναι 6 + 3 διφορούμενες + 1 απούσα, και η οθόνη το επιβεβαίωσε: «6 από 10».
  //
  // ⚠️ Το επινοημένο fixture δεν ήταν απλώς ανακριβές — έκρυβε **ακριβώς** τη μία δύσκολη
  // περίπτωση του δείγματος, δηλαδή το μόνο πράγμα που άξιζε να ελεγχθεί.
  const DECLARED: ReadonlyArray<[string, { x: number; y: number }]> = [
    ['1.jpg', { x: 4000, y: 1800 }],
    ['2.jpg', { x: 4000, y: 1800 }],
    ['3.jpg', { x: 4000, y: 1800 }],
    ['dianomi_1.JPG', { x: 241, y: 824 }],
    ['dianomi_2.JPG', { x: 444, y: 660 }],
    ['diatagma_1993.JPG', { x: 690, y: 612 }],
    ['diatagma_1994_47.JPG', { x: 861, y: 747 }],
    ['google_47.JPG', { x: 924, y: 575 }],
    ['gps_47.JPG', { x: 515, y: 482 }],
    ['ΣΦΡΑΓΙΔΑ ΜΑΥΡΟΜΙΧΑΛΗΣ.jpg', { x: 465, y: 296 }],
  ];
  /** Τα 9 που έδωσε ο χρήστης — μετονομασμένα σε περιγραφικά ελληνικά, όπως στην πράξη. */
  const DELIVERED = DECLARED.slice(0, 9).map(([, size], i) => ({
    name: `2026-07-20 - Παραδοτέο τοπογράφου - φύλλο ${i + 1}.JPG`,
    size,
  }));

  const refs = DECLARED.map(([basename, imageSizePx], i) =>
    ref({ id: `H${i}`, sourceHandle: `H${i}`, basename, rawPath: `Z:\\Jobs\\${basename}`, imageSizePx }),
  );

  const runOnRealSample = () =>
    matchExternalReferences(
      refs,
      DELIVERED.map((d) => file(d.name)),
      depsWithSizes(Object.fromEntries(DELIVERED.map((d) => [d.name, d.size]))),
    );

  it('βρίσκει 6 από 10 ΧΩΡΙΣ καμία ενέργεια χρήστη — όλα μέσω διαστάσεων', async () => {
    const r = await runOnRealSample();

    expect(r.matched).toHaveLength(6);
    expect(r.matched.every((m) => m.reason === 'pixel-size')).toBe(true);
    // Τα 6 μονοσήμαντα είναι ακριβώς όσα έχουν **μοναδικές** διαστάσεις στο σχέδιο.
    expect(r.matched.map((m) => m.refId).sort()).toEqual(['H3', 'H4', 'H5', 'H6', 'H7', 'H8']);
  });

  it('οι τρεις φωτογραφίες 4000×1800 γίνονται ΔΙΦΟΡΟΥΜΕΝΕΣ — καμία μαντεψιά', async () => {
    const r = await runOnRealSample();

    expect(r.ambiguous.map((a) => a.refId).sort()).toEqual(['H0', 'H1', 'H2']);
    expect(r.ambiguous.every((a) => a.reason === 'pixel-size')).toBe(true);
    // Και οι τρεις βλέπουν και τα τρία αρχεία: το «δεν ξέρω» είναι πλήρες, όχι μερικό.
    expect(r.ambiguous.every((a) => a.candidates.length === 3)).toBe(true);
  });

  it('η σφραγίδα από ΑΛΛΟ φάκελο δεν παραδόθηκε — μένει «λείπει», όχι σφάλμα', async () => {
    const r = await runOnRealSample();
    expect(r.unmatchedRefIds).toEqual(['H9']);
  });

  it('κάθε αναφορά πήρε ΤΟ ΔΙΚΟ της αρχείο — καμία διπλή ανάθεση', async () => {
    const r = await runOnRealSample();
    expect(new Set(r.matched.map((m) => m.file)).size).toBe(r.matched.length);
  });

  it('ο ΣΤΟΧΕΥΜΕΝΟΣ εντοπισμός λύνει μια διφορούμενη — ο άνθρωπος παρακάμπτει τη σκάλα', async () => {
    // Ο χρήστης δείχνει ρητά ΕΝΑ αρχείο για το `1.jpg`. Το ότι υπάρχουν άλλα δύο με τις ίδιες
    // διαστάσεις παύει να έχει σημασία: η σκάλα ταύτισης απαντά «ποιο μάλλον;», όχι «ποιο».
    const chosen = file(DELIVERED[0].name);
    const r = await matchExternalReferences(
      [refs[0]],
      [chosen],
      depsWithSizes({ [DELIVERED[0].name]: DELIVERED[0].size }),
    );
    expect(r.ambiguous).toEqual([]);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].file).toBe(chosen);
  });
});
