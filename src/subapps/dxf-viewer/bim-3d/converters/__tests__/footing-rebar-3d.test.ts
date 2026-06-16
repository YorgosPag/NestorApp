/**
 * ADR-463 — 3Δ footing rebar cage smoke tests (kind-aware build + null guard).
 * Επίσης επιβεβαιώνει ότι το import chain είναι pure (μηδέν store/fetch landmine).
 */

import { buildFootingRebarCage } from '../footing-rebar-3d';
import { buildFoundationEntity, buildDefaultFoundationParams } from '../../../hooks/drawing/foundation-completion';
import type {
  FoundationEntity,
  FoundationKind,
  FoundationParams,
} from '../../../bim/types/foundation-types';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
} from '../../../bim/structural/reinforcement/footing-reinforcement-types';

function makeEntity(kind: FoundationKind, reinforcement?: FoundationParams['reinforcement']): FoundationEntity {
  const params = buildDefaultFoundationParams({ x: 0, y: 0 }, kind, { topElevationMm: -1000, thicknessMm: 500 });
  const r = buildFoundationEntity(params, 'layer-1');
  if (!r.ok) throw new Error(`failed to build ${kind}`);
  if (!reinforcement) return r.entity;
  return { ...r.entity, params: { ...r.entity.params, reinforcement } as FoundationParams };
}

const padReinf: PadReinforcement = {
  kind: 'pad',
  bottomMeshX: { diameterMm: 12, spacingMm: 200 },
  bottomMeshY: { diameterMm: 12, spacingMm: 200 },
  topMesh: { diameterMm: 10, spacingMm: 250 },
  coverMm: 50,
};
const stripReinf: StripReinforcement = {
  kind: 'strip',
  transverse: { diameterMm: 12, spacingMm: 150 },
  longitudinal: { diameterMm: 14, count: 4 },
  stirrups: { diameterMm: 8, spacingMm: 200 },
  coverMm: 50,
};
const tieReinf: TieBeamReinforcement = {
  kind: 'tie-beam',
  bottom: { diameterMm: 16, count: 3 },
  top: { diameterMm: 16, count: 3 },
  stirrups: { diameterMm: 8, spacingMm: 200 },
  coverMm: 40,
};

describe('buildFootingRebarCage', () => {
  it('returns null when no reinforcement is defined', () => {
    expect(buildFootingRebarCage(makeEntity('pad'), -1.5, 'l')).toBeNull();
  });

  it('builds a tagged group for a reinforced pad (bottom + top mesh)', () => {
    const cage = buildFootingRebarCage(makeEntity('pad', padReinf), -1.5, 'l');
    expect(cage).not.toBeNull();
    expect(cage!.children.length).toBeGreaterThan(0);
    expect(cage!.userData['bimType']).toBe('foundation');
    expect(cage!.userData['reinforcement']).toBe(true);
  });

  it('builds a group for a reinforced strip', () => {
    const cage = buildFootingRebarCage(makeEntity('strip', stripReinf), -1.5, 'l');
    expect(cage).not.toBeNull();
    expect(cage!.children.length).toBeGreaterThan(0);
  });

  it('builds a group for a reinforced tie-beam', () => {
    const cage = buildFootingRebarCage(makeEntity('tie-beam', tieReinf), -1.5, 'l');
    expect(cage).not.toBeNull();
    expect(cage!.children.length).toBeGreaterThan(0);
  });
});
