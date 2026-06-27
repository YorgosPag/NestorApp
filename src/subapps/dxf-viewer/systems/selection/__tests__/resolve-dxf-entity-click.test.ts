/**
 * ADR-543 — shared DXF click→selection decision (AutoCAD PICKADD=1).
 * Locks the SSoT both the 2D canvas and the 3D viewport pick route through.
 */

import { applyDxfEntityClickSelection, type DxfEntityClickOps } from '../resolve-dxf-entity-click';

function makeOps(initial: string[] = []): { ops: DxfEntityClickOps; calls: string[]; selection: Set<string> } {
  const selection = new Set(initial);
  const calls: string[] = [];
  const ops: DxfEntityClickOps = {
    toggle: (id) => { calls.push(`toggle:${id}`); selection.has(id) ? selection.delete(id) : selection.add(id); },
    add: (id) => { calls.push(`add:${id}`); selection.add(id); },
    replaceWithSingle: (id) => { calls.push(`replace:${id}`); selection.clear(); selection.add(id); },
    isSelected: (id) => selection.has(id),
    selectedDxfCount: () => selection.size,
  };
  return { ops, calls, selection };
}

describe('applyDxfEntityClickSelection', () => {
  it('plain click with no prior selection → replace (single select)', () => {
    const { ops, calls, selection } = makeOps([]);
    applyDxfEntityClickSelection('a', false, ops);
    expect(calls).toEqual(['replace:a']);
    expect([...selection]).toEqual(['a']);
  });

  it('plain click with an existing selection → ADD (PICKADD=1, accumulate)', () => {
    const { ops, calls, selection } = makeOps(['a']);
    applyDxfEntityClickSelection('b', false, ops);
    expect(calls).toEqual(['add:b']);
    expect([...selection].sort()).toEqual(['a', 'b']);
  });

  it('plain click on an already-selected entity → no-op (no duplicate add)', () => {
    const { ops, calls } = makeOps(['a', 'b']);
    applyDxfEntityClickSelection('a', false, ops);
    expect(calls).toEqual([]);
  });

  it('Shift+click → toggle (adds when absent)', () => {
    const { ops, calls, selection } = makeOps(['a']);
    applyDxfEntityClickSelection('b', true, ops);
    expect(calls).toEqual(['toggle:b']);
    expect([...selection].sort()).toEqual(['a', 'b']);
  });

  it('Shift+click on an already-selected entity → toggle removes it', () => {
    const { ops, calls, selection } = makeOps(['a', 'b']);
    applyDxfEntityClickSelection('b', true, ops);
    expect(calls).toEqual(['toggle:b']);
    expect([...selection]).toEqual(['a']);
  });
});
