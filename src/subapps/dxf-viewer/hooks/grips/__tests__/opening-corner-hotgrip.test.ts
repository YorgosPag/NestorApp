/**
 * ADR-513 §opening-width — tests για το gate `resolveOpeningCornerHotGrip`: true ΜΟΝΟ για λαβή
 * παρειάς (`opening-corner-*`) σε **wall-hosted** κούφωμα με DXF grip. Το ΔΥΝ toggle ελέγχεται από
 * τον caller (εκτός resolver), οπότε εδώ δοκιμάζεται μόνο ο pure geometry/kind gate.
 */

import { resolveOpeningCornerHotGrip } from '../opening-corner-hotgrip';
import type { UnifiedGripInfo } from '../unified-grip-types';
import type { OpeningGripKind } from '../grip-kinds';

const grip = (kind: OpeningGripKind, source: 'dxf' | 'overlay' = 'dxf') =>
  ({ source, gripKind: { on: 'opening', kind } } as unknown as UnifiedGripInfo);

const wallHosted = { params: { wallId: 'wall-1' } };
const selfHosted = { params: { selfHost: { anchor: { x: 0, y: 0, z: 0 } } } };

describe('ADR-513 §opening-width — resolveOpeningCornerHotGrip', () => {
  it('true για λαβή παρειάς σε wall-hosted κούφωμα (και τις 4 γωνίες)', () => {
    for (const k of ['opening-corner-ne', 'opening-corner-nw', 'opening-corner-sw', 'opening-corner-se'] as OpeningGripKind[]) {
      expect(resolveOpeningCornerHotGrip(wallHosted, grip(k))).toBe(true);
    }
  });

  it('false για μη-λαβή-παρειάς (move/rotation/facing)', () => {
    for (const k of ['opening-move', 'opening-rotation', 'opening-facing'] as OpeningGripKind[]) {
      expect(resolveOpeningCornerHotGrip(wallHosted, grip(k))).toBe(false);
    }
  });

  it('false για self-hosted κούφωμα (κρατά το box-grip flow)', () => {
    expect(resolveOpeningCornerHotGrip(selfHosted, grip('opening-corner-ne'))).toBe(false);
  });

  it('false για κούφωμα χωρίς host (ούτε wallId ούτε selfHost)', () => {
    expect(resolveOpeningCornerHotGrip({ params: {} }, grip('opening-corner-ne'))).toBe(false);
  });

  it('false για non-dxf grip source', () => {
    expect(resolveOpeningCornerHotGrip(wallHosted, grip('opening-corner-ne', 'overlay'))).toBe(false);
  });

  it('false για null entity/grip', () => {
    expect(resolveOpeningCornerHotGrip(null, grip('opening-corner-ne'))).toBe(false);
    expect(resolveOpeningCornerHotGrip(wallHosted, null)).toBe(false);
  });
});
