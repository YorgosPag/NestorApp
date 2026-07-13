/**
 * ADR-651 Φάση Γ — κορνίζα ISO 5457 + parametric reflow A4↔A0.
 *
 * Καθαρή γεωμετρία: κανένα canvas, κανένα store — μόνο αριθμοί. Καρφώνει (α) τα περιθώρια του
 * προτύπου, (β) ότι η πινακίδα κάθεται ΠΑΝΤΑ κάτω-δεξιά μέσα στην κορνίζα σε ΚΑΘΕ μέγεθος/
 * προσανατολισμό, (γ) ότι στο A4 όρθιο πιάνει όλο το πλάτος («κάτω», όπως ορίζει το ISO 5457),
 * (δ) ότι το φύλλο έρχεται από το paper SSoT (δεν ξαναγράφτηκαν διαστάσεις).
 */

import { PAPER_SIZES_MM_PORTRAIT, PAPER_SIZE_ORDER } from '../../../print/config/paper-constants';
import type { PaperOrientation, PaperSize } from '../../../print/config/paper-types';
import { buildTitleBlockLayout } from '../title-block-layout';
import type { TitleBlockContent } from '../title-block-rows';
import { computeSheetFrameMetrics, ISO_5457 } from '../sheet-frame';

const ORIENTATIONS: readonly PaperOrientation[] = ['portrait', 'landscape'];

const metricsFor = (size: PaperSize, orientation: PaperOrientation, rowCount = 10, withStampBox = false) =>
  computeSheetFrameMetrics({ paper: { size, orientation }, rowCount, withStampBox });

const CONTENT: TitleBlockContent = {
  heading: 'ΠΑΓΩΝΗΣ ΑΕ',
  rows: Array.from({ length: 8 }, (_, i) => ({ label: `Πεδίο ${i}:`, value: String(i) })),
};

describe('computeSheetFrameMetrics — διαστάσεις φύλλου (paper SSoT)', () => {
  it.each(PAPER_SIZE_ORDER)('%s: το χαρτί έρχεται από το print engine, με swap στο πλαγιαστό', (size) => {
    const portrait = metricsFor(size, 'portrait');
    const landscape = metricsFor(size, 'landscape');
    const spec = PAPER_SIZES_MM_PORTRAIT[size];

    expect(portrait.sheetWidthMm).toBe(spec.widthMm);
    expect(portrait.sheetHeightMm).toBe(spec.heightMm);
    expect(landscape.sheetWidthMm).toBe(spec.heightMm);
    expect(landscape.sheetHeightMm).toBe(spec.widthMm);
  });
});

describe('computeSheetFrameMetrics — περιθώρια ISO 5457', () => {
  it.each(PAPER_SIZE_ORDER)('%s: 20mm αρχειοθέτηση αριστερά, 10mm στις άλλες τρεις ακμές', (size) => {
    for (const orientation of ORIENTATIONS) {
      const m = metricsFor(size, orientation);
      expect(m.frame.x).toBe(ISO_5457.filingMarginMm);
      expect(m.frame.y).toBe(ISO_5457.edgeMarginMm);
      expect(m.sheetWidthMm - (m.frame.x + m.frame.w)).toBeCloseTo(ISO_5457.edgeMarginMm);
      expect(m.sheetHeightMm - (m.frame.y + m.frame.h)).toBeCloseTo(ISO_5457.edgeMarginMm);
    }
  });
});

describe('computeSheetFrameMetrics — parametric reflow της πινακίδας', () => {
  it.each(PAPER_SIZE_ORDER)('%s: η πινακίδα κάθεται κάτω-δεξιά ΜΕΣΑ στην κορνίζα', (size) => {
    for (const orientation of ORIENTATIONS) {
      const { frame, titleBlock } = metricsFor(size, orientation);
      // Δεξιά ακμή + κάτω ακμή ταυτίζονται με της κορνίζας (η θέση ΥΠΟΛΟΓΙΖΕΤΑΙ, δεν είναι σταθερά).
      expect(titleBlock.x + titleBlock.w).toBeCloseTo(frame.x + frame.w);
      expect(titleBlock.y + titleBlock.h).toBeCloseTo(frame.y + frame.h);
      // Ποτέ δεν ξεφεύγει από την κορνίζα.
      expect(titleBlock.x).toBeGreaterThanOrEqual(frame.x);
      expect(titleBlock.y).toBeGreaterThanOrEqual(frame.y);
      expect(titleBlock.w).toBeLessThanOrEqual(frame.w + 1e-9);
      expect(titleBlock.h).toBeLessThanOrEqual(frame.h + 1e-9);
    }
  });

  it('A4 όρθιο: η πινακίδα πιάνει ΟΛΟ το πλάτος της κορνίζας (180mm — «κάτω», ISO 5457)', () => {
    const { frame, titleBlock } = metricsFor('A4', 'portrait');
    expect(frame.w).toBeCloseTo(ISO_5457.titleBlockMaxWidthMm);
    expect(titleBlock.w).toBeCloseTo(ISO_5457.titleBlockMaxWidthMm);
    expect(titleBlock.x).toBeCloseTo(frame.x);
  });

  it('A0: η κορνίζα μεγαλώνει, η πινακίδα ΟΧΙ — μένει στο τυπικό πλάτος (ISO 7200)', () => {
    const a0 = metricsFor('A0', 'landscape');
    expect(a0.frame.w).toBeGreaterThan(1000);
    expect(a0.titleBlock.w).toBeCloseTo(ISO_5457.titleBlockMaxWidthMm);
  });

  it('περισσότερες γραμμές ⇒ ψηλότερη πινακίδα (το ύψος ΔΕΝ είναι σταθερά)', () => {
    const few = metricsFor('A3', 'landscape', 5);
    const many = metricsFor('A3', 'landscape', 12);
    expect(many.titleBlock.h).toBeGreaterThan(few.titleBlock.h);
  });
});

