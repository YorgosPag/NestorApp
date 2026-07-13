/**
 * ADR-651 Φάση ΣΤ — το ΤΥΠΩΜΕΝΟ φύλλο.
 *
 * Το ζητούμενο του Giorgio: «ό,τι βλέπει ο χρήστης στην οθόνη να τυπώνεται ίδιο». Άρα τα
 * tests κλειδώνουν ακριβώς αυτό: (α) το PDF παίρνει την ΙΔΙΑ γεωμετρία με το in-scene block
 * (ένα layout model), (β) το σχέδιο ΔΕΝ τυπώνεται ποτέ κάτω από την πινακίδα, (γ) το φύλλο
 * είναι παραμετρικό (A4 όρθιο … A0 πλαγιαστό) χωρίς καμία ειδική περίπτωση.
 */

import { buildPrintSheet } from '../print-sheet';
import { computeSheetFrameMetrics, ISO_5457 } from '../sheet-frame';
import { buildTitleBlockLayout } from '../title-block-layout';
import type { TitleBlockContent } from '../title-block-rows';
import type { PaperSpec } from '../../../print/config/paper-types';

const CONTENT: TitleBlockContent = {
  heading: 'ΓΡΑΦΕΙΟ ΜΕΛΕΤΩΝ',
  rows: [
    { label: 'Έργο:', value: 'Οικία Παπαδοπούλου' },
    { label: 'Θέση:', value: 'Λάρισα' },
    { label: 'Εργοδότης:', value: 'Γ. Παπαδόπουλος' },
    { label: 'Κλίμακα:', value: '1:50' },
  ],
};

const OPTIONS = { withFrame: true, withStampBox: false, stampLabel: '' };

function sheet(paper: PaperSpec, overrides: Partial<typeof OPTIONS> = {}) {
  return buildPrintSheet({ paper, content: CONTENT, options: { ...OPTIONS, ...overrides } });
}

describe('buildPrintSheet — μία μηχανή πινακίδας (οθόνη === PDF)', () => {
  it('παράγει ΤΗΝ ΙΔΙΑ γεωμετρία με το layout model της οθόνης (sheet origin)', () => {
    const paper: PaperSpec = { size: 'A3', orientation: 'landscape' };
    const onScreen = buildTitleBlockLayout(CONTENT, { ...OPTIONS, paper, origin: 'sheet' });
    expect(sheet(paper).primitives).toEqual(onScreen.primitives);
  });

  it('χωρίς κορνίζα, η πινακίδα μένει στη θέση του ΠΡΟΤΥΠΟΥ (κάτω-δεξιά), όχι στο (0,0)', () => {
    const paper: PaperSpec = { size: 'A3', orientation: 'landscape' };
    const { titleBlock } = computeSheetFrameMetrics({ paper, rowCount: CONTENT.rows.length, withStampBox: false });
    const primitives = sheet(paper, { withFrame: false }).primitives;
    const xs = primitives.flatMap((p) =>
      p.kind === 'polyline' ? p.points.map((pt) => pt.x) : [],
    );
    expect(Math.min(...xs)).toBeCloseTo(titleBlock.x, 6);
  });
});

