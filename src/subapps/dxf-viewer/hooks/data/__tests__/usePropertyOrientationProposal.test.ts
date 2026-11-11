/**
 * ADR-937 §2.2 — η κενή πρόταση λέει ΓΙΑΤΙ (live 2026-11-11: κάτοψη μόνο με γραμμές DXF έλεγε «δεν βρέθηκαν ανοίγματα»).
 *
 *   Κ1  καμία οντότητα τοίχου (σκέτες γραμμές DXF) ⇒ `no-model`, ακόμη κι αν υπάρχουν «ανοίγματα»
 *   Κ2  τοίχοι χωρίς αναγνωρισμένο εξωτερικό κέλυφος ⇒ `no-envelope`
 *   Κ3  κέλυφος + παράθυρο στη νότια ακμή ⇒ `derived` + ['south']· κέλυφος χωρίς ανοίγματα ⇒ `derived` + []
 *   Κ4  χωρίς σκηνή ή εκφυλισμένο πολύγωνο ⇒ `null` (η λωρίδα δεν αποδίδεται)
 *   Κ5  κάτοψη ακινήτου (`envelope`): όριο = εξωτερική παρειά κάθε ΚΛΕΙΣΤΗΣ αλυσίδας κελύφους· ανοιχτή αλυσίδα ⇒ καμία
 *       μαντεψιά (`derived` + [])
 *
 * Το «ποιος τοίχος είναι εξωτερικός» έχει δικές του άγκυρες (envelope-perimeter) — εδώ ελέγχεται η ΔΙΑΚΛΑΔΩΣΗ.
 */

// jest globals injected (no '@jest/globals' import) so @swc/jest hoists the mocks above the hook import.
import { renderHook } from '@testing-library/react';

import {
  ENVELOPE_BOUNDARY,
  usePropertyOrientationProposal,
  type PropertyBoundarySource,
} from '../usePropertyOrientationProposal';

interface MockEntity {
  readonly type: string;
  readonly id: string;
  readonly params?: { readonly kind: string; readonly wallId: string };
  readonly geometry?: { readonly position: { readonly x: number; readonly y: number } };
}

let mockScene: { units: string; entities: MockEntity[] } | null = null;
let mockExteriorWallIds = new Set<string>();
let mockChains: Array<{
  closed: boolean;
  enclosesRegion: boolean;
  exteriorFaceLoop: { points: Array<{ x: number; y: number }> };
}> = [];

jest.mock('../../../systems/levels/useCurrentLevelScene', () => ({
  useCurrentLevelScene: () => mockScene,
}));
jest.mock('../../../bim/geometry/exterior-wall-ids', () => ({
  resolveExteriorEnvelope: () => ({ chains: mockChains, wallIds: mockExteriorWallIds }),
}));
jest.mock('../../../systems/geo-referencing/geo-reference-store', () => ({
  getGeoReference: () => null,
  subscribeGeoReference: () => () => undefined,
}));

/** Τετράγωνο 10×10 m σε mm (κορυφές overlay). */
const POLYGON: ReadonlyArray<[number, number]> = [[0, 0], [10_000, 0], [10_000, 10_000], [0, 10_000]];

const WALL: MockEntity = { type: 'wall', id: 'ext-s' };
const SOUTH_WINDOW: MockEntity = {
  type: 'opening',
  id: 'op-1',
  params: { kind: 'window', wallId: 'ext-s' },
  geometry: { position: { x: 5_000, y: 0 } },
};
const DXF_LINE: MockEntity = { type: 'line', id: 'ln-1' };

/** Η ίδια εξωτερική παρειά ως αλυσίδα κελύφους (σημεία σκηνής). */
const LOOP = { points: POLYGON.map(([x, y]) => ({ x, y })) };

function runSource(source: PropertyBoundarySource | undefined) {
  return renderHook(() => usePropertyOrientationProposal(source)).result.current;
}

function run(polygon: ReadonlyArray<[number, number]> | undefined) {
  return runSource(polygon ? { kind: 'polygon', polygon } : undefined);
}

describe('usePropertyOrientationProposal — αιτία κενής πρότασης', () => {
  beforeEach(() => {
    mockScene = null;
    mockExteriorWallIds = new Set<string>();
    mockChains = [];
  });

  it('Κ1 μόνο γραμμές DXF ⇒ no-model', () => {
    mockScene = { units: 'mm', entities: [DXF_LINE, SOUTH_WINDOW] };
    expect(run(POLYGON)).toEqual({ status: 'no-model', values: [], northAssumed: true });
  });

  it('Κ2 τοίχοι χωρίς εξωτερικό κέλυφος ⇒ no-envelope', () => {
    mockScene = { units: 'mm', entities: [WALL, SOUTH_WINDOW] };
    expect(run(POLYGON)).toEqual({ status: 'no-envelope', values: [], northAssumed: true });
  });

  it('Κ3 κέλυφος ⇒ derived, με ή χωρίς ανοίγματα στο όριο', () => {
    mockExteriorWallIds = new Set(['ext-s']);
    mockScene = { units: 'mm', entities: [WALL, SOUTH_WINDOW] };
    expect(run(POLYGON)).toEqual({ status: 'derived', values: ['south'], northAssumed: true });
    mockScene = { units: 'mm', entities: [WALL] };
    expect(run(POLYGON)).toEqual({ status: 'derived', values: [], northAssumed: true });
  });

  it('Κ4 χωρίς σκηνή ή με εκφυλισμένο πολύγωνο ⇒ null', () => {
    expect(run(POLYGON)).toBeNull();
    mockScene = { units: 'mm', entities: [WALL] };
    expect(run([[0, 0], [1, 1]])).toBeNull();
    expect(run(undefined)).toBeNull();
  });

  it('Κ5 κάτοψη ακινήτου: όριο = κλειστό κέλυφος· ανοιχτή αλυσίδα δεν μαντεύει', () => {
    mockExteriorWallIds = new Set(['ext-s']);
    mockScene = { units: 'mm', entities: [WALL, SOUTH_WINDOW] };
    mockChains = [{ closed: true, enclosesRegion: true, exteriorFaceLoop: LOOP }];
    expect(runSource(ENVELOPE_BOUNDARY)).toEqual({ status: 'derived', values: ['south'], northAssumed: true });
    mockChains = [{ closed: false, enclosesRegion: false, exteriorFaceLoop: LOOP }];
    expect(runSource(ENVELOPE_BOUNDARY)).toEqual({ status: 'derived', values: [], northAssumed: true });
  });
});
