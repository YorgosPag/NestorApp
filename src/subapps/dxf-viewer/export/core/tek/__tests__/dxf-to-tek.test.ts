/**
 * ADR-512 ΦΑΣΗ D — DXF primitives → Tekton `<line>`/`<arc>` (γραμμές/τόξα/κύκλοι).
 */

import { collectTekLines, collectTekArcs, collectTekObjects } from '../dxf-to-tek';
import type { Entity } from '../../../types/entities';

/** Minimal annotation-symbol entity (mirror `isAnnotationSymbolEntity`). */
function annSymbol(
  kind: string, symbolId: string, position: { x: number; y: number }, rotation = 0,
): Entity {
  return {
    id: `sym-${symbolId}`, type: 'annotation-symbol', layerId: 'lyr_a',
    kind, symbolId, position, rotation,
  } as unknown as Entity;
}

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
/** Adds ADR-608 grouping provenance to an entity (mirrors the decomposer output). */
function withGroup<T extends Entity>(e: T, groupId: string): T {
  return { ...e, groupId } as T;
}

describe('collectTekLines (γραμμές/polylines → <line>)', () => {
  it('line → ένα <line> record, coords σε μέτρα (v0/v1, Y-flipped)', () => {
    const r = collectTekLines([line({ x: 1000, y: 2000 }, { x: 3000, y: 2000 })], F);
    expect(r.lineCount).toBe(1);
    expect(r.linesXml).toContain('<type>4</type>');
    expect(r.linesXml).toContain('<v0X>1</v0X><v0Y>-2</v0Y>'); // Y-flip: 2000·F → −2
    expect(r.linesXml).toContain('<v1X>3</v1X><v1Y>-2</v1Y>');
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
    expect(r.arcsXml).toContain('<centreX>5</centreX><centreY>-5</centreY>'); // Y-flip
    expect(r.arcsXml).toContain('<p0X>7</p0X><p0Y>-5</p0Y>'); // (5000+2000, −5000)·0.001
    expect(r.arcsXml).toContain('<p1X>0</p1X><p1Y>0</p1Y>');
  });

  it('arc → <arc> <circle>0, p0/p1 = αρχή/τέλος (Y-flip + swap φοράς)', () => {
    // center (0,0), r=1000, 0°→90°. Y-flip αντιστρέφει φορά → swap: p0 = reflect(end) = (0,−1)·m·
    // p1 = reflect(start) = (1,0)·m.
    const r = collectTekArcs([arc({ x: 0, y: 0 }, 1000, 0, 90)], F);
    expect(r.arcCount).toBe(1);
    expect(r.arcsXml).toContain('<circle>0</circle>');
    expect(r.arcsXml).toContain('<p0Y>-1</p0Y>'); // reflect(end y=1000)
    expect(r.arcsXml).toContain('<p1X>1</p1X><p1Y>0</p1Y>'); // reflect(start)
  });

  it('αγνοεί non-καμπύλα (line/polyline)', () => {
    expect(collectTekArcs([line({ x: 0, y: 0 }, { x: 1, y: 1 })], F).arcCount).toBe(0);
  });
});