describe('computeSheetFrameMetrics — κελί σφραγίδας', () => {
  it('χωρίς σφραγίδα: όλη η πινακίδα είναι ζώνη πεδίων', () => {
    const m = metricsFor('A3', 'landscape', 10, false);
    expect(m.stamp).toBeNull();
    expect(m.fields).toEqual(m.titleBlock);
  });

  it('με σφραγίδα: το κελί κόβεται αριστερά και τα πεδία παίρνουν το υπόλοιπο (χωρίς επικάλυψη)', () => {
    const m = metricsFor('A3', 'landscape', 10, true);
    expect(m.stamp).not.toBeNull();
    expect(m.stamp!.x).toBeCloseTo(m.titleBlock.x);
    expect(m.stamp!.w + m.fields.w).toBeCloseTo(m.titleBlock.w);
    expect(m.fields.x).toBeCloseTo(m.stamp!.x + m.stamp!.w);
    expect(m.titleBlock.h).toBeGreaterThanOrEqual(ISO_5457.stampMinHeightMm);
  });
});

describe('buildTitleBlockLayout — τα δύο modes', () => {
  const layout = (withFrame: boolean, withStampBox = false) =>
    buildTitleBlockLayout(CONTENT, {
      paper: { size: 'A2', orientation: 'landscape' },
      withFrame,
      withStampBox,
      stampLabel: 'ΣΦΡΑΓΙΔΑ',
    });

  it('με κορνίζα: το μέγεθος ΕΙΝΑΙ το φύλλο και όλα τα primitives μένουν μέσα του', () => {
    const withFrame = layout(true);
    const sheet = computeSheetFrameMetrics({
      paper: { size: 'A2', orientation: 'landscape' },
      rowCount: CONTENT.rows.length,
      withStampBox: false,
    });
    expect(withFrame.sizeMm.widthMm).toBe(sheet.sheetWidthMm);
    expect(withFrame.sizeMm.heightMm).toBe(sheet.sheetHeightMm);

    for (const p of withFrame.primitives) {
      if (p.kind !== 'text') continue;
      expect(p.position.x).toBeGreaterThanOrEqual(0);
      expect(p.position.x).toBeLessThanOrEqual(sheet.sheetWidthMm);
      expect(p.position.y).toBeLessThanOrEqual(sheet.sheetHeightMm);
    }
  });

  it('χωρίς κορνίζα: το μέγεθος ΕΙΝΑΙ η πινακίδα, αγκυρωμένη στο (0,0) — συμπεριφορά Φάσης Β', () => {
    const box = layout(false);
    const sheet = computeSheetFrameMetrics({
      paper: { size: 'A2', orientation: 'landscape' },
      rowCount: CONTENT.rows.length,
      withStampBox: false,
    });
    expect(box.sizeMm.widthMm).toBeCloseTo(sheet.titleBlock.w);
    expect(box.sizeMm.heightMm).toBeCloseTo(sheet.titleBlock.h);
    // Η σκέτη πινακίδα έχει λιγότερα primitives (λείπουν ακμή χαρτιού + περίγραμμα κορνίζας).
    expect(box.primitives.length).toBeLessThan(layout(true).primitives.length);
  });

  it('η σφραγίδα προσθέτει κουτί + το κείμενό της στο σχέδιο (Απόφαση #6γ — κενό κουτί)', () => {
    const withStamp = layout(true, true);
    const texts = withStamp.primitives.filter((p) => p.kind === 'text');
    expect(texts.some((t) => t.kind === 'text' && t.text === 'ΣΦΡΑΓΙΔΑ')).toBe(true);
  });

  it('ντετερμινισμός (N.7.2): ίδιο input ⇒ ίδια γεωμετρία (ghost === commit)', () => {
    expect(layout(true, true)).toEqual(layout(true, true));
  });
});
