/**
 * ADR-526 Φ5a — tests για τους mappers `TekLineRecord`/`TekArcRecord` → scene entities.
 * Επικεντρώνονται στη μετατροπή μονάδων (μέτρα→mm), στο Y-flip, στο arc swap/γωνίες και
 * στην ακτίνα κύκλου. Μονάδες 'mm' ⇒ 1 m = 1000 units.
 */

import { tekLineToEntity, tekArcToEntity, tekTextToEntity } from '../tek-primitive-to-scene';
import type { TekLineRecord, TekArcRecord, TekTextRecord } from '../tek-import-types';
import type { ArcEntity, CircleEntity } from '../../../types/entities';

const IDENTITY = { x00: 1, x01: 0, x10: 0, x11: 1, x20: 0, x21: 0 };

describe('tekLineToEntity', () => {
  it('μέτρα→mm + Y-flip (Y-up → Y-down) + RGB χρώμα με # (straight, ΟΧΙ BGR)', () => {
    const rec: TekLineRecord = { v0x: 0, v0y: 1, v1x: 3, v1y: 0, color: '00805C' };
    const e = tekLineToEntity(rec, 'mm');
    expect(e.type).toBe('line');
    expect(e.start).toEqual({ x: 0, y: -1000 }); // Y-flipped
    expect(e.end).toEqual({ x: 3000, y: 0 });
    expect(e.color).toBe('#00805C'); // RGB αυτούσιο + # (όχι BGR swap)
    expect(e.id).toBeTruthy();
  });
});

describe('tekArcToEntity', () => {
  it('κύκλος → CircleEntity με ακτίνα = |κέντρο−p0|', () => {
    const rec: TekArcRecord = {
      isCircle: true, centreX: 0, centreY: 0, p0x: 2, p0y: 0, p1x: 0, p1y: 0, color: 'FC8000',
    };
    const e = tekArcToEntity(rec, 'mm') as CircleEntity;
    expect(e.type).toBe('circle');
    expect(e.center).toEqual({ x: 0, y: 0 });
    expect(e.radius).toBeCloseTo(2000);
    expect(e.color).toBe('#FC8000');
  });

  it('τόξο → ArcEntity· αντιστροφή export swap (start=p1, end=p0) + γωνίες σε [0,360)', () => {
    // export: p0=τέλος, p1=αρχή. p0=(1,0)→0°, p1=(0,1)→ μετά Y-flip (0,-1000) → 270°.
    const rec: TekArcRecord = {
      isCircle: false, centreX: 0, centreY: 0, p0x: 1, p0y: 0, p1x: 0, p1y: 1, color: '00805C',
    };
    const e = tekArcToEntity(rec, 'mm') as ArcEntity;
    expect(e.type).toBe('arc');
    expect(e.radius).toBeCloseTo(1000);
    expect(e.startAngle).toBeCloseTo(270); // από p1 (αρχή), Y-flipped
    expect(e.endAngle).toBeCloseTo(0);     // από p0 (τέλος)
  });
});

describe('tekTextToEntity', () => {
  it('inline content + θέση (Y-flip) + alignment + χρώμα με #', () => {
    const rec: TekTextRecord = {
      content: 'ΚΟΥΖΙΝΑ', color: 'FC9C80', hAlign: 1, fontFamily: 'Arial',
      matrix: { ...IDENTITY, x20: 2, x21: 3 },
    };
    const e = tekTextToEntity(rec, 'mm');
    expect(e.type).toBe('text');
    expect(e.text).toBe('ΚΟΥΖΙΝΑ');
    expect(e.position).toEqual({ x: 2000, y: -3000 }); // Y-flipped
    expect(e.alignment).toBe('center');
    expect(e.color).toBe('#FC9C80');
    expect(e.rotation).toBe(0);
    expect(e.fontFamily).toBe('Arial');
  });

  it('ύψος: baked-scale mode (μικρό scale → ×em) δίνει αναγνώσιμο μέγεθος', () => {
    const rec: TekTextRecord = {
      content: '1', color: 'FC9C80', hAlign: 0, fontFamily: 'Arial',
      matrix: { x00: 0.006285714, x01: 0, x10: 0, x11: 0.006285714, x20: 0, x21: 0 },
    };
    const e = tekTextToEntity(rec, 'mm');
    // 0.006285714 m × 40 em ≈ 0.2514 m → 251.4 mm (αναγνώσιμη ετικέτα, ΟΧΙ 6mm)
    expect(e.height).toBeCloseTo(251.4, 0);
  });
});
