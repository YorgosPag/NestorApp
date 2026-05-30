jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-363 §5.4 — Opening `kind` SSoT (`params.kind` is the single source of
 * truth; the top-level `kind` + `ifcType` are DERIVED mirrors).
 *
 * Regression: the Θ.101 bug — a doc whose top-level `kind` diverged from
 * `params.kind` (a door re-typed to a window that only patched `params`).
 * Hydration must self-heal to `params.kind`, and `entityToSaveInput` must
 * persist the derived `kind` so the divergence never re-enters Firestore.
 */

import { openingDocToEntity } from '../opening-doc-hydration';
import { entityToSaveInput, type OpeningDoc } from '../opening-firestore-service';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { WallEntity } from '../../types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../types/opening-types';
import { makeBimValidation } from '../../types/bim-base';

function makeWall(): WallEntity {
  const r = buildWallEntity(buildDefaultWallParams({ x: 0, y: 0 }, { x: 4000, y: 0 }), '0', 'straight');
  if (!r.ok) throw new Error('wall build failed');
  return r.entity;
}

const WINDOW_PARAMS: OpeningParams = {
  kind: 'window',
  wallId: 'wall_1',
  offsetFromStart: 500,
  width: 1200,
  height: 1400,
  sillHeight: 900,
  mark: 'Θ.101', // stale door-style mark from before the kind change
};

/** A corrupt doc: top-level `kind` is a stale 'door', params say 'window'. */
function makeDivergentDoc(wallId: string): OpeningDoc {
  return {
    id: 'opening_x',
    companyId: 'comp_1',
    projectId: 'proj_1',
    floorplanId: 'fp_1',
    kind: 'door', // ← diverged top-level discriminator
    params: { ...WINDOW_PARAMS, wallId },
    validation: makeBimValidation(),
    // audit fields omitted in this in-memory fixture
  } as unknown as OpeningDoc;
}

describe('Opening kind SSoT (ADR-363 §5.4)', () => {
  it('1. hydration self-heals: entity.kind follows params.kind, not the stale doc.kind', () => {
    const wall = makeWall();
    const entity = openingDocToEntity(makeDivergentDoc(wall.id), wall);
    expect(entity).not.toBeNull();
    expect(entity!.kind).toBe('window');          // ← was 'door' in doc.kind
    expect(entity!.params.kind).toBe('window');
    expect(entity!.ifcType).toBe('IfcWindow');     // derived from params.kind
  });

  it('2. entityToSaveInput persists kind DERIVED from params.kind', () => {
    // Simulate an in-memory entity whose top-level kind is stale (e.g. a kind
    // change that only patched params — the exact bug source).
    const stale = {
      id: 'opening_x',
      type: 'opening',
      kind: 'door',               // ← stale
      layerId: '0',
      params: WINDOW_PARAMS,      // ← truth
      geometry: undefined,
      validation: makeBimValidation(),
      ifcType: 'IfcDoor',
    } as unknown as OpeningEntity;

    const input = entityToSaveInput(stale);
    expect(input.kind).toBe('window'); // never the stale top-level copy
    expect(input.params.kind).toBe('window');
  });

  it('3. clean doc (kind === params.kind) hydrates unchanged', () => {
    const wall = makeWall();
    const doc = { ...makeDivergentDoc(wall.id), kind: 'window' as const };
    const entity = openingDocToEntity(doc, wall);
    expect(entity!.kind).toBe('window');
    expect(entity!.ifcType).toBe('IfcWindow');
  });
});
