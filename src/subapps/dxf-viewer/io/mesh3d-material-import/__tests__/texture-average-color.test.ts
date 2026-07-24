/**
 * texture-average-color — ADR-694 Φ7 test anchors.
 *
 * Τα maths ελέγχονται **χωρίς DOM**: ο καθαρός πυρήνας {@link averageColorHexOfPixels} δέχεται
 * ωμά RGBA bytes (ό,τι δίνει το `getImageData().data`) και επιστρέφει hex. Το decode
 * ({@link averageColorHexOfImage}) ελέγχεται μόνο ως προς το συμβόλαιό του (ποτέ throw).
 *
 * **ADR-694 Φ10:** οι έλεγχοι των ίδιων των συναρτήσεων μεταφοράς sRGB↔linear μετακόμισαν μαζί με
 * τον κώδικά τους στο `config/__tests__/color-math-srgb-transfer.test.ts`. Εδώ μένουν **μόνο** τα
 * anchors του καταναλωτή — δηλαδή το χρωματομετρικό συμβόλαιο του μέσου χρώματος υφής.
 */

import { averageColorHexOfPixels, averageColorHexOfImage } from '../texture-average-color';

/** `[r,g,b,a]` ανά pixel → επίπεδο RGBA buffer (όπως το `ImageData.data`). */
function pixels(...rgba: readonly (readonly [number, number, number, number])[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length * 4);
  rgba.forEach(([r, g, b, a], i) => out.set([r, g, b, a], i * 4));
  return out;
}

/** Ίδιο pixel επαναλαμβανόμενο `n` φορές (ομοιόμορφη υφή). */
function repeated(rgba: readonly [number, number, number, number], n: number): Uint8ClampedArray {
  return pixels(...Array.from({ length: n }, () => rgba));
}

describe('averageColorHexOfPixels — gamma-correct μέσος όρος (ADR-694 Φ7α)', () => {
  /**
   * Η **απόδειξη της διαφοράς**. Μισή μαύρη / μισή λευκή υφή: το μισό φως είναι linear 0.5, που
   * κωδικοποιείται sRGB σε ~188 (`#bcbcbc`). Ο παλιός (λάθος) μέσος όρος πάνω σε ωμές sRGB τιμές
   * έδινε 128 (`#808080`) — αισθητά σκουρότερο, «λασπωμένο».
   */
  it('μισή μαύρη / μισή λευκή → #bcbcbc (ΟΧΙ το sRGB-mean #808080)', () => {
    const data = pixels([0, 0, 0, 255], [255, 255, 255, 255]);

    const hex = averageColorHexOfPixels(data);

    expect(hex).toBe('#bcbcbc');
    expect(hex).not.toBe('#808080');
  });

  it('ομοιόμορφο χρώμα → επιστρέφεται ακέραιο (round-trip ταυτότητα σε όλο το εύρος)', () => {
    const samples: readonly [number, number, number][] = [
      [0, 0, 0], [1, 1, 1], [17, 17, 17], [64, 64, 64], [128, 128, 128],
      [200, 200, 200], [254, 254, 254], [255, 255, 255], [232, 147, 74],
    ];

    for (const [r, g, b] of samples) {
      const expected = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
      expect(averageColorHexOfPixels(repeated([r, g, b, 255], 9))).toBe(expected);
    }
  });

  it('πορτοκαλί υφή με λίγο λευκό → δεν «ξεπλένεται» προς το γκρι', () => {
    // 3 πορτοκαλί + 1 λευκό. Το αποτέλεσμα πρέπει να μένει ξεκάθαρα πορτοκαλί (R >> B).
    const data = pixels(
      [232, 147, 74, 255], [232, 147, 74, 255], [232, 147, 74, 255], [255, 255, 255, 255],
    );

    const hex = averageColorHexOfPixels(data);

    expect(hex).not.toBeNull();
    const [r, g, b] = [1, 3, 5].map((i) => parseInt((hex as string).slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r - b).toBeGreaterThan(80); // κορεσμένο, όχι γκριζωπό
  });
});

describe('averageColorHexOfPixels — alpha ως βάρος (ADR-694 Φ7β)', () => {
  /**
   * Ένα ημιδιαφανές μαύρο pixel (alpha 128) δίπλα σε αδιαφανές λευκό: συνεισφέρει **μισό** βάρος,
   * όχι πλήρες. Linear mean = 1/(1+0.502) = 0.6658 → sRGB 213 (`#d5d5d5`). Με το παλιό κατώφλι
   * (πλήρες βάρος για ό,τι περνά το `MIN_ALPHA`) θα έβγαινε 188 (`#bcbcbc`) — πιο σκούρο.
   */
  it('ημιδιαφανές pixel → σταθμίζεται κατά alpha, όχι με πλήρες βάρος', () => {
    const data = pixels([255, 255, 255, 255], [0, 0, 0, 128]);

    const hex = averageColorHexOfPixels(data);

    expect(hex).toBe('#d5d5d5');
    expect(hex).not.toBe('#bcbcbc'); // η τιμή πλήρους βάρους
  });

  it('υφή φύλλου: μαλακά άκρα (χαμηλό alpha) δεν σκουραίνουν το χρώμα του φύλλου', () => {
    const opaqueLeaf = averageColorHexOfPixels(repeated([60, 160, 60, 255], 4));
    const withSoftEdges = averageColorHexOfPixels(
      pixels([60, 160, 60, 255], [60, 160, 60, 255], [60, 160, 60, 255], [0, 0, 0, 20]),
    );

    expect(opaqueLeaf).toBe('#3ca03c');
    // Με πλήρες βάρος το μαύρο άκρο θα βύθιζε αισθητά το πράσινο· σταθμισμένο (0.078) σχεδόν όχι.
    const green = parseInt((withSoftEdges as string).slice(3, 5), 16);
    expect(green).toBeGreaterThan(0x94);
  });

  it('πλήρως διαφανή pixels (alpha≈0) αγνοούνται εντελώς — το RGB τους είναι σκουπίδια', () => {
    const data = pixels([255, 255, 255, 255], [255, 0, 0, 0], [0, 255, 0, 3]);

    expect(averageColorHexOfPixels(data)).toBe('#ffffff');
  });

  it('ολικά διάφανη εικόνα → null (τίποτα να μετρηθεί)', () => {
    expect(averageColorHexOfPixels(repeated([120, 30, 200, 0], 16))).toBeNull();
  });

  it('κενό buffer → null', () => {
    expect(averageColorHexOfPixels(new Uint8ClampedArray(0))).toBeNull();
  });
});

describe('averageColorHexOfImage — συμβόλαιο ακέραιο (ADR-694 Φ7γ)', () => {
  it('περιβάλλον χωρίς OffscreenCanvas/createImageBitmap → null, ποτέ throw', async () => {
    await expect(averageColorHexOfImage(new Blob([new Uint8Array([1, 2, 3])]))).resolves.toBeNull();
  });

  it('κατεστραμμένα bytes → null, ποτέ throw', async () => {
    await expect(averageColorHexOfImage(new Blob([new Uint8Array(0)]))).resolves.toBeNull();
  });
});
