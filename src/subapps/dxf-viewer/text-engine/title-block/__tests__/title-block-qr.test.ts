/**
 * ADR-651 Φάση Λ — **QR ως εικόνα κελιού** στην πινακίδα (§5.11, §8 #8).
 *
 * Τα tests κλειδώνουν: (α) off by default ⇒ μηδέν αλλαγή γεωμετρίας, (β) on ⇒ ΕΝΑ raster στο
 * ΔΕΞΙΟ κελί, (γ) σφραγίδα + QR = δύο rasters σε δύο κελιά, (δ) ΟΘΟΝΗ === PDF (ίδιο layout model).
 */

import type { PaperSpec } from '../../../print/config/paper-types';
import { buildPrintSheet } from '../print-sheet';
import { computeSheetFrameMetrics } from '../sheet-frame';
import { buildTitleBlockLayout, type TitleBlockStampImage } from '../title-block-layout';
import type { TitleBlockContent } from '../title-block-rows';

const PAPER: PaperSpec = { size: 'A3', orientation: 'landscape' };

const CONTENT: TitleBlockContent = {
  heading: 'ΓΡΑΦΕΙΟ ΜΕΛΕΤΩΝ',
  rows: [
    { label: 'Έργο:', value: 'Οικία Παπαδοπούλου' },
    { label: 'Κλίμακα:', value: '1:50' },
  ],
};

/** Τετράγωνο QR (1:1) — όπως το παράγει το `qr-image-client`. */
const QR: TitleBlockStampImage = {
  src: 'data:image/png;base64,QRQRQR',
  widthPx: 512,
  heightPx: 512,
};

const BASE_OPTIONS = { paper: PAPER, withFrame: true, withStampBox: false, stampLabel: '' };

function rasterOf(primitives: readonly { kind: string }[]) {
  return primitives.filter((p) => p.kind === 'raster');
}

describe('ADR-651 Φάση Λ — το QR ως εικόνα κελιού', () => {
  it('off by default: χωρίς withQr η γεωμετρία μένει ΠΑΝΟΜΟΙΟΤΥΠΗ (μηδέν κελί/raster)', () => {
    const off = buildTitleBlockLayout(CONTENT, { ...BASE_OPTIONS });
    const withImageButOff = buildTitleBlockLayout(CONTENT, { ...BASE_OPTIONS, qrImage: QR });
    expect(rasterOf(off.primitives)).toHaveLength(0);
    // Χωρίς `withQr`, ακόμη κι αν δοθεί εικόνα, δεν σκάβεται κελί ⇒ ίδια ακριβώς primitives.
    expect(withImageButOff.primitives).toEqual(off.primitives);
  });

  it('on + εικόνα ⇒ ΕΝΑ raster ΜΕΣΑ στο ΔΕΞΙΟ κελί (καμία υπερχείλιση)', () => {
    const layout = buildTitleBlockLayout(CONTENT, { ...BASE_OPTIONS, withQr: true, qrImage: QR });
    const rasters = rasterOf(layout.primitives);
    expect(rasters).toHaveLength(1);

    const raster = rasters[0] as { rect: { x: number; y: number; w: number; h: number } };
    const metrics = computeSheetFrameMetrics({
      paper: PAPER,
      rowCount: CONTENT.rows.length,
      withStampBox: false,
      withQr: true,
    });
    const cell = metrics.qr!;
    expect(cell).not.toBeNull();
    expect(raster.rect.x).toBeGreaterThanOrEqual(cell.x);
    expect(raster.rect.x + raster.rect.w).toBeLessThanOrEqual(cell.x + cell.w + 1e-9);
    expect(raster.rect.y).toBeGreaterThanOrEqual(cell.y);
    expect(raster.rect.y + raster.rect.h).toBeLessThanOrEqual(cell.y + cell.h + 1e-9);
  });

  it('το QR κελί σκάβεται από τη ΔΕΞΙΑ ακμή (η ζώνη πεδίων στενεύει από δεξιά)', () => {
    const withoutQr = computeSheetFrameMetrics({
      paper: PAPER,
      rowCount: CONTENT.rows.length,
      withStampBox: false,
    });
    const withQr = computeSheetFrameMetrics({
      paper: PAPER,
      rowCount: CONTENT.rows.length,
      withStampBox: false,
      withQr: true,
    });
    expect(withQr.qr).not.toBeNull();
    // Το κελί είναι στη δεξιά ακμή της πινακίδας.
    expect(withQr.qr!.x + withQr.qr!.w).toBeCloseTo(withQr.titleBlock.x + withQr.titleBlock.w, 6);
    // Η ζώνη πεδίων στενεύει ακριβώς όσο το κελί QR· η αριστερή ακμή της μένει σταθερή.
    expect(withQr.fields.x).toBeCloseTo(withoutQr.fields.x, 6);
    expect(withoutQr.fields.w - withQr.fields.w).toBeCloseTo(withQr.qr!.w, 6);
  });

  it('σφραγίδα + QR ⇒ δύο rasters, ένα αριστερά (σφραγίδα) κι ένα δεξιά (QR)', () => {
    const stamp: TitleBlockStampImage = { src: 'https://x/stamp.png', widthPx: 400, heightPx: 200 };
    const layout = buildTitleBlockLayout(CONTENT, {
      paper: PAPER,
      withFrame: true,
      withStampBox: true,
      stampLabel: 'ΣΦΡΑΓΙΔΑ',
      stampImage: stamp,
      withQr: true,
      qrImage: QR,
    });
    const rasters = rasterOf(layout.primitives) as { rect: { x: number } }[];
    expect(rasters).toHaveLength(2);
    const [first, second] = [...rasters].sort((a, b) => a.rect.x - b.rect.x);
    // Η σφραγίδα (αριστερά) πριν το QR (δεξιά).
    expect(first.rect.x).toBeLessThan(second.rect.x);
  });

  it('ΟΘΟΝΗ === PDF: το τυπωμένο φύλλο φέρει το ΙΔΙΟ QR raster με το in-scene layout', () => {
    const sheet = buildPrintSheet({
      paper: PAPER,
      content: CONTENT,
      options: { withFrame: true, withStampBox: false, stampLabel: '', withQr: true, qrImage: QR },
    });
    const layout = buildTitleBlockLayout(CONTENT, {
      ...BASE_OPTIONS,
      withQr: true,
      qrImage: QR,
      origin: 'sheet',
    });
    expect(rasterOf(sheet.primitives)).toEqual(rasterOf(layout.primitives));
  });

  it('withQr χωρίς εικόνα ⇒ κενό κελί (κουτί, μηδέν raster) — ίδια σύμβαση με τη σφραγίδα', () => {
    const layout = buildTitleBlockLayout(CONTENT, { ...BASE_OPTIONS, withQr: true, qrImage: null });
    expect(rasterOf(layout.primitives)).toHaveLength(0);
    // Το κελί υπάρχει ως γεωμετρία (η ζώνη πεδίων στένεψε), αλλά χωρίς raster.
    const metrics = computeSheetFrameMetrics({
      paper: PAPER,
      rowCount: CONTENT.rows.length,
      withStampBox: false,
      withQr: true,
    });
    expect(metrics.qr).not.toBeNull();
  });
});
