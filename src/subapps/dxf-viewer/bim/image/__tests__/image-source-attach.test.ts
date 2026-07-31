/**
 * ADR-736 §6 — έλεγχοι του pure «νέα raster πηγή σε εικόνα».
 *
 * Ο κεντρικός έλεγχος δεν είναι αριθμητικός: είναι ότι η **γεωμετρία δεν αγγίζεται ποτέ** από
 * αντικατάσταση. Σε γεωαναφερμένο υπόβαθρο μια σιωπηλή αλλαγή θέσης/μεγέθους μετακινεί το
 * σχέδιο σε λάθος σημείο του κόσμου — σφάλμα που δεν φαίνεται στην οθόνη ως σφάλμα.
 */

import {
  imagePlacementSize,
  buildImageSourceSwapPatch,
  pixelAspect,
  IMAGE_PLACEMENT_VIEWPORT_FRACTION,
} from '../image-source-attach';

/** Οι πραγματικές διαστάσεις των φωτογραφιών αυτοψίας του δείγματος (ADR-736 §1). */
const REAL_PHOTO = { x: 4000, y: 1800 } as const;

describe('imagePlacementSize — πόσο μεγάλη μπαίνει μια νέα εικόνα', () => {
  it('παίρνει το συμφωνημένο κλάσμα του ΟΡΑΤΟΥ πλάτους, με πιστό λόγο πλευρών', () => {
    const size = imagePlacementSize(REAL_PHOTO, 90);
    expect(size).not.toBeNull();
    expect(size!.width).toBeCloseTo(90 * IMAGE_PLACEMENT_VIEWPORT_FRACTION);
    expect(size!.width / size!.height).toBeCloseTo(4000 / 1800);
  });

  it('🔴 ΔΕΝ κλιμακώνεται με τα pixel — μια 4000×1800 δεν γίνεται 4000 μονάδες πλάτος', () => {
    // Το «1 pixel = 1 μονάδα» του AutoCAD θα έδινε 4000 σε σχέδιο μέτρων = 4 χιλιόμετρα.
    const size = imagePlacementSize(REAL_PHOTO, 90);
    expect(size!.width).toBeLessThan(100);
  });

  it('άγνωστος λόγος πλευρών → τετράγωνο (η εντολή ΔΕΝ αποτυγχάνει)', () => {
    const size = imagePlacementSize(null, 60);
    expect(size).toEqual({ width: 20, height: 20 });
  });

  it('άχρηστο ορατό πλάτος → null (ποτέ εικόνα μηδενικού/άπειρου μεγέθους στη σκηνή)', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(imagePlacementSize(REAL_PHOTO, bad)).toBeNull();
    }
  });
});

describe('pixelAspect — το «δεν ξέρω» δεν γίνεται ποτέ αριθμός', () => {
  it('επιστρέφει null για κάθε μη-αποκωδικοποιήσιμη είσοδο', () => {
    for (const bad of [null, undefined, { x: 0, y: 10 }, { x: 10, y: 0 }, { x: Number.NaN, y: 1 }]) {
      expect(pixelAspect(bad as never)).toBeNull();
    }
  });
});

describe('🔴 buildImageSourceSwapPatch — Η ΓΕΩΜΕΤΡΙΑ ΜΕΝΕΙ', () => {
  const IMAGE = {
    url: 'https://old.invalid/a.jpg',
    width: 35,
    height: 32.757,
    sourceName: '1.jpg',
  } as const;

  it('το patch δεν περιέχει ΚΑΝΕΝΑ γεωμετρικό πεδίο', () => {
    const patch = buildImageSourceSwapPatch(IMAGE, {
      url: 'https://new.invalid/b.jpg',
      pixelSize: REAL_PHOTO,
      sourceName: 'b.jpg',
    });
    expect(patch).not.toBeNull();
    for (const geometric of ['position', 'width', 'height', 'rotation']) {
      expect(geometric in patch!).toBe(false);
    }
  });

  it('γράφει url + όνομα, και προσαρμόζει το εργοστασιακό μέγεθος στον ΝΕΟ λόγο πλευρών', () => {
    const patch = buildImageSourceSwapPatch(IMAGE, {
      url: 'https://new.invalid/b.jpg',
      pixelSize: REAL_PHOTO,
      sourceName: 'b.jpg',
    })!;
    expect(patch.url).toBe('https://new.invalid/b.jpg');
    expect(patch.sourceName).toBe('b.jpg');
    // Κρατά το τρέχον πλάτος (η κλίμακα του χρήστη επιβιώνει), διορθώνει μόνο την αναλογία.
    expect(patch.intrinsicWidth).toBe(35);
    expect(patch.intrinsicWidth! / patch.intrinsicHeight!).toBeCloseTo(4000 / 1800);
  });

  it('🔴 άγνωστος λόγος πλευρών → τα intrinsic ΔΕΝ αγγίζονται (καμία επινοημένη τιμή)', () => {
    const patch = buildImageSourceSwapPatch(IMAGE, {
      url: 'https://new.invalid/b.jpg',
      pixelSize: null,
    })!;
    expect(patch.url).toBe('https://new.invalid/b.jpg');
    expect('intrinsicWidth' in patch).toBe(false);
    expect('intrinsicHeight' in patch).toBe(false);
  });

  it('idempotent — ίδιο url/όνομα χωρίς νέο μέγεθος ⇒ null (κανένα κενό βήμα αναίρεσης)', () => {
    expect(
      buildImageSourceSwapPatch(IMAGE, { url: IMAGE.url, sourceName: IMAGE.sourceName }),
    ).toBeNull();
  });
});
