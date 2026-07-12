/**
 * ADR-643 Φ5b — IMAGE / IMAGEDEF writer structural round-trip.
 *
 * Αποδεικνύει ότι ένα image-mode hatch (φέρει `dxfImageExport` marker, τον οποίο προ-υπολογίζει ο
 * client pre-pass `image-fill-export.ts`) εξάγεται από τον `writeDxfAscii` ως N tiled `IMAGE`
 * entities + ΕΝΑ κοινό `IMAGEDEF` (OBJECTS section), ΑΝΤΙ για το native `HATCH`. Structural
 * (token-level) — δεν υπάρχει IMAGE import reader για full round-trip (τεκμηριωμένο fidelity
 * boundary, ADR-643 §6). Ελέγχει: πλήθος IMAGE = inserts, dedup IMAGEDEF ανά filename, 340→5
 * handle wiring, filename (relative zip path), και ΜΙΑ κοινή OBJECTS section μαζί με MLINE.
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import type { DxfImageExportMarker, Entity, HatchEntity, PolylineEntity, DxfMlineSource } from '../../../types/entities';

const LAYERS = { L: { name: 'FLOORS', colorAci: 3 } };

function imageHatch(id: string, marker: Partial<DxfImageExportMarker> = {}): Entity {
  const full: DxfImageExportMarker = {
    filename: 'images/granite.jpg',
    pixelWidth: 512,
    pixelHeight: 512,
    tileWorldWidth: 600,
    tileWorldHeight: 600,
    angleDeg: 0,
    inserts: [{ x: 0, y: 0 }, { x: 600, y: 0 }],
    ...marker,
  };
  return {
    id, type: 'hatch', layerId: 'L', fillType: 'image',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 600 }, { x: 0, y: 600 }]],
    dxfImageExport: full,
  } as unknown as HatchEntity;
}

/** Πλήθος `0 <name>` blocks. */
function countOccurrences(dxf: string, name: string): number {
  const t = dxf.split('\n');
  let n = 0;
  for (let i = 0; i < t.length - 1; i += 2) if (t[i] === '0' && t[i + 1] === name) n += 1;
  return n;
}

/** Πλήθος section headers `2 <name>` (π.χ. OBJECTS). */
function countSections(dxf: string, name: string): number {
  const t = dxf.split('\n');
  let n = 0;
  for (let i = 0; i < t.length - 1; i += 2) if (t[i] === '2' && t[i + 1] === name) n += 1;
  return n;
}

/** Όλα τα blocks του entityName ως λίστα από `code→value` maps (last-wins ανά code). */
function blocks(dxf: string, entityName: string): Array<Record<string, string>> {
  const t = dxf.split('\n');
  const out: Array<Record<string, string>> = [];
  for (let i = 0; i < t.length - 1; i += 2) {
    if (!(t[i] === '0' && t[i + 1] === entityName)) continue;
    const rec: Record<string, string> = {};
    for (let j = i + 2; j < t.length - 1; j += 2) {
      if (t[j] === '0') break;
      rec[t[j]] = t[j + 1];
    }
    out.push(rec);
  }
  return out;
}

