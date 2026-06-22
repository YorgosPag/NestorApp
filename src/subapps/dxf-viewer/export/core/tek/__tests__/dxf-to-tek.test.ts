/**
 * ADR-512 ΦΑΣΗ D — DXF primitives → Tekton `<line>`/`<arc>` (γραμμές/τόξα/κύκλοι).
 */

import { collectTekLines, collectTekArcs } from '../dxf-to-tek';
import type { Entity } from '../../../types/entities';

/** mm → μέτρα (ίδιο με sceneUnitsToMeters('mm')). */
const F = 0.001;

function line(start: { x: number; y: number }, end: { x: number; y: number }, color?: string): Entity {
  return { id: 'l1', type: 'line', start, end, ...(color ? { color } : {}) } as unknown as Entity;
}
function polyline(vertices: Array<{ x: number; y: number }>, closed = false): Entity {
  return { id: 'p1', type: 'polyline', vertices, closed } as unknown as Entity;
}
function circle(center: { x: number; y: number }, radius: number): Entity {
  return { id: 'c1', type: 'circle', center, radius } as unknown as Entity;
}
function arc(
  center: { x: number; y: number }, radius: number, startAngle: number, endAngle: number,
): Entity {
  return { id: 'a1', type: 'arc', center, radius, startAngle, endAngle } as unknown as Entity;
}

describe('collectTekLines (γραμμές/polylines → <line>)', () => {
  it('line → ένα <line> record, coords σε μέτρα (v0/v1)', () => {
    const r = collectTekLines([line({ x: 1000, y: 2000 }, { x: 3000, y: 2000 })], F);
    expect(r.lineCount).toBe(1);
    expect(r.linesXml).toContain('<type>4</type>');
    expect(r.linesXml).toContain('<v0X>1</v0X><v0Y>2</v0Y>');
    expect(r.linesXml).toContain('<v1X>3</v1X><v1Y>2</v1Y>');
    expect(r.linesXml).toContain('<elevation0>0</elevation0>');
  });

  it('χρώμα entity → <color> (αλλιώς default FC8000)', () => {
    expect(collectTekLines([line({ x: 0, y: 0 }, { x: 1, y: 0 }, '#FF8040')], F).linesXml)
      .toContain('<color>FF8040</color>');
    expect(collectTekLines([line({ x: 0, y: 0 }, { x: 1, y: 0 })], F).linesXml)
      .toContain('<color>FC8000</color>');
  });

  it('open polyline (3 κορυφές) → 2 segments· closed → +1 (κλείσιμο)', () => {
    const verts = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }];
    expect(collectTekLines([polyline(verts, false)], F).lineCount).toBe(2);
    expect(collectTekLines([polyline(verts, true)], F).lineCount).toBe(3);
  });

  it('τμήμα μηδενικού μήκους → παραλείπεται', () => {
    expect(collectTekLines([line({ x: 5, y: 5 }, { x: 5, y: 5 })], F).lineCount).toBe(0);
  });

  it('αγνοεί non-γραμμικά (circle/arc/wall)', () => {
    expect(collectTekLines([circle({ x: 0, y: 0 }, 100)], F).lineCount).toBe(0);
  });
});

describe('collectTekArcs (κύκλοι/τόξα → <arc>)', () => {
  it('circle → <arc> <circle>1, p0 = σημείο περιφέρειας (radius), p1 = 0', () => {
    const r = collectTekArcs([circle({ x: 5000, y: 5000 }, 2000)], F);
    expect(r.arcCount).toBe(1);
    expect(r.arcsXml).toContain('<type>5</type>');
    expect(r.arcsXml).toContain('<circle>1</circle>');
    expect(r.arcsXml).toContain('<centreX>5</centreX><centreY>5</centreY>');
    expect(r.arcsXml).toContain('<p0X>7</p0X><p0Y>5</p0Y>'); // (5000+2000, 5000)·0.001
    expect(r.arcsXml).toContain('<p1X>0</p1X><p1Y>0</p1Y>');
  });

  it('arc → <arc> <circle>0, p0/p1 = αρχή/τέλος από startAngle/endAngle (μοίρες)', () => {
    // center (0,0), r=1000, 0°→90°: p0 = (1000,0)·F = (1,0)· p1 = (0,1000)·F = (0,1).
    const r = collectTekArcs([arc({ x: 0, y: 0 }, 1000, 0, 90)], F);
    expect(r.arcCount).toBe(1);
    expect(r.arcsXml).toContain('<circle>0</circle>');
    expect(r.arcsXml).toContain('<p0X>1</p0X><p0Y>0</p0Y>');
    expect(r.arcsXml).toContain('<p1Y>1</p1Y>');
  });

  it('αγνοεί non-καμπύλα (line/polyline)', () => {
    expect(collectTekArcs([line({ x: 0, y: 0 }, { x: 1, y: 1 })], F).arcCount).toBe(0);
  });
});
