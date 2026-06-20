/**
 * ADR-505 §C — `solid-fill-geometry` SSoT (footprint + ύψος → 3D faces).
 *
 * Επαληθεύει: τετράγωνο πρίσμα → 2 καπάκια (2 τρίγωνα έκαστο) + 4 πλευρές = 8 faces·
 * z τιμές (base/top σε mm)· flat (height 0) → μόνο κάτω καπάκι· degenerate → []·
 * κλειστό ring (διπλή τελευταία κορυφή) → καθαρίζεται.
 */

import { buildPrismFaces } from '../solid-fill-geometry';

const SQUARE = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];

describe('buildPrismFaces', () => {
  it('τετράγωνο + ύψος → 8 faces (2 καπάκια×2 τρίγωνα + 4 πλευρές)', () => {
    const faces = buildPrismFaces(SQUARE, 0, 3000);
    expect(faces).toHaveLength(8);
    // πλευρικές όψεις = quads (4 κορυφές)· καπάκια = τρίγωνα (3 κορυφές).
    expect(faces.filter((f) => f.length === 4)).toHaveLength(4);
    expect(faces.filter((f) => f.length === 3)).toHaveLength(4);
  });

  it('z: όλες οι κορυφές στο {base, top} (base=1000, top=1000+2000)', () => {
    const faces = buildPrismFaces(SQUARE, 1000, 2000);
    const zs = new Set(faces.flat().map((c) => c.zMm));
    expect([...zs].sort((a, b) => a - b)).toEqual([1000, 3000]);
  });

  it('flat fill (height 0) → μόνο κάτω καπάκι (2 τρίγωνα, καμία πλευρά)', () => {
    const faces = buildPrismFaces(SQUARE, 0, 0);
    expect(faces).toHaveLength(2);
    expect(faces.every((f) => f.length === 3)).toBe(true);
    expect(faces.flat().every((c) => c.zMm === 0)).toBe(true);
  });

  it('ring < 3 κορυφές → []', () => {
    expect(buildPrismFaces([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0, 1000)).toEqual([]);
  });

  it('κλειστό ring (διπλή τελευταία = πρώτη) → ίδιο με ανοιχτό (no degenerate side)', () => {
    const closed = [...SQUARE, { x: 0, y: 0 }];
    expect(buildPrismFaces(closed, 0, 3000)).toHaveLength(8);
  });
});
