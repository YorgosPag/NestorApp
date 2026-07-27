/**
 * ADR-344 Φ-3D — ο 3D editor κειμένου, με έμφαση στο **πού γράφεται** η διόρθωση.
 *
 * Ο λόγος ύπαρξης αυτής της σουίτας είναι ΕΝΑ σενάριο: με «Όλοι οι όροφοι»
 * (`floor3DScope: 'all'`) ο χρήστης βλέπει — και άρα διπλοκλικάρει — κείμενο που ζει σε άλλο
 * level. Αν το commit πάει στον ΕΝΕΡΓΟ όροφο, η διόρθωση γράφεται σε λάθος αρχείο **σιωπηλά**:
 * κανένα σφάλμα, κανένα κόκκινο test, απλώς κατεστραμμένα δεδομένα σε δύο ορόφους ταυτόχρονα
 * (το σωστό κείμενο μένει αδιόρθωτο, ένα άσχετο αλλάζει). Πράσινα unit tests αλλού δεν το
 * πιάνουν — μόνο αυτό εδώ.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { useBim3DTextDoubleClickEditor } from '../use-bim3d-text-double-click-editor';
import type { Bim3DProjectionSource } from '../text-edit-anchor-3d';

const execute = jest.fn();
const buildDxfTextServices = jest.fn();
const buildTextEditCommand = jest.fn();
let selectedIds: string[] = [];
let levels: unknown = null;

jest.mock('../../../core/commands', () => ({ useCommandHistory: () => ({ execute }) }));
jest.mock('../../../systems/levels/useLevels', () => ({ useLevelsOptional: () => levels }));
jest.mock('../../../hooks/useCanEditText', () => ({ useCanEditText: () => ({ canUnlockLayer: true }) }));
jest.mock('../../../systems/selection/SelectedEntitiesStore', () => ({
  SelectedEntitiesStore: { getSelectedEntityIds: () => selectedIds },
}));
jest.mock('../../../ui/text-toolbar/hooks/useDxfTextServices', () => ({
  buildDxfTextServices: (p: unknown) => buildDxfTextServices(p),
}));
jest.mock('../../../ui/text-toolbar/text-edit-session', () => ({
  resolveTextEditTarget: (scene: { entities?: Array<{ id: string; type: string }> } | null, ids: string[]) => {
    const entity = scene?.entities?.find((e) => e.id === ids[0]);
    return entity && (entity.type === 'text' || entity.type === 'mtext')
      ? { entity, node: { marker: 'node' } }
      : null;
  },
  buildTextEditCommand: (...args: unknown[]) => buildTextEditCommand(...args),
}));
jest.mock('../text-edit-anchor-3d', () => ({
  createTextEditorAnchor3D: () => ({
    project: () => ({ x: 0, y: 0 }),
    subscribe: () => () => {},
    size: { width: 220, height: 32 },
  }),
}));

const SOURCE: Bim3DProjectionSource = { getCamera: () => null, getCanvas: () => null };

/** Δύο όροφοι· το κείμενο `t-upper` ζει ΜΟΝΟ στον πάνω, ενώ ενεργός είναι ο κάτω. */
function twoFloorLevels() {
  const scenes: Record<string, { entities: Array<{ id: string; type: string }> }> = {
    'level-ground': { entities: [{ id: 't-ground', type: 'text' }] },
    'level-upper': { entities: [{ id: 't-upper', type: 'mtext' }] },
  };
  return {
    currentLevelId: 'level-ground',
    levels: [{ id: 'level-ground' }, { id: 'level-upper' }],
    getLevelScene: (id: string) => scenes[id] ?? null,
    setLevelScene: jest.fn(),
  };
}

function mountEditor(canvasEl: HTMLCanvasElement) {
  const api: { current: ReturnType<typeof useBim3DTextDoubleClickEditor> | null } = { current: null };
  function Probe(): null {
    api.current = useBim3DTextDoubleClickEditor({ canvasEl, source: SOURCE });
    return null;
  }
  render(<Probe />);
  return api;
}

describe('useBim3DTextDoubleClickEditor', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    jest.clearAllMocks();
    canvas = document.createElement('canvas');
    levels = twoFloorLevels();
    selectedIds = [];
    buildDxfTextServices.mockReturnValue({ sceneManager: {}, layerProvider: {}, auditRecorder: {} });
    buildTextEditCommand.mockReturnValue({ execute: jest.fn(), undo: jest.fn() });
  });

  const dblclick = () => act(() => { canvas.dispatchEvent(new MouseEvent('dblclick')); });

  it('ανοίγει σε κείμενο του ΕΝΕΡΓΟΥ ορόφου', () => {
    selectedIds = ['t-ground'];
    const api = mountEditor(canvas);
    dblclick();
    expect(api.current?.editingState).toMatchObject({ entityId: 't-ground', levelId: 'level-ground' });
  });

  it('ανοίγει σε MTEXT ΑΛΛΟΥ ορόφου και κρατά ΕΚΕΙΝΟ το levelId', () => {
    selectedIds = ['t-upper'];
    const api = mountEditor(canvas);
    dblclick();
    expect(api.current?.editingState).toMatchObject({ entityId: 't-upper', levelId: 'level-upper' });
  });

  it('⚠️ το commit γράφει στον όροφο ΤΗΣ ΟΝΤΟΤΗΤΑΣ, όχι στον ενεργό', () => {
    selectedIds = ['t-upper'];
    const api = mountEditor(canvas);
    dblclick();
    act(() => { api.current!.onCommit({ marker: 'next' } as never); });

    expect(buildDxfTextServices).toHaveBeenCalledWith(
      expect.objectContaining({ levelId: 'level-upper' }),
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('δεν ανοίγει χωρίς levels context (ADR-371 read-only pipeline)', () => {
    levels = null;
    selectedIds = ['t-ground'];
    const api = mountEditor(canvas);
    dblclick();
    expect(api.current?.editingState).toBeNull();
  });

  it('δεν ανοίγει σε πολλαπλή επιλογή', () => {
    selectedIds = ['t-ground', 't-upper'];
    const api = mountEditor(canvas);
    dblclick();
    expect(api.current?.editingState).toBeNull();
  });

  it('η ακύρωση δεν αγγίζει το ιστορικό', () => {
    selectedIds = ['t-ground'];
    const api = mountEditor(canvas);
    dblclick();
    act(() => { api.current!.onCancel(); });
    expect(api.current?.editingState).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it('commit χωρίς πραγματική αλλαγή → μηδέν εγγραφή στο ιστορικό', () => {
    buildTextEditCommand.mockReturnValue(null);
    selectedIds = ['t-ground'];
    const api = mountEditor(canvas);
    dblclick();
    act(() => { api.current!.onCommit({ marker: 'same' } as never); });
    expect(execute).not.toHaveBeenCalled();
  });
});
