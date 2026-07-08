/**
 * ADR-602 (ADR-587 Φ6) Stage 2 — grip discriminator dual-write + §1.4 bug fixes.
 *
 * Κλειδώνει τα forwarding hubs της αλυσίδας GripInfo → UnifiedGripInfo → DxfGripDragPreview:
 *
 *  1. `gripKind` dual-write — το tagged discriminator SSoT (`EntityGripKind`) προωθείται 1:1
 *     από κάθε hub δίπλα στα 31 legacy `xxxGripKind?` fields· απών → ΔΕΝ leak-άρει κλειδί.
 *  2. §1.4 Bug 1 — `wrapDxfGrip` ΔΕΝ αντέγραφε `mepWaterHeaterGripKind` (declared σε
 *     GripInfo+UnifiedGripInfo, consumers το περίμεναν populated). Τώρα forwarded.
 *  3. §1.4 Bug 3 — οι δύο preview builders (`buildDxfDragPreview` translate /
 *     `buildRotateReferencePreview` rotate) forward-άρουν disjoint legacy subsets· το ΕΝΑ
 *     `gripKind` κλείνει το gap by construction (και οι δύο το προωθούν).
 *
 * Inert στο Stage 2 (οι producers σετάρουν το `gripKind` στο Stage 3) — εδώ πιν-άρεται μόνο
 * το pass-through, μηδέν behavior change στα legacy fields (πλην των Bug 1/2 fixes).
 */

// Defensive: το grip-registry.ts τραβά React/store barrels που μπορεί να αγγίξουν firebase auth.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { wrapDxfGrip } from '../grip-registry';
import { buildDxfDragPreview, buildRotateReferencePreview } from '../grip-projections';
import type { GripInfo } from '../../grip-types';
import type { UnifiedGripInfo } from '../unified-grip-types';
import type { EntityGripKind } from '../../grip-kinds';

const WALL_TAG: EntityGripKind = { on: 'wall', kind: 'wall-start' };

function baseGrip(overrides: Partial<GripInfo> = {}): GripInfo {
  return {
    entityId: 'e1',
    gripIndex: 0,
    type: 'vertex',
    position: { x: 0, y: 0 },
    movesEntity: false,
    ...overrides,
  };
}

function unified(overrides: Partial<UnifiedGripInfo> = {}): UnifiedGripInfo {
  return {
    id: 'dxf_e1_0',
    source: 'dxf',
    entityId: 'e1',
    gripIndex: 0,
    type: 'vertex',
    position: { x: 0, y: 0 },
    movesEntity: false,
    ...overrides,
  } as UnifiedGripInfo;
}

describe('ADR-602 Stage 2 — wrapDxfGrip (GripInfo → UnifiedGripInfo)', () => {
  it('forwards the unified `gripKind`, omits it when absent', () => {
    expect('gripKind' in wrapDxfGrip(baseGrip())).toBe(false);
    expect(wrapDxfGrip(baseGrip({ gripKind: WALL_TAG })).gripKind).toEqual(WALL_TAG);
  });
});

describe('ADR-602 Stage 2 — preview builders dual-write (§1.4 Bug 3 by construction)', () => {
  const anchor = { x: 0, y: 0 };
  const cursor = { x: 10, y: 0 };

  it('buildDxfDragPreview (translate) forwards `gripKind`', () => {
    const p = buildDxfDragPreview('dragging', unified({ gripKind: WALL_TAG }), anchor, cursor);
    expect(p).not.toBeNull();
    expect(p!.gripKind).toEqual(WALL_TAG);
  });

  it('buildDxfDragPreview omits `gripKind` when absent (no undefined key leak)', () => {
    const p = buildDxfDragPreview('dragging', unified(), anchor, cursor);
    expect(p).not.toBeNull();
    expect('gripKind' in p!).toBe(false);
  });

  it('buildRotateReferencePreview (rotate) forwards the SAME `gripKind` — disjoint subsets κλείνουν', () => {
    const p = buildRotateReferencePreview(
      unified({ gripKind: WALL_TAG }), 'rotate-free', anchor, null, null, null, cursor, cursor,
    );
    expect(p).not.toBeNull();
    expect(p!.gripKind).toEqual(WALL_TAG);
  });
});
