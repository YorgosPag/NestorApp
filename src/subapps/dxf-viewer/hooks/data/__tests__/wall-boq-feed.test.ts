/**
 * ADR-458 (γενίκευση) — wall-boq-feed NET volume tests («η κολόνα νικάει»).
 *
 * Επαληθεύει: κολόνα μέσα σε τοίχο → wall net area/volume < gross (ο κόμβος ανήκει στην
 * κολόνα, μετριέται ΜΙΑ φορά)· καμία τομή / σκηνή null → gross αμετάβλητο (zero regression).
 */

import { wallBoqEntity } from '../wall-boq-feed';
import { buildDefaultWallParams, buildWallEntity } from '../../drawing/wall-completion';
import { buildDefaultColumnParams, buildColumnEntity } from '../../drawing/column-completion';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { ColumnEntity } from '../../../bim/types/column-types';
import type { SceneModel } from '../../../types/entities';

/** Ευθύς τοίχος (0,0)→(5000,0), πάχος 300mm (explicit → manual, χωρίς DNA). */
function wall(): WallEntity {
  const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 5000, y: 0 }, { thickness: 300 });
  const res = buildWallEntity(params, '0');
  if (!res.ok) throw new Error('wall fixture invalid');
  return res.entity;
}

function columnAt(x: number, y: number, width: number, depth: number): ColumnEntity {
  const params = { ...buildDefaultColumnParams({ x, y }, 'rectangular'), width, depth };
  const res = buildColumnEntity(params, '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

const emptyScene = { entities: [] } as unknown as SceneModel;

describe('wallBoqEntity — ADR-458 column cutback net volume', () => {
  it('κολόνα στη μέση → NET area/volume < gross (column wins)', () => {
    const w = wall();
    const grossArea = w.geometry.area;
    const grossVolume = w.geometry.volume;
    // Κολόνα 600×600 στο μέσο (2500,0). Επικάλυψη footprint = 600(x) × 300(πάχος) = 180000mm².
    // Gross plan footprint = 5000 × 300 = 1_500_000 → ratio ≈ 1_320_000/1_500_000 = 0.88.
    const scene = { entities: [w, columnAt(2500, 0, 600, 600)] } as unknown as SceneModel;
    const out = wallBoqEntity(w, scene);
    expect(out.geometry!.area).toBeLessThan(grossArea);
    expect(out.geometry!.volume).toBeLessThan(grossVolume);
    expect(out.geometry!.area).toBeCloseTo(grossArea * 0.88, 2);
    expect(out.geometry!.volume).toBeCloseTo(grossVolume * 0.88, 2);
  });

  it('κολόνα που ΔΕΝ τέμνει → gross αμετάβλητο (zero regression)', () => {
    const w = wall();
    const scene = { entities: [w, columnAt(50000, 50000, 600, 600)] } as unknown as SceneModel;
    const out = wallBoqEntity(w, scene);
    expect(out.geometry!.area).toBeCloseTo(w.geometry.area, 6);
    expect(out.geometry!.volume).toBeCloseTo(w.geometry.volume, 6);
  });

  it('χωρίς κολόνες στη σκηνή → gross αμετάβλητο', () => {
    const w = wall();
    const out = wallBoqEntity(w, emptyScene);
    expect(out.geometry!.area).toBeCloseTo(w.geometry.area, 6);
    expect(out.geometry!.volume).toBeCloseTo(w.geometry.volume, 6);
  });

  it('σκηνή null → gross αμετάβλητο (δεν προκύπτει net)', () => {
    const w = wall();
    const out = wallBoqEntity(w, null);
    expect(out.geometry!.area).toBeCloseTo(w.geometry.area, 6);
    expect(out.geometry!.volume).toBeCloseTo(w.geometry.volume, 6);
  });
});
