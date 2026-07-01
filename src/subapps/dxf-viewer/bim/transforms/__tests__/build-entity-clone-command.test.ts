/**
 * Tests — buildEntityCloneCommand (shared clone SSoT: Ctrl+V paste + Ctrl+drag copy).
 *
 * Heavy collaborators are mocked so the test focuses on the split/translate/assembly:
 *   - BIM sources → buildClonesFromEntities (translate transform passed through)
 *   - DXF sources → applyEntityPreview translate + id-swap
 *   - both → one PasteEntitiesCommand(bimClones, dxfClones, sm)
 */

jest.mock('../bim-copy-builder', () => ({
  buildClonesFromEntities: jest.fn((sources: Array<{ id: string }>, transform: unknown) => ({
    clones: sources.map((s) => ({ ...s, id: `bim-clone-${s.id}`, __transform: transform })),
    sourceToCloneId: new Map(),
    skipped: [],
  })),
}));

jest.mock('../../../core/commands/entity-commands/PasteEntitiesCommand', () => ({
  PasteEntitiesCommand: class {
    constructor(
      public bimClones: unknown[],
      public dxfClones: unknown[],
      public sm: unknown,
    ) {}
  },
}));

let idCounter = 0;
jest.mock('../../../systems/entity-creation/utils', () => ({
  generateEntityId: jest.fn(() => `dxf-clone-${++idCounter}`),
}));

jest.mock('../../../rendering/ghost', () => ({
  applyEntityPreview: jest.fn((entity: Record<string, unknown>, preview: { delta: unknown }) => ({
    ...entity,
    __translatedBy: preview.delta,
  })),
  makeTranslationPreview: jest.fn((id: string, delta: unknown) => ({ id, delta })),
}));

jest.mock('../../../types/entities', () => ({
  isBimEntity: (e: { type: string }) => e.type === 'wall' || e.type === 'column',
}));

import { buildEntityCloneCommand } from '../build-entity-clone-command';
import { buildClonesFromEntities } from '../bim-copy-builder';
import { applyEntityPreview } from '../../../rendering/ghost';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asSources = (arr: any[]) => arr as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sm = {} as any;

describe('buildEntityCloneCommand', () => {
  beforeEach(() => { idCounter = 0; jest.clearAllMocks(); });

  it('returns null for an empty source list', () => {
    expect(buildEntityCloneCommand(asSources([]), { x: 5, y: 5 }, sm)).toBeNull();
  });

  it('splits BIM vs DXF and assembles one PasteEntitiesCommand', () => {
    const sources = asSources([
      { id: 'w1', type: 'wall' },
      { id: 'l1', type: 'line' },
    ]);
    const result = buildEntityCloneCommand(sources, { x: 10, y: 5 }, sm);
    expect(result).not.toBeNull();
    // BIM clone id from the mocked builder, DXF clone id from the id-swap.
    expect(result!.cloneIds).toEqual(['bim-clone-w1', 'dxf-clone-1']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmd = result!.command as any;
    expect(cmd.bimClones).toHaveLength(1);
    expect(cmd.dxfClones).toHaveLength(1);
    expect(cmd.sm).toBe(sm);
  });

  it('passes the translate transform to the BIM clone builder', () => {
    buildEntityCloneCommand(asSources([{ id: 'w1', type: 'wall' }]), { x: 3, y: 7 }, sm);
    expect(buildClonesFromEntities).toHaveBeenCalledWith(
      [{ id: 'w1', type: 'wall' }],
      { kind: 'translate', delta: { x: 3, y: 7 } },
    );
  });

  it('translates DXF geometry by delta and re-ids it', () => {
    const result = buildEntityCloneCommand(asSources([{ id: 'l1', type: 'line' }]), { x: 10, y: 5 }, sm);
    expect(applyEntityPreview).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dxfClone = (result!.command as any).dxfClones[0];
    expect(dxfClone.__translatedBy).toEqual({ x: 10, y: 5 });
    expect(dxfClone.id).toBe('dxf-clone-1'); // fresh id, not the source id
  });
});