describe('buildPrintSheet — πού μπαίνει το σχέδιο', () => {
  it('η περιοχή σχεδίου ζει μέσα στην κορνίζα ISO 5457 (περιθώριο αρχειοθέτησης αριστερά)', () => {
    const area = sheet({ size: 'A3', orientation: 'landscape' }).drawingAreaMm;
    expect(area.xMm).toBe(ISO_5457.filingMarginMm);
    expect(area.yMm).toBe(ISO_5457.edgeMarginMm);
  });

  it('το σχέδιο ΔΕΝ επικαλύπτει ποτέ την πινακίδα (Γ-σχήμα: δίπλα Ή πάνω)', () => {
    for (const paper of [
      { size: 'A4', orientation: 'portrait' },
      { size: 'A3', orientation: 'landscape' },
      { size: 'A0', orientation: 'landscape' },
    ] as const) {
      const { titleBlock } = computeSheetFrameMetrics({
        paper,
        rowCount: CONTENT.rows.length,
        withStampBox: false,
      });
      const area = sheet(paper).drawingAreaMm;
      const overlapsX = area.xMm + area.widthMm > titleBlock.x;
      const overlapsY = area.yMm + area.heightMm > titleBlock.y;
      expect(overlapsX && overlapsY).toBe(false);
    }
  });

  it('A4 όρθιο: η πινακίδα πιάνει όλο το πλάτος ⇒ το σχέδιο πάει ΠΑΝΩ της (πλήρες πλάτος)', () => {
    const paper: PaperSpec = { size: 'A4', orientation: 'portrait' };
    const { frame, titleBlock } = computeSheetFrameMetrics({
      paper,
      rowCount: CONTENT.rows.length,
      withStampBox: false,
    });
    const area = sheet(paper).drawingAreaMm;
    expect(area.widthMm).toBeCloseTo(frame.w, 6);
    expect(area.heightMm).toBeCloseTo(frame.h - titleBlock.h, 6);
  });

  it('A0 πλαγιαστό: το σχέδιο παίρνει το ΜΕΓΑΛΥΤΕΡΟ ωφέλιμο ορθογώνιο (max εμβαδόν)', () => {
    const paper: PaperSpec = { size: 'A0', orientation: 'landscape' };
    const { frame, titleBlock } = computeSheetFrameMetrics({
      paper,
      rowCount: CONTENT.rows.length,
      withStampBox: false,
    });
    const area = sheet(paper).drawingAreaMm;
    const beside = (frame.w - titleBlock.w) * frame.h;
    const above = frame.w * (frame.h - titleBlock.h);
    // Πινακίδα φαρδιά & χαμηλή (180 × ~30mm) ⇒ «πάνω» χάνει λιγότερο χαρτί από «δίπλα» —
    // ακριβώς η εικόνα του τυπικού ελληνικού φύλλου (σχέδιο πάνω, πινακίδα κάτω-δεξιά).
    expect(above).toBeGreaterThan(beside);
    expect(area.widthMm * area.heightMm).toBeCloseTo(Math.max(above, beside), 6);
  });

  it('το κελί σφραγίδας («Άδεια δόμησης») κρατά ελάχιστο ύψος ⇒ μικρότερη περιοχή σχεδίου', () => {
    // Λίγες γραμμές ⇒ το φυσικό ύψος της πινακίδας είναι κάτω από το ελάχιστο της σφραγίδας
    // (πρέπει να χωράει σφραγίδα/υπογραφή μηχανικού) — άρα η πινακίδα ψηλώνει και το σχέδιο
    // παίρνει λιγότερο χαρτί. Με πολλές γραμμές το φυσικό ύψος ήδη υπερβαίνει το ελάχιστο.
    const paper: PaperSpec = { size: 'A3', orientation: 'landscape' };
    const short: TitleBlockContent = {
      heading: '',
      rows: [{ label: 'Έργο:', value: 'Χ' }, { label: 'Κλίμακα:', value: '1:50' }],
    };
    const plain = buildPrintSheet({ paper, content: short, options: OPTIONS }).drawingAreaMm;
    const stamped = buildPrintSheet({
      paper,
      content: short,
      options: { ...OPTIONS, withStampBox: true, stampLabel: 'ΣΦΡΑΓΙΔΑ' },
    }).drawingAreaMm;
    expect(stamped.heightMm).toBeLessThan(plain.heightMm);
    expect(stamped.widthMm).toBe(plain.widthMm);
  });

  it('ντετερμινισμός: ίδιο input ⇒ ίδιο output (ghost === commit === PDF)', () => {
    const paper: PaperSpec = { size: 'A2', orientation: 'portrait' };
    expect(sheet(paper)).toEqual(sheet(paper));
  });
});
