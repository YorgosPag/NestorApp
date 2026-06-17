/**
 * ADR-471 §2 — member-agnostic facade `resolveActiveMemberReinforcement`.
 *
 * Verifies το ΕΝΑ entry δρομολογεί σωστά κολόνα↔δοκάρι (function overloads → ακριβής
 * τύπος μετά type-guard, μηδέν cast) και διατηρεί τη `resolveActive*` σημασιολογία:
 *   - auto-mode  ⇒ φρέσκο code-suggested design από την ΤΡΕΧΟΥΣΑ γεωμετρία (resize → re-derive)
 *   - manual     ⇒ stored ως έχει (referentially unchanged)
 *   - absent / μη-οπλίσιμο μέλος ⇒ undefined
 */

import { resolveActiveMemberReinforcement } from '../section-context';
import { resolveStructuralCode } from '../codes';
import type { Entity } from '../../../types/entities';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';

const provider = resolveStructuralCode('eurocode');

function colEntity(width: number, depth: number, reinforcement?: ColumnReinforcement): ColumnEntity {
  return {
    id: 'C1',
    type: 'column',
    kind: 'rectangular',
    params: {
      kind: 'rectangular',
      position: { x: 0, y: 0, z: 0 },
      anchor: 'center',
      width,
      depth,
      height: 3000,
      rotation: 0,
      sceneUnits: 'mm',
      ...(reinforcement ? { reinforcement } : {}),
    },
    geometry: { area: (width * depth) / 1e6 },
  } as unknown as ColumnEntity;
}

function beamEntity(lengthM: number, reinforcement?: BeamReinforcement): BeamEntity {
  return {
    id: 'B1',
    type: 'beam',
    kind: 'straight',
    params: {
      kind: 'straight',
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: lengthM * 1000, y: 0, z: 0 },
      width: 250,
      depth: 500,
      topElevation: 3000,
      supportType: 'simple',
      sceneUnits: 'mm',
      ...(reinforcement ? { reinforcement } : {}),
    },
    geometry: { length: lengthM },
  } as unknown as BeamEntity;
}

const steelArea = (count: number, d: number): number => count * Math.PI * (d / 2) ** 2;

describe('resolveActiveMemberReinforcement — facade dispatch (ADR-471 §2)', () => {
  it('κολόνα: το overload επιστρέφει ColumnReinforcement (πεδίο .longitudinal)', () => {
    const seed = provider.suggestColumnReinforcement({ widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 });
    const auto: ColumnReinforcement = { ...seed, auto: true };
    const out = resolveActiveMemberReinforcement(colEntity(400, 400, auto), provider)!;
    // Type-level: ο compiler ξέρει ότι είναι ColumnReinforcement (πρόσβαση .longitudinal).
    expect(out.longitudinal.count).toBeGreaterThan(0);
    expect(out.auto).toBe(true);
  });

  it('κολόνα auto: μεγαλύτερη διατομή → περισσότερος (φρέσκος) διαμήκης χάλυβας', () => {
    const seed = provider.suggestColumnReinforcement({ widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 });
    const auto: ColumnReinforcement = { ...seed, auto: true };
    const small = resolveActiveMemberReinforcement(colEntity(400, 400, auto), provider)!;
    const big = resolveActiveMemberReinforcement(colEntity(800, 800, auto), provider)!;
    expect(steelArea(big.longitudinal.count, big.longitudinal.diameterMm))
      .toBeGreaterThan(steelArea(small.longitudinal.count, small.longitudinal.diameterMm));
  });

  it('δοκάρι: το overload επιστρέφει BeamReinforcement (πεδίο .bottom)', () => {
    const seed = provider.suggestBeamReinforcement({ widthMm: 250, depthMm: 500, spanMm: 5000, grossAreaMm2: 125000, supportType: 'simple' });
    const auto: BeamReinforcement = { ...seed, auto: true };
    const out = resolveActiveMemberReinforcement(beamEntity(5, auto), provider)!;
    // Type-level: ο compiler ξέρει ότι είναι BeamReinforcement (πρόσβαση .bottom).
    expect(out.bottom.count).toBeGreaterThan(0);
    expect(out.auto).toBe(true);
  });

  it('κολόνα manual (auto:false): stored, referentially unchanged στο resize', () => {
    const seed = provider.suggestColumnReinforcement({ widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 });
    const manual: ColumnReinforcement = { ...seed, auto: false };
    expect(resolveActiveMemberReinforcement(colEntity(800, 800, manual), provider)).toBe(manual);
  });

  it('δοκάρι manual (auto:false): stored, referentially unchanged στο resize', () => {
    const seed = provider.suggestBeamReinforcement({ widthMm: 250, depthMm: 500, spanMm: 5000, grossAreaMm2: 125000, supportType: 'simple' });
    const manual: BeamReinforcement = { ...seed, auto: false };
    expect(resolveActiveMemberReinforcement(beamEntity(8, manual), provider)).toBe(manual);
  });

  it('absent reinforcement → undefined (κολόνα & δοκάρι)', () => {
    expect(resolveActiveMemberReinforcement(colEntity(400, 400), provider)).toBeUndefined();
    expect(resolveActiveMemberReinforcement(beamEntity(5), provider)).toBeUndefined();
  });

  it('μη-οπλίσιμο/άλλο entity → undefined', () => {
    const wall = { id: 'W1', type: 'wall', params: {}, geometry: {} } as unknown as Entity;
    expect(resolveActiveMemberReinforcement(wall, provider)).toBeUndefined();
  });
});
