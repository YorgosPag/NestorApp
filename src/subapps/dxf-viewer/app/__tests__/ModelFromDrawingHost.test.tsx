/**
 * @jest-environment jsdom
 *
 * ADR-911 Φ3β — οι ΡΑΦΕΣ του host: σήμα ribbon → οπλισμός → κλικ καμβά → πρόταση → έγκριση.
 *
 * Ο ελεγκτής και η προεπισκόπηση έχουν δικές τους άγκυρες. Εδώ κρίνεται μόνο ό,τι ζει στον host
 * και σπάει χωρίς κανένα type error: ότι το σήμα όντως οπλίζει, ότι το κλικ του καμβά φτάνει στον
 * ελεγκτή με τη ΖΩΝΤΑΝΗ σκηνή, ότι το Esc και η οδηγία υπάρχουν μόνο όσο είναι οπλισμένος, και ότι
 * ο καμβάς δεν μένει οπλισμένος όταν ο host φύγει.
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import type { Entity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import type { LevelsHookReturn } from '../../systems/levels';
import { EventBus } from '../../systems/events/EventBus';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { toolHintOverrideStore } from '../../hooks/toolHintOverrideStore';
import { handleModelFromDrawingSampleClick } from '../../hooks/canvas/canvas-click-model-from-drawing';
import {
  isModelFromDrawingPicking,
  modelFromDrawingStore,
} from '../../systems/model-from-drawing/model-from-drawing-store';
import { updateImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { ModelFromDrawingPanelProps } from '../../ui/panels/model-from-drawing/ModelFromDrawingPanel';
import fixture from '../../bim/model-from-drawing/__tests__/fixtures/floor-plan-lines.json';
import { ModelFromDrawingHost } from '../ModelFromDrawingHost';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
}));

const commit = jest.fn();
jest.mock('../../bim/family-types/useWallAutoTyping', () => ({
  useWallAutoTyping: () => ({ beginWallTyping: () => ({ typeWall: (w: unknown) => w, commit }) }),
}));

interface EscOptions { readonly id: string; readonly handle: () => boolean }
let escape: EscOptions | null = null;
jest.mock('../../systems/escape-bus/useEscapeHandler', () => ({
  useEscapeHandler: (options: EscOptions | null) => { escape = options; },
}));

let panel: ModelFromDrawingPanelProps | null = null;
jest.mock('../../ui/panels/model-from-drawing/ModelFromDrawingPanel', () => ({
  ModelFromDrawingPanel: (props: ModelFromDrawingPanelProps) => {
    panel = props;
    return <section data-testid="panel" data-phase={props.state.phase} />;
  },
}));

const ENTITIES = fixture.entities as unknown as readonly Entity[];
const WALL_LINE = ENTITIES.find((e) => (e as { color?: string }).color === '#003FFF') as unknown as {
  start: { x: number; y: number }; end: { x: number; y: number };
};
const ON_WALL_LINE = { x: (WALL_LINE.start.x + WALL_LINE.end.x) / 2, y: (WALL_LINE.start.y + WALL_LINE.end.y) / 2 };

function levelManagerOver(initial: readonly Entity[]) {
  let scene = { entities: [...initial], units: 'mm' } as unknown as SceneModel;
  const levelManager = {
    currentLevelId: 'lvl_test',
    getLevelScene: () => scene,
    setLevelScene: (_id: string, next: SceneModel) => { scene = next; },
  } as unknown as LevelsHookReturn;
  return { levelManager, walls: () => (scene.entities as unknown as Entity[]).filter(isWallEntity) };
}

const requestAssistant = () => act(() => { EventBus.emit('dxf:model-from-drawing-requested', {}); });
const clickCanvas = (point: { x: number; y: number }) => act(() => { handleModelFromDrawingSampleClick(point); });

beforeEach(() => {
  getGlobalCommandHistory().clear();
  commit.mockClear();
  panel = null;
  escape = null;
  updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 });
});

afterEach(() => act(() => modelFromDrawingStore.reset()));

describe('ModelFromDrawingHost', () => {
  it('κλειστός: κανένα πάνελ, κανένας χειριστής Esc, καμία οδηγία', () => {
    const { container } = render(<ModelFromDrawingHost levelManager={levelManagerOver(ENTITIES).levelManager} />);
    expect(container.querySelector('[data-testid="panel"]')).toBeNull();
    expect(escape).toBeNull();
    expect(toolHintOverrideStore.getSnapshot()).toBeNull();
  });

  it('το σήμα του ribbon οπλίζει: πάνελ, οδηγία στη γραμμή κατάστασης, Esc που κλείνει', () => {
    const { container } = render(<ModelFromDrawingHost levelManager={levelManagerOver(ENTITIES).levelManager} />);
    requestAssistant();
    expect(container.querySelector('[data-testid="panel"]')?.getAttribute('data-phase')).toBe('picking');
    expect(isModelFromDrawingPicking()).toBe(true);
    expect(toolHintOverrideStore.getSnapshot()).toBe('t:modelFromDrawing.pickHint');
    expect(escape?.id).toBe('model-from-drawing-pick-sample');

    act(() => { escape?.handle(); });
    expect(modelFromDrawingStore.get().phase).toBe('closed');
    expect(toolHintOverrideStore.getSnapshot()).toBeNull();
    expect(escape).toBeNull();
  });

  it('το κλικ του καμβά φτάνει στον ελεγκτή με τη ζωντανή σκηνή: γραμμή ⇒ πρόταση· κενό ⇒ μένει οπλισμένος', () => {
    render(<ModelFromDrawingHost levelManager={levelManagerOver(ENTITIES).levelManager} />);
    requestAssistant();

    clickCanvas({ x: -9e6, y: -9e6 });
    expect(modelFromDrawingStore.get()).toMatchObject({ phase: 'picking', notice: { kind: 'no-line' }, pendingSample: null });

    clickCanvas(ON_WALL_LINE);
    const state = modelFromDrawingStore.get();
    expect(state.phase).toBe('review');
    expect(state.proposal?.items).toHaveLength(40);
    expect(state.pendingSample).toBeNull();
    // Στην αναθεώρηση ο καμβάς ΔΕΝ είναι πια οπλισμένος: Esc και οδηγία φεύγουν.
    expect(isModelFromDrawingPicking()).toBe(false);
    expect(escape).toBeNull();
    expect(toolHintOverrideStore.getSnapshot()).toBeNull();
  });

  it('η ανοχή επιλογής είναι pixels οθόνης: σε μικρή κλίμακα πιάνει γραμμή που σε μεγάλη χάνει', () => {
    render(<ModelFromDrawingHost levelManager={levelManagerOver(ENTITIES).levelManager} />);
    const near = { x: ON_WALL_LINE.x + 40, y: ON_WALL_LINE.y }; // 40 mm δίπλα σε κατακόρυφη γραμμή

    act(() => updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 })); // 8 px = 8 mm
    requestAssistant();
    clickCanvas(near);
    expect(modelFromDrawingStore.get().notice).toEqual({ kind: 'no-line' });

    act(() => updateImmediateTransform({ scale: 0.1, offsetX: 0, offsetY: 0 })); // 8 px = 80 mm
    clickCanvas(near);
    expect(modelFromDrawingStore.get().phase).toBe('review');
  });

  it('οι αποφάσεις του πάνελ φτάνουν στον ελεγκτή, και η έγκριση γράφει στη σκηνή του levelManager', () => {
    const h = levelManagerOver(ENTITIES);
    render(<ModelFromDrawingHost levelManager={h.levelManager} />);
    requestAssistant();
    clickCanvas(ON_WALL_LINE);

    for (const g of modelFromDrawingStore.get().proposal!.groups) {
      act(() => panel!.actions.onConfirmGroup(g.thicknessMm, g.suggestedCategory));
    }
    expect(modelFromDrawingStore.get().proposal!.groups.every((g) => g.confirmed)).toBe(true);
    act(() => panel!.actions.onApprove());

    expect(h.walls()).toHaveLength(38);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(modelFromDrawingStore.get().notice).toMatchObject({ kind: 'written', count: 38 });
  });

  it('«άλλο δείγμα» ξαναοπλίζει· το κλείσιμο και η αποχώρηση του host αφήνουν τον καμβά ελεύθερο', () => {
    const view = render(<ModelFromDrawingHost levelManager={levelManagerOver(ENTITIES).levelManager} />);
    requestAssistant();
    clickCanvas(ON_WALL_LINE);

    act(() => panel!.actions.onResample());
    expect(modelFromDrawingStore.get()).toMatchObject({ phase: 'picking', proposal: null });

    act(() => panel!.actions.onClose());
    expect(modelFromDrawingStore.get().phase).toBe('closed');

    requestAssistant();
    expect(isModelFromDrawingPicking()).toBe(true);
    view.unmount();
    expect(isModelFromDrawingPicking()).toBe(false);
  });
});
