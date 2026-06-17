/**
 * ADR-477 — auto-aware οπλισμός **συνδετήριας δοκού** (tie-beam) με parity κολόνας/δοκού.
 *
 * Verifies:
 *   - το facade `resolveActiveMemberReinforcement` δρομολογεί foundation tie-beam → TieBeamReinforcement
 *   - auto-mode ⇒ φρέσκο code-suggested design από την ΤΡΕΧΟΥΣΑ γεωμετρία (resize → re-derive)
 *   - manual (auto:false) ⇒ stored ως έχει (referentially unchanged)
 *   - absent ⇒ undefined
 *   - `buildReinforcePatch`: absent → νέα πρόταση (auto:true)· ίδια γεωμετρία → null (convergence guard)·
 *     manual → null (lock)
 */

import {
  resolveActiveMemberReinforcement,
  resolveActiveTieBeamReinforcement,
} from '../section-context';
import { buildReinforcePatch } from '../reinforce-patch';
import { resolveStructuralCode } from '../codes';
import type { FoundationEntity, TieBeamParams } from '../../types/foundation-types';
import type { TieBeamReinforcement } from '../reinforcement/footing-reinforcement-types';

const provider = resolveStructuralCode('eurocode');

function seedTieBeam(widthMm: number, depthMm: number, spanMm: number): TieBeamReinforcement {
  const r = provider.suggestFootingReinforcement({
    kind: 'tie-beam',
    widthMm,
    depthMm,
    spanMm,
    grossAreaMm2: widthMm * depthMm,
    supportType: 'simple',
  });
  if (r.kind !== 'tie-beam') throw new Error('expected tie-beam suggestion');
  return r;
}

function tieBeamEntity(
  widthMm: number,
  depthMm: number,
  spanMm: number,
  reinforcement?: TieBeamReinforcement,
): FoundationEntity {
  const params: Partial<TieBeamParams> = {
    kind: 'tie-beam',
    start: { x: 0, y: 0, z: 0 },
    end: { x: spanMm, y: 0, z: 0 },
    width: widthMm,
    thicknessMm: depthMm,
    topElevationMm: -500,
    sceneUnits: 'mm',
    ...(reinforcement ? { reinforcement } : {}),
  };
  return {
    id: 'TB1',
    type: 'foundation',
    kind: 'tie-beam',
    params,
    geometry: {},
  } as unknown as FoundationEntity;
}

const steelArea = (count: number, d: number): number => count * Math.PI * (d / 2) ** 2;

describe('ADR-477 — active tie-beam reinforcement (auto-aware, parity δοκού)', () => {
  it('facade: foundation tie-beam → TieBeamReinforcement (πεδίο .bottom + kind)', () => {
    const auto: TieBeamReinforcement = { ...seedTieBeam(250, 500, 4000), auto: true };
    const out = resolveActiveMemberReinforcement(tieBeamEntity(250, 500, 4000, auto), provider)!;
    expect(out).toBeDefined();
    if (out.kind !== 'tie-beam') throw new Error('expected tie-beam');
    expect(out.bottom.count).toBeGreaterThan(0);
    expect(out.auto).toBe(true);
  });

  it('auto: μεγαλύτερο βάθος/άνοιγμα → περισσότερος (φρέσκος) κάτω χάλυβας (live re-study)', () => {
    const auto: TieBeamReinforcement = { ...seedTieBeam(250, 500, 4000), auto: true };
    const small = resolveActiveTieBeamReinforcement(
      tieBeamEntity(250, 500, 4000, auto).params as TieBeamParams,
      provider,
    )!;
    const big = resolveActiveTieBeamReinforcement(
      tieBeamEntity(400, 800, 8000, auto).params as TieBeamParams,
      provider,
    )!;
    expect(steelArea(big.bottom.count, big.bottom.diameterMm))
      .toBeGreaterThanOrEqual(steelArea(small.bottom.count, small.bottom.diameterMm));
  });

  it('manual (auto:false): stored, referentially unchanged στο resize', () => {
    const manual: TieBeamReinforcement = { ...seedTieBeam(250, 500, 4000), auto: false };
    const out = resolveActiveTieBeamReinforcement(
      tieBeamEntity(400, 800, 8000, manual).params as TieBeamParams,
      provider,
    );
    expect(out).toBe(manual);
  });

  it('absent → undefined', () => {
    expect(resolveActiveMemberReinforcement(tieBeamEntity(250, 500, 4000), provider)).toBeUndefined();
  });

  it('buildReinforcePatch: absent → νέα πρόταση με auto:true', () => {
    const patch = buildReinforcePatch(tieBeamEntity(250, 500, 4000), provider);
    expect(patch).not.toBeNull();
    const next = patch!.next as TieBeamParams;
    expect(next.reinforcement?.kind).toBe('tie-beam');
    expect(next.reinforcement?.auto).toBe(true);
  });

  it('buildReinforcePatch: auto + ίδια γεωμετρία → null (convergence guard, anti-oscillation)', () => {
    const auto: TieBeamReinforcement = { ...seedTieBeam(250, 500, 4000), auto: true };
    expect(buildReinforcePatch(tieBeamEntity(250, 500, 4000, auto), provider)).toBeNull();
  });

  it('buildReinforcePatch: manual (auto:false) → null (lock, ο μηχανικός κερδίζει)', () => {
    const manual: TieBeamReinforcement = { ...seedTieBeam(250, 500, 4000), auto: false };
    expect(buildReinforcePatch(tieBeamEntity(400, 800, 8000, manual), provider)).toBeNull();
  });
});
