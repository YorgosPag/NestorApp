/**
 * ADR-652 M2/M6 — buildUserBlockSaveInput (κοινό SSoT save-input: palette save + create-from-selection).
 * Επιβεβαιώνει: scope `user`, ασφαλής provenance (`user-import` + passed timestamp), bounds fallback,
 * null όταν δεν υπάρχει μετρήσιμη γεωμετρία.
 */

import { buildUserBlockSaveInput } from '../build-save-block-input';
import type { BlockLicense, InSessionBlockDef } from '../block-library-types';
import type { Entity } from '../../types/entities';

const LICENSE: BlockLicense = { type: 'unknown', redistributable: false };

const mkLine = (id: string): Entity =>
  ({ id, type: 'line', layerId: 'l', visible: true, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }) as unknown as Entity;

const mkDef = (over: Partial<InSessionBlockDef> = {}): InSessionBlockDef => ({
  name: 'Sofa',
  localMembers: [mkLine('m1')],
  boundsMm: { minX: 0, minY: 0, maxX: 1, maxY: 0 },
  ...over,
});

describe('ADR-652 M2/M6 — buildUserBlockSaveInput', () => {
  it('builds a user-scope save input with safe provenance', () => {
    const input = buildUserBlockSaveInput(
      mkDef(),
      { name: 'Sofa', category: 'furniture', license: LICENSE },
      'usr_1',
      123,
    );
    expect(input).not.toBeNull();
    expect(input!.scope).toBe('user');
    expect(input!.name).toBe('Sofa');
    expect(input!.category).toBe('furniture');
    expect(input!.license).toBe(LICENSE);
    expect(input!.provenance).toEqual({
      sourceType: 'user-import',
      importedAt: 123,
      importedBy: 'usr_1',
    });
    expect(input!.boundsMm).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 0 });
  });

  it('falls back to computed bounds when the def has none', () => {
    const input = buildUserBlockSaveInput(
      mkDef({ boundsMm: null }),
      { name: 'X', category: 'other', license: LICENSE },
      'u',
      1,
    );
    expect(input).not.toBeNull();
    expect(input!.boundsMm.maxX).toBeCloseTo(1);
  });

  it('returns null when there is no measurable geometry (empty members, no bounds)', () => {
    const input = buildUserBlockSaveInput(
      mkDef({ boundsMm: null, localMembers: [] }),
      { name: 'X', category: 'other', license: LICENSE },
      'u',
      1,
    );
    expect(input).toBeNull();
  });

  it('uses the passed timestamp (deterministic — no Date.now inside)', () => {
    const input = buildUserBlockSaveInput(
      mkDef(),
      { name: 'Sofa', category: 'furniture', license: LICENSE },
      'u',
      999,
    );
    expect(input!.provenance.importedAt).toBe(999);
  });
});
