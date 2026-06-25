/**
 * ADR-526 Φ5a — tests για τους mappers `TekLineRecord`/`TekArcRecord` → scene entities.
 * Επικεντρώνονται στη μετατροπή μονάδων (μέτρα→mm), στο Y-flip, στο arc swap/γωνίες και
 * στην ακτίνα κύκλου. Μονάδες 'mm' ⇒ 1 m = 1000 units.
 */

import { tekLineToEntity, tekArcToEntity } from '../tek-primitive-to-scene';
import type { TekLineRecord, TekArcRecord } from '../tek-import-types';
import type { ArcEntity, CircleEntity } from '../../../types/entities';

describe('tekLineToEntity', () => {
  it('μέτρα→mm + Y-flip (Y-up → Y-down) + RGB χρώμα', () => {
    const rec: TekLineRecord = { v0x: 0, v0y: 1, v1x: 3, v1y: 0, colorBgr: '00805C' };
    const e = tekLineToEntity(rec, 'mm');
    expect(e.type).toBe('line');
    expect(e.start).toEqual({ x: 0, y: -1000 }); // Y-flipped
    expect(e.end).toEqual({ x: 3000, y: 0 });
    expect(e.color).toBe('5C8000');
    expect(e.id).toBeTruthy();
  });
});

describe('tekArcToEntity', () => {
  it('κύκλος → CircleEntity με ακτίνα = |κέντρο−p0|', () => {
    const rec: TekArcRecord = {
      isCircle: true, centreX: 0, centreY: 0, p0x: 2, p0y: 0, p1x: 0, p1y: 0, colorBgr: 'FC8000',
    };
    const e = tekArcToEntity(rec, 'mm') as CircleEntity;
    expect(e.type).toBe('circle');
    expect(e.center).toEqual({ x: 0, y: 0 });
    expect(e.radius).toBeCloseTo(2000);
    expect(e.color).toBe('0080FC');
  });

  it('τόξο → ArcEntity· αντιστροφή export swap (start=p1, end=p0) + γωνίες σε [0,360)', () => {
    // export: p0=τέλος, p1=αρχή. p0=(1,0)→0°, p1=(0,1)→ μετά Y-flip (0,-1000) → 270°.
    const rec: TekArcRecord = {
      isCircle: false, centreX: 0, centreY: 0, p0x: 1, p0y: 0, p1x: 0, p1y: 1, colorBgr: '00805C',
    };
    const e = tekArcToEntity(rec, 'mm') as ArcEntity;
    expect(e.type).toBe('arc');
    expect(e.radius).toBeCloseTo(1000);
    expect(e.startAngle).toBeCloseTo(270); // από p1 (αρχή), Y-flipped
    expect(e.endAngle).toBeCloseTo(0);     // από p0 (τέλος)
  });
});