describe('ADR-608 — grouping tags (<taglist> + registry ονόματα)', () => {
  it('primitive με groupId → tag στο <taglist> + tag στο tags[]', () => {
    const r = collectTekLines([withGroup(line({ x: 0, y: 0 }, { x: 1000, y: 0 }), 'ann_1')], F);
    expect(r.linesXml).toContain('<taglist>\n<s>ann_1</s></taglist>');
    expect(r.tags).toEqual(['ann_1']);
  });

  it('primitive ΧΩΡΙΣ groupId → κενό <taglist>, κενό tags[]', () => {
    const r = collectTekLines([line({ x: 0, y: 0 }, { x: 1000, y: 0 })], F);
    expect(r.linesXml).toContain('<taglist>\n</taglist>');
    expect(r.linesXml).not.toContain('<s>');
    expect(r.tags).toEqual([]);
  });

  it('όλα τα segments ενός polyline μοιράζονται το ΙΔΙΟ tag (ΕΝΑ σύμβολο = μία ομάδα)', () => {
    const verts = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }];
    const r = collectTekLines([withGroup(polyline(verts, true), 'ann_2')], F);
    expect(r.lineCount).toBe(3);
    expect(r.tags).toEqual(['ann_2']); // distinct — όχι 3 φορές
    expect(r.linesXml.match(/<s>ann_2<\/s>/g)).toHaveLength(3); // ένα ανά segment
  });

  it('distinct tags: 2 σύμβολα → 2 tags (χωρίς διπλότυπα)', () => {
    const r = collectTekArcs([
      withGroup(circle({ x: 0, y: 0 }, 100), 'ann_a'),
      withGroup(arc({ x: 5, y: 5 }, 100, 0, 90), 'ann_a'),
      withGroup(circle({ x: 9, y: 9 }, 50), 'ann_b'),
    ], F);
    expect(r.tags).toEqual(['ann_a', 'ann_b']);
  });

  it('tag XML-escaped (& < >) στο <s>', () => {
    const r = collectTekLines([withGroup(line({ x: 0, y: 0 }, { x: 1, y: 0 }), 'a&<b>')], F);
    expect(r.linesXml).toContain('<s>a&amp;&lt;b&gt;</s>');
  });
});

describe('ADR-608 — collectTekObjects (native built-in σύμβολα → type-7 <object>)', () => {
  it('north-arrow → ΕΝΑ <object> type 7, type_res 51 (Βορράς 1), θέση σε μέτρα (Y-flip)', () => {
    const r = collectTekObjects([annSymbol('north-arrow', 'northArrowSimple', { x: 6000, y: 8000 })], F);
    expect(r.objectCount).toBe(1);
    expect(r.objectsXml).toContain('<type>7</type>');
    expect(r.objectsXml).toContain('<type>51</type>');       // type_res = Βορράς 1
    expect(r.objectsXml).toContain('<x20>6</x20><x21>-8</x21>'); // θέση 6m, −8m (Y-flip)
    expect(r.objectsXml).toContain('<x00>1</x00>');          // scale 1, rotation 0
    expect(r.consumedIds.has('sym-northArrowSimple')).toBe(true);
  });

  it('symbolId override: northArrowStar → 124, section → 383, elevationLevel → 123', () => {
    expect(collectTekObjects([annSymbol('north-arrow', 'northArrowStar', { x: 0, y: 0 })], F).objectsXml)
      .toContain('<type>124</type>');
    expect(collectTekObjects([annSymbol('section-mark', 'sectionMarkArrow', { x: 0, y: 0 })], F).objectsXml)
      .toContain('<type>383</type>');
    expect(collectTekObjects([annSymbol('elevation-mark', 'elevationLevel', { x: 0, y: 0 })], F).objectsXml)
      .toContain('<type>123</type>');
  });

  it('σύμβολο ΧΩΡΙΣ built-in (grid-bubble) → αγνοείται (μένει για γεωμετρία)', () => {
    const r = collectTekObjects([annSymbol('grid-bubble', 'gridBubbleCircle', { x: 0, y: 0 })], F);
    expect(r.objectCount).toBe(0);
    expect(r.consumedIds.size).toBe(0);
  });

  it('περιστροφή → xmatrix ορθογώνιο (μηδέν ρόμβος), scale-preserving', () => {
    const xml = collectTekObjects([annSymbol('north-arrow', 'northArrowSimple', { x: 0, y: 0 }, 90)], F).objectsXml;
    const m = xml.match(/<x00>([^<]*)<\/x00><x01>([^<]*)<\/x01><x10>([^<]*)<\/x10><x11>([^<]*)<\/x11>/);
    const [x00, x01, x10, x11] = [+m![1], +m![2], +m![3], +m![4]];
    expect(x00 * x10 + x01 * x11).toBeCloseTo(0); // ορθογωνιότητα
    expect(Math.hypot(x00, x01)).toBeCloseTo(1);  // μοναδιαία κλίμακα
  });

  it('non-annotation entity (line) → αγνοείται', () => {
    expect(collectTekObjects([line({ x: 0, y: 0 }, { x: 1, y: 0 })], F).objectCount).toBe(0);
  });
});
