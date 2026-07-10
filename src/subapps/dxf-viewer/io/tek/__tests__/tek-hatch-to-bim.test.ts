/**
 * ADR-531 Φ5b.6 — tests για τον BIM mapper `TekHatchRecord` → `HatchEntity` (γραμμοσκίαση).
 * Δεδομένα ορίου από το πραγματικό δείγμα `ΓΡΑΜΜΟΣΚΙΑΣΗ.tek` (solid fill, pattern 22, C0DCC0).
 */

import { tekHatchToEntity } from '../tek-hatch-to-bim';
import type { TekHatchRecord } from '../tek-import-types';

// Το L-shaped όριο του δείγματος (τα v0 κάθε <vector> segment, μέτρα Y-up).
const SOLID_HATCH: TekHatchRecord = {
  boundary: [
    { x: 4.75, y: 10.3 }, { x: 11, y: 10.3 }, { x: 11, y: 14.35 },
    { x: 5.75, y: 14.35 }, { x: 3.35, y: 14.35 }, { x: 3.35, y: 10.45 }, { x: 4.75, y: 10.45 },
  ],
  patternNum: 22, // TEKTON_SOLID_HATCH_NUM
  scaleX: 0.15,
  rotationDeg: 0,
  color: 'C0DCC0',
  bgColor: 'FFFFFF',
};

// Συνθετικό predefined (ANSI31 = tek 72) πάνω σε τετράγωνο όριο.
const PATTERN_HATCH: TekHatchRecord = {
  boundary: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }],
  patternNum: 72,
  scaleX: 0.5,
  rotationDeg: 30,
  color: 'FF0000',
  bgColor: 'FFFFFF',
};

describe('tekHatchToEntity (ADR-531 Φ5b.6)', () => {
  it('pattern 22 (tek solid-raster): user-defined ΓΡΑΜΜΕΣ 45° (ΟΧΙ solid) + χρώμα + Y-flip', () => {
    const { hatch, warnings } = tekHatchToEntity(SOLID_HATCH, undefined, 'mm');
    expect(hatch).not.toBeNull();
    expect(hatch?.type).toBe('hatch');
    // Ο Τέκτων ζωγραφίζει το 22 ως διαγώνιες γραμμές (πράσινο + λευκά κενά), ΟΧΙ συμπαγές.
    expect(hatch?.fillType).toBe('user-defined');
    expect(hatch?.lineAngle).toBe(45);
    expect(hatch?.lineSpacing).toBeCloseTo(150, 0); // scaleX 0.15m → 150mm
    expect(hatch?.fillColor).toBe('#C0DCC0');
    expect(hatch?.backgroundColor).toBe('#FFFFFF'); // λευκό φόντο πίσω από τις γραμμές
    expect(hatch?.boundaryPaths[0]).toHaveLength(7);
    // Y-flip: 4.75m→4750, 10.3m Y-up → −10300 canvas Y-down.
    expect(hatch?.boundaryPaths[0][0].x).toBeCloseTo(4750, 0);
    expect(hatch?.boundaryPaths[0][0].y).toBeCloseTo(-10300, 0);
    expect(warnings).toHaveLength(0);
  });

  it('predefined pattern (tek 72 → ANSI31): fillType predefined + κλίμακα/γωνία', () => {
    const { hatch } = tekHatchToEntity(PATTERN_HATCH, undefined, 'mm');
    expect(hatch?.fillType).toBe('predefined');
    expect(hatch?.patternName).toBe('ANSI31');
    expect(hatch?.patternScale).toBeCloseTo(0.5, 3);
    expect(hatch?.patternAngle).toBeCloseTo(30, 3);
    expect(hatch?.fillColor).toBe('#FF0000');
  });

  it('όριο <3 κορυφές → null + warning', () => {
    const { hatch, warnings } = tekHatchToEntity(
      { ...SOLID_HATCH, boundary: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      undefined,
      'mm',
    );
    expect(hatch).toBeNull();
    expect(warnings).toHaveLength(1);
  });
});
