/**
 * @jest-environment node
 *
 * ⚓ ADR-929 §6.16 βήμα 4 — η εγγενής ανάλυση μιας σαρωμένης σελίδας από το operator list του pdf.js.
 * Η σελίδα της Παλαιολόγου: 2592 × 2770,56 pt, σάρωση 7200 × 7696 px ⇒ 2,777… px/pt (200 dpi).
 */

import { nativeImageScale, SCANNED_PAGE_MIN_COVERAGE, type PdfImageOps, type PdfOperatorListLike } from '../pdf-native-resolution';

const OPS: PdfImageOps = {
  save: 10, restore: 11, transform: 12, paintFormXObjectBegin: 74, paintFormXObjectEnd: 75,
  beginGroup: 76, endGroup: 77, paintImageXObject: 85, paintInlineImageXObject: 86, paintImageMaskXObject: 83,
};

const W = 2592;
const H = 2770.56;
const AREA = W * H;
const SCAN = 7200 / W;

type Op = readonly [number, unknown];
const list = (...ops: Op[]): PdfOperatorListLike => ({ fnArray: ops.map((o) => o[0]), argsArray: ops.map((o) => o[1]) });

const save: Op = [OPS.save, null];
const restore: Op = [OPS.restore, null];
const cm = (a: number, b: number, c: number, d: number, e = 0, f = 0): Op => [OPS.transform, [a, b, c, d, e, f]];
const image = (w: number, h: number): Op => [OPS.paintImageXObject, ['img_p0_1', w, h]];

describe('nativeImageScale', () => {
  it('σάρωση σε όλη τη σελίδα ⇒ px της σάρωσης ανά pt', () => {
    expect(nativeImageScale(list(save, cm(W, 0, 0, H), image(7200, 7696), restore), OPS, AREA)).toBeCloseTo(SCAN, 6);
  });

  it('στραμμένη κατά 90° (όπως με /Rotate ή πίνακα στροφής) ⇒ ίδια ανάλυση', () => {
    expect(nativeImageScale(list(save, cm(0, W, -H, 0, H, 0), image(7200, 7696), restore), OPS, AREA)).toBeCloseTo(SCAN, 6);
  });

  it('μέσα σε Form XObject με δικό του πίνακα· ο πίνακας της ομάδας διαφάνειας ΔΕΝ μετρά δεύτερη φορά', () => {
    const form: Op = [OPS.paintFormXObjectBegin, [[0.5, 0, 0, 0.5, 0, 0], [0, 0, 2 * W, 2 * H]]];
    const group: Op = [OPS.beginGroup, [{ matrix: [0.5, 0, 0, 0.5, 0, 0] }]];
    const ops = list(group, form, save, cm(2 * W, 0, 0, 2 * H), image(7200, 7696), restore,
      [OPS.paintFormXObjectEnd, null], [OPS.endGroup, null]);
    expect(nativeImageScale(ops, OPS, AREA)).toBeCloseTo(SCAN, 6);
  });

  it('το restore επαναφέρει τον πίνακα: μετασχηματισμός μέσα σε save δεν διαρρέει', () => {
    const ops = list(save, cm(10, 0, 0, 10), restore, save, cm(W, 0, 0, H), image(7200, 7696), restore);
    expect(nativeImageScale(ops, OPS, AREA)).toBeCloseTo(SCAN, 6);
  });

  it('σάρωση κομμένη σε λωρίδες ίδιας ανάλυσης ⇒ αθροίζεται η κάλυψη', () => {
    const half = (y: number): Op[] => [save, cm(W, 0, 0, H / 2, 0, y), image(7200, 3848), restore];
    expect(nativeImageScale(list(...half(0), ...half(H / 2)), OPS, AREA)).toBeCloseTo(SCAN, 6);
  });

  it('μάσκα εικόνας (CCITT ως /ImageMask) ⇒ διαστάσεις από το αντικείμενο', () => {
    const mask: Op = [OPS.paintImageMaskXObject, [{ data: null, width: 7200, height: 7696 }]];
    expect(nativeImageScale(list(save, cm(W, 0, 0, H), mask, restore), OPS, AREA)).toBeCloseTo(SCAN, 6);
  });

  it(`διανυσματική σελίδα με μικρό λογότυπο (< ${SCANNED_PAGE_MIN_COVERAGE * 100}%) ⇒ null`, () => {
    expect(nativeImageScale(list(save, cm(W / 4, 0, 0, H / 4), image(2000, 2000), restore), OPS, AREA)).toBeNull();
    expect(nativeImageScale(list(), OPS, AREA)).toBeNull();
  });

  it('δύο αναλύσεις ⇒ κερδίζει η ομάδα με τη μεγαλύτερη κάλυψη', () => {
    const background = [save, cm(W, 0, 0, H), image(W, Math.round(H)), restore];
    const inset = [save, cm(W / 2, 0, 0, H / 2), image(3600, 3848), restore];
    expect(nativeImageScale(list(...inset, ...background), OPS, AREA)).toBeCloseTo(1, 3);
  });

  it('ορίσματα που δεν διαβάζονται / εκφυλισμένος πίνακας / μηδενική σελίδα ⇒ αγνοούνται, χωρίς εξαίρεση', () => {
    expect(nativeImageScale(list(save, cm(W, 0, 0, H), [OPS.paintImageXObject, ['img']], restore), OPS, AREA)).toBeNull();
    expect(nativeImageScale(list(save, cm(0, 0, 0, 0), image(7200, 7696), restore), OPS, AREA)).toBeNull();
    expect(nativeImageScale(list(save, cm(W, 0, 0, H), image(7200, 7696), restore), OPS, 0)).toBeNull();
  });
});