describe('writeDxfAscii — IMAGE / IMAGEDEF (ADR-643 Φ5b)', () => {
  it('image-mode hatch → ΕΝΑ IMAGE ανά insert, ΚΑΝΕΝΑ native HATCH', () => {
    const dxf = writeDxfAscii([imageHatch('h1')], { layersById: LAYERS });
    expect(countOccurrences(dxf, 'IMAGE')).toBe(2); // 2 inserts
    expect(countOccurrences(dxf, 'HATCH')).toBe(0); // native HATCH αντικαταστάθηκε
  });

  it('εκπέμπει ΕΝΑ IMAGEDEF με το relative filename (group 1) + pixel size', () => {
    const dxf = writeDxfAscii([imageHatch('h1')], { layersById: LAYERS });
    const defs = blocks(dxf, 'IMAGEDEF');
    expect(defs).toHaveLength(1);
    expect(defs[0]['1']).toBe('images/granite.jpg');
    expect(defs[0]['10']).toBe('512'); // pixel width (U)
    expect(defs[0]['20']).toBe('512'); // pixel height (V)
  });

  it('κάθε IMAGE group 340 δείχνει στο handle (group 5) του IMAGEDEF', () => {
    const dxf = writeDxfAscii([imageHatch('h1')], { layersById: LAYERS });
    const defHandle = blocks(dxf, 'IMAGEDEF')[0]['5'];
    expect(defHandle).toBeDefined();
    for (const img of blocks(dxf, 'IMAGE')) {
      expect(img['340']).toBe(defHandle);
    }
  });

  it('δύο hatch ίδιου filename → ΕΝΑ IMAGEDEF, IMAGE = άθροισμα inserts', () => {
    const dxf = writeDxfAscii([imageHatch('h1'), imageHatch('h2')], { layersById: LAYERS });
    expect(countOccurrences(dxf, 'IMAGEDEF')).toBe(1); // deduped ανά filename
    expect(countOccurrences(dxf, 'IMAGE')).toBe(4); // 2 + 2 inserts
  });

  it('δύο hatch διαφορετικού filename → ΔΥΟ IMAGEDEF', () => {
    const dxf = writeDxfAscii(
      [imageHatch('h1'), imageHatch('h2', { filename: 'images/wood.jpg' })],
      { layersById: LAYERS },
    );
    expect(countOccurrences(dxf, 'IMAGEDEF')).toBe(2);
    const names = blocks(dxf, 'IMAGEDEF').map((d) => d['1']).sort();
    expect(names).toEqual(['images/granite.jpg', 'images/wood.jpg']);
  });

  it('το IMAGE κληρονομεί το layer του hatch (group 8)', () => {
    const dxf = writeDxfAscii([imageHatch('h1')], { layersById: LAYERS });
    for (const img of blocks(dxf, 'IMAGE')) expect(img['8']).toBe('FLOORS');
  });

  it('MLINE + IMAGE μαζί → ΜΙΑ κοινή OBJECTS section (MLINESTYLE + IMAGEDEF)', () => {
    const mlineSource: DxfMlineSource = {
      refPath: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      scale: 1, justification: 1, isClosed: false, styleName: 'MYWALL',
      style: { name: 'MYWALL', elements: [{ offset: 0.6 }, { offset: -0.4 }] },
    };
    const carrier = {
      id: 'mline_0_e0', type: 'polyline', layerId: 'L', groupId: 'mline_0',
      vertices: [{ x: 0, y: 0.6 }, { x: 10, y: 0.6 }], dxfMlineSource: mlineSource,
    } as unknown as PolylineEntity;

    const dxf = writeDxfAscii([carrier, imageHatch('h1')], { layersById: LAYERS });
    // DXF επιτρέπει ΜΙΑ μόνο OBJECTS section — ο writer τα ενώνει.
    expect(countSections(dxf, 'OBJECTS')).toBe(1);
    expect(countOccurrences(dxf, 'MLINESTYLE')).toBe(1);
    expect(countOccurrences(dxf, 'IMAGEDEF')).toBe(1);
    expect(countOccurrences(dxf, 'IMAGE')).toBe(2);
  });

  it('solid hatch (χωρίς marker) → native HATCH, ΚΑΝΕΝΑ IMAGE / OBJECTS', () => {
    const solid = {
      id: 's', type: 'hatch', layerId: 'L', fillType: 'solid',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]],
    } as unknown as HatchEntity;
    const dxf = writeDxfAscii([solid], { layersById: LAYERS });
    expect(countOccurrences(dxf, 'HATCH')).toBe(1);
    expect(countOccurrences(dxf, 'IMAGE')).toBe(0);
    expect(countSections(dxf, 'OBJECTS')).toBe(0);
  });
});
