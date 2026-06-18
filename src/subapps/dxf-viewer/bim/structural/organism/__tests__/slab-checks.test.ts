/**
 * ADR-498 — `runSlabChecks`: warning «πλάκα-πρόβολος πολύ λεπτή» (έλεγχος βέλους L/d).
 *
 * Καλύπτει: λεπτός πρόβολος → warning· επαρκώς παχύς → σιωπηλό· κοντός πρόβολος → σιωπηλό·
 * αμφιέρειστη (2 δοκοί) → κανένα warning· καμία πλάκα → κενό.
 *
 * Fixtures: canvas = mm (sceneUnits:'mm' → /1000 = m).
 */

import { runSlabChecks } from '../slab-checks';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import type { Entity } from '../../../../types/entities';

function beam(id: string, x0: number, y0: number, x1: number, y1: number): Entity {
  return {
    id, type: 'beam', kind: 'straight',
    params: { kind: 'straight', width: 250, sceneUnits: 'mm', startPoint: { x: x0, y: y0 }, endPoint: { x: x1, y: y1 } },
    geometry: { volume: 0.5 },
  } as unknown as Entity;
}

/** Πλάκα roof (suspended): ορθογώνιο outline (mm) + πάχος· πρόβολος κατά Y από τη δοκό y=0. */
function slab(id: string, x0: number, y0: number, x1: number, y1: number, thicknessMm: number): Entity {
  return {
    id, type: 'slab', kind: 'roof',
    params: {
      kind: 'roof', sceneUnits: 'mm', thickness: thicknessMm,
      outline: { vertices: [
        { x: x0, y: y0, z: 0 }, { x: x1, y: y0, z: 0 },
        { x: x1, y: y1, z: 0 }, { x: x0, y: y1, z: 0 },
      ] },
    },
    geometry: { maxFreeSpanM: Math.abs(y1 - y0) / 1000 },
  } as unknown as Entity;
}

const codeOf = (d: { code: string }) => d.code;

describe('runSlabChecks — cantileverSlabTooThin (ADR-498)', () => {
  it('πρόβολος 5m σε πλάκα 200mm → warning', () => {
    const diags = runSlabChecks([beam('b1', 0, 0, 5000, 0), slab('s1', 0, 0, 5000, 5000, 200)], EUROCODE_PROVIDER);
    const d = diags.find((x) => x.code === 'cantileverSlabTooThin');
    expect(d).toBeDefined();
    expect(d?.severity).toBe('warning');
    expect(d?.entityIds).toContain('s1');
  });

  it('ίδιος πρόβολος σε επαρκώς παχιά πλάκα (900mm) → σιωπηλό', () => {
    const diags = runSlabChecks([beam('b1', 0, 0, 5000, 0), slab('s1', 0, 0, 5000, 5000, 900)], EUROCODE_PROVIDER);
    expect(diags.map(codeOf)).not.toContain('cantileverSlabTooThin');
  });

  it('κοντός πρόβολος (1m) σε πλάκα 200mm → σιωπηλό (L/d εντός ορίου)', () => {
    const diags = runSlabChecks([beam('b1', 0, 0, 5000, 0), slab('s1', 0, 0, 5000, 1000, 200)], EUROCODE_PROVIDER);
    expect(diags.map(codeOf)).not.toContain('cantileverSlabTooThin');
  });

  it('αμφιέρειστη πλάκα (2 δοκοί) → κανένα cantilever warning', () => {
    const diags = runSlabChecks([
      beam('b1', 0, 0, 5000, 0),
      beam('b2', 0, 5000, 5000, 5000),
      slab('s1', 0, 0, 5000, 5000, 200),
    ], EUROCODE_PROVIDER);
    expect(diags.map(codeOf)).not.toContain('cantileverSlabTooThin');
  });

  it('καμία πλάκα → κενό', () => {
    expect(runSlabChecks([beam('b1', 0, 0, 5000, 0)], EUROCODE_PROVIDER)).toHaveLength(0);
  });
});
