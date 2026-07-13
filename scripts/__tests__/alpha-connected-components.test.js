/**
 * ADR-654 M1 — alpha connected-components splitter.
 *
 * Γιατί υπάρχει: ένα TIF του pack ΔΕΝ είναι ένα έπιπλο. Το 001.tif περιέχει καναπέ +
 * δύο πολυθρόνες. Αν ο splitter σπάσει σιωπηλά (λάθος connectivity, λάθος κατώφλι),
 * το αποτέλεσμα δεν είναι crash — είναι sprites που περιέχουν «τρία έπιπλα με αέρα
 * ανάμεσα». Ο έλεγχος γίνεται εδώ, σε συνθετικό alpha, χωρίς αρχεία/sharp.
 */

const { findAlphaComponents } = require('../lib/alpha-connected-components');

/** Ζωγραφίζει γεμάτο ορθογώνιο αδιαφάνειας σε έναν κενό alpha καμβά. */
function paintRect(alpha, W, x0, y0, w, h, value = 255) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) alpha[y * W + x] = value;
  }
}

describe('findAlphaComponents', () => {
  const W = 100;
  const H = 60;

  it('δύο χωριστά νησιά → δύο components', () => {
    const alpha = new Uint8Array(W * H);
    paintRect(alpha, W, 5, 5, 20, 20);
    paintRect(alpha, W, 60, 10, 30, 30);

    const boxes = findAlphaComponents(alpha, W, H);
    expect(boxes).toHaveLength(2);
  });

  it('το bbox είναι ακριβές (inclusive άκρα)', () => {
    const alpha = new Uint8Array(W * H);
    paintRect(alpha, W, 10, 4, 20, 8);

    const [box] = findAlphaComponents(alpha, W, H);
    expect(box.x0).toBe(10);
    expect(box.y0).toBe(4);
    expect(box.x1).toBe(29); // 10 + 20 - 1
    expect(box.y1).toBe(11); // 4 + 8 - 1
    expect(box.width).toBe(20);
    expect(box.height).toBe(8);
    expect(box.area).toBe(160);
  });

  it('η σειρά είναι ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ (πάνω→κάτω, μετά αριστερά→δεξιά)', () => {
    // Τα ids των assets παράγονται από το index — τυχαία σειρά = ασταθή ids.
    const alpha = new Uint8Array(W * H);
    paintRect(alpha, W, 70, 40, 15, 15); // κάτω-δεξιά
    paintRect(alpha, W, 5, 40, 15, 15); // κάτω-αριστερά
    paintRect(alpha, W, 40, 2, 15, 15); // πάνω

    const boxes = findAlphaComponents(alpha, W, H);
    expect(boxes.map((b) => [b.x0, b.y0])).toEqual([
      [40, 2],
      [5, 40],
      [70, 40],
    ]);
  });

  it('διαγώνια εφαπτόμενα pixels ενώνονται (8-connectivity)', () => {
    const alpha = new Uint8Array(W * H);
    paintRect(alpha, W, 10, 10, 10, 10);
    paintRect(alpha, W, 20, 20, 10, 10); // ακουμπά ΜΟΝΟ στη γωνία

    expect(findAlphaComponents(alpha, W, H, { minAreaFraction: 0 })).toHaveLength(1);
  });

  it('τα ψίχουλα κάτω από το minAreaFraction απορρίπτονται', () => {
    const alpha = new Uint8Array(W * H);
    paintRect(alpha, W, 5, 5, 30, 30); // πραγματικό αντικείμενο
    paintRect(alpha, W, 90, 55, 2, 2); // θόρυβος (4px από 6000 = 0.07%)

    const boxes = findAlphaComponents(alpha, W, H);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].width).toBe(30);
  });

  it('τα ημιδιάφανα κάτω από το κατώφλι δεν μετράνε ως ύλη', () => {
    const alpha = new Uint8Array(W * H);
    paintRect(alpha, W, 10, 10, 20, 20, 8); // alpha 8 < κατώφλι 16

    expect(findAlphaComponents(alpha, W, H)).toHaveLength(0);
  });

  it('κενός καμβάς → κανένα component', () => {
    expect(findAlphaComponents(new Uint8Array(W * H), W, H)).toHaveLength(0);
  });

  it('πετά σε ασυνεπές μέγεθος buffer (αντί για σιωπηλά σκουπίδια)', () => {
    expect(() => findAlphaComponents(new Uint8Array(10), W, H)).toThrow(/alpha buffer/);
  });
});
