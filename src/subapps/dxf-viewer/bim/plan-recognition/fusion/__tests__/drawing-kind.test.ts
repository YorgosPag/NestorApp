/**
 * ⚓ ADR-929 Δ21 (0) · Δ7 Γ — «είναι η κάτοψη σκίτσο;» με την ΠΡΑΓΜΑΤΙΚΗ σύντηξη (`fusePlan`):
 *   · σκίτσο τύπου DOC014 (γραμμένα 4,12 × 2,05 m, στο χαρτί ~1:1,65 αντί 1:2,01) ⇒ `sketch` από τις διαστάσεις·
 *   · το σπίτι 6 × 4 m υπό κλίμακα ⇒ μένει `scan`, βάση «διαστάσεις»·
 *   · διανυσματική πηγή ⇒ υπό κλίμακα χωρίς να ρωτηθούν οι διαστάσεις· ο άνθρωπος νικά όλα·
 *   · ΙΣΕΣ τιμές σε απέναντι πλευρές δεν αποδεικνύουν αναλογίες.
 */

import { describe, expect, it } from '@jest/globals';
import { fusePlan } from '../plan-fusion';
import { distinctWrittenValues } from '../drawing-kind';
import type { DimensionTarget } from '../dimension-binding';
import { dimensionOf, fusionInput, houseDimensions, houseSegments, reading, segment, textAt } from './fusion-fixture';

const read = (r: ReturnType<typeof reading>) => ({ status: 'read' as const, reading: r });

/** Ορθογώνιο «σκίτσο»: πλάτος 4120 και ύψος `paperHeightMm` στο χαρτί, γραμμένα «4.12» και «2.05». */
function sketchRectangle(paperHeightMm: number, written = { w: '4.12', wMm: 4120, h: '2.05', hMm: 2050 }) {
  const segments = [
    segment('top', 0, 0, 4120, 0), segment('bottom', 0, paperHeightMm, 4120, paperHeightMm),
    segment('left', 0, 0, 0, paperHeightMm), segment('right', 4120, 0, 4120, paperHeightMm),
  ];
  const texts = [textAt('tw', written.w, 2060, paperHeightMm / 2, 'h'), textAt('th', written.h, 2060, paperHeightMm / 2 + 200, 'v')];
  const dimensions = [dimensionOf('tw', written.wMm), dimensionOf('th', written.hMm)];
  return { segments, reading: read(reading({ texts, dimensions })) };
}

