/**
 * ADR-484 — foundation-write-scope SSoT tests (scope literal + cross-level writer resolver).
 */

jest.mock('../foundation-cross-level-writer', () => ({
  createFoundationCrossLevelWriter: jest.fn(() => ({ create: jest.fn(), update: jest.fn(), remove: jest.fn() })),
}));

import { buildFoundationWriteScope, resolveFoundationCrossLevelWriter } from '../foundation-write-scope';
import { createFoundationCrossLevelWriter } from '../foundation-cross-level-writer';
import { useFoundationLevelStore } from '../../../state/foundation-level-store';

const io = { getLevelScene: () => null, setLevelScene: () => {} };
const target = (levelId: string) => ({ levelId, floorId: 'ff', sceneFileId: null, floorElevationMm: 0 });

describe('buildFoundationWriteScope', () => {
  it('χτίζει scope από user + projectId του level', () => {
    expect(
      buildFoundationWriteScope({ companyId: 'c1', uid: 'u1' }, [{ id: 'L1', projectId: 'p1' }], 'L1'),
    ).toEqual({ companyId: 'c1', projectId: 'p1', userId: 'u1' });
  });

  it('projectId undefined όταν το level δεν βρεθεί', () => {
    expect(buildFoundationWriteScope({ companyId: 'c1', uid: 'u1' }, [], 'L1').projectId).toBeUndefined();
  });

  it('null user → companyId/userId undefined', () => {
    const s = buildFoundationWriteScope(null, [{ id: 'L1', projectId: 'p1' }], 'L1');
    expect(s.companyId).toBeUndefined();
    expect(s.userId).toBeUndefined();
  });
});

describe('resolveFoundationCrossLevelWriter', () => {
  beforeEach(() => (createFoundationCrossLevelWriter as jest.Mock).mockClear());
  afterEach(() => useFoundationLevelStore.setState({ target: null }));

  it('ρητός target → καλεί factory με σωστό scope + target', () => {
    const w = resolveFoundationCrossLevelWriter({
      user: { companyId: 'c1', uid: 'u1' }, levels: [{ id: 'L1', projectId: 'p1' }], levelId: 'L1', io, target: target('Lf'),
    });
    expect(w).not.toBeNull();
    expect(createFoundationCrossLevelWriter).toHaveBeenCalledWith(
      { companyId: 'c1', projectId: 'p1', userId: 'u1' },
      expect.objectContaining({ levelId: 'Lf' }),
      io,
    );
  });

  it('target null → null, μηδέν factory call', () => {
    const w = resolveFoundationCrossLevelWriter({ user: { companyId: 'c1', uid: 'u1' }, levels: [], levelId: 'L1', io, target: null });
    expect(w).toBeNull();
    expect(createFoundationCrossLevelWriter).not.toHaveBeenCalled();
  });

  it('target undefined → fallback στο store target', () => {
    useFoundationLevelStore.setState({ target: target('Ls') });
    const w = resolveFoundationCrossLevelWriter({ user: { companyId: 'c1', uid: 'u1' }, levels: [], levelId: 'L1', io });
    expect(w).not.toBeNull();
    expect(createFoundationCrossLevelWriter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ levelId: 'Ls' }),
      io,
    );
  });
});