describe('Δ7 Γ — το είδος σχεδίου από τις γραμμένες διαστάσεις (δύο υποθέσεις, ΜΙΑ μηχανή συναίνεσης)', () => {
  it('🔴 DOC014: 4,12 × 2,05 γραμμένα, ~1:1,65 στο χαρτί (~18 %) ⇒ σκίτσο, βάση «διαστάσεις»', () => {
    const r = fusePlan(fusionInput(sketchRectangle(2500)));
    expect(r.drawingKind).toEqual({ kind: 'sketch', basis: 'dimensions', proportions: 'not-to-scale' });
  });

  it('ΑΝΤΙΣΤΡΟΦΗ: το ίδιο ορθογώνιο ΥΠΟ κλίμακα (2050 στο χαρτί) ⇒ μένει το είδος της εικόνας', () => {
    const r = fusePlan(fusionInput(sketchRectangle(2050)));
    expect(r.drawingKind).toEqual({ kind: 'scan', basis: 'dimensions', proportions: 'to-scale' });
  });

  it('το σπίτι 6 × 4 m (5 διαστάσεις υπό κλίμακα) ⇒ υπό κλίμακα, και η συναίνεση μένει η ίδια', () => {
    const { texts, dimensions } = houseDimensions();
    const r = fusePlan(fusionInput({ segments: houseSegments(), reading: read(reading({ texts, dimensions })) }));
    expect(r.drawingKind).toEqual({ kind: 'scan', basis: 'dimensions', proportions: 'to-scale' });
    expect(r.scale?.chosen).toBe('dimension-consensus');
  });

  it('χωρίς ανάγνωση ⇒ καμία κρίση: το είδος της εικόνας, βάση «προεπιλογή»', () => {
    const r = fusePlan(fusionInput({ segments: houseSegments(), reading: null }));
    expect(r.drawingKind).toEqual({ kind: 'scan', basis: 'default', proportions: 'unproven' });
  });

  it('διανυσματική πηγή ⇒ υπό κλίμακα ΧΩΡΙΣ να ρωτηθούν οι διαστάσεις (ακόμη και παραμορφωμένες)', () => {
    const r = fusePlan(fusionInput({ ...sketchRectangle(2500), kind: 'multipage-pdf', drawing: { choice: null, medium: 'vector' } }));
    expect(r.drawingKind).toEqual({ kind: 'multipage-pdf', basis: 'vector-source', proportions: null });
  });

  it('ο άνθρωπος νικά: «σκίτσο» σε σχέδιο υπό κλίμακα · «υπό κλίμακα» σε σκίτσο', () => {
    const asSketch = fusePlan(fusionInput({ ...sketchRectangle(2050), drawing: { choice: 'sketch', medium: 'raster' } }));
    expect(asSketch.drawingKind).toEqual({ kind: 'sketch', basis: 'human', proportions: null });
    const asDrawing = fusePlan(fusionInput({ ...sketchRectangle(2500), drawing: { choice: 'drawing', medium: 'vector' } }));
    expect(asDrawing.drawingKind).toEqual({ kind: 'scan', basis: 'human', proportions: null });
  });

  it('στο σκίτσο η σύντηξη τρέχει με την ανοχή του σκίτσου ⇒ βγαίνει κλίμακα (Δ21 β(1)), αλλά από τις ΙΔΙΕΣ τιμές', () => {
    const r = fusePlan(fusionInput(sketchRectangle(2500)));
    expect(r.scale?.chosen).toBe('dimension-consensus');
  });
});

describe('Δ7 Γ — ΙΣΕΣ τιμές δεν αποδεικνύουν αναλογίες', () => {
  const target = (valueMm: number, precisionMm: number) => ({ dimension: { valueMm }, precisionMm }) as unknown as DimensionTarget;

  it('δύο «4.12» (απέναντι πλευρές) = ΜΙΑ τιμή· «4.12» + «2.05» = δύο', () => {
    expect(distinctWrittenValues([target(4120, 10), target(4120, 10)])).toBe(1);
    expect(distinctWrittenValues([target(4120, 10), target(2050, 10)])).toBe(2);
  });

  it('μέσα στην ακρίβεια γραφής της πιο χοντρής = ίδια· πέρα από αυτήν = διαφορετική', () => {
    expect(distinctWrittenValues([target(4120, 10), target(4125, 1)])).toBe(1);
    expect(distinctWrittenValues([target(4120, 10), target(4135, 1)])).toBe(2);
    expect(distinctWrittenValues([])).toBe(0);
  });

  it('🔴 σκίτσο με ΙΣΕΣ γραμμένες απέναντι πλευρές μόνο ⇒ «αναπόδεικτο», όχι ψευδώς «υπό κλίμακα»', () => {
    const segments = [segment('top', 0, 0, 4120, 0), segment('bottom', 0, 2500, 4120, 2500), segment('l', 0, 0, 0, 2500), segment('r', 4120, 0, 4120, 2500)];
    const texts = [textAt('a', '4.12', 2060, 1250, 'h'), textAt('b', '4.12', 2060, 1500, 'h')];
    const r = fusePlan(fusionInput({ segments, reading: read(reading({ texts, dimensions: [dimensionOf('a', 4120), dimensionOf('b', 4120)] })) }));
    expect(r.drawingKind.proportions).toBe('unproven');
    expect(r.drawingKind.kind).toBe('scan');
  });
});
