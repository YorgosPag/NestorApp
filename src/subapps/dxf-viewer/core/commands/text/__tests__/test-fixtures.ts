/**
 * ADR-344 Phase 6.A — Shared test fixtures for text command tests.
 *
 * Keeps each command test focused on its own behavior. Builders here
 * are intentionally minimal: only the fields the commands actually
 * touch are populated.
 */

import type { ISceneManager, SceneEntity } from '../../interfaces';
import type {
  DxfTextNode,
  TextParagraph,
  TextRun,
  TextRunStyle,
} from '../../../../text-engine/types';
import type {
  DxfTextSceneEntity,
  IDxfTextAuditRecorder,
  ILayerAccessProvider,
  LayerSnapshot,
} from '../types';

export function makeStyle(over: Partial<TextRunStyle> = {}): TextRunStyle {
  return {
    fontFamily: 'Arial',
    bold: false,
    italic: false,
    underline: false,
    overline: false,
    strikethrough: false,
    height: 2.5,
    widthFactor: 1,
    obliqueAngle: 0,
    tracking: 1,
    color: { kind: 'byLayer' },
    ...over,
  };
}

export function makeRun(text: string, over: Partial<TextRunStyle> = {}): TextRun {
  return { text, style: makeStyle(over) };
}

export function makeParagraph(runs: readonly TextRun[]): TextParagraph {
  return {
    runs,
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: 0,
    lineSpacingMode: 'multiple',
    lineSpacingFactor: 1,
  };
}

export function makeNode(over: Partial<DxfTextNode> = {}): DxfTextNode {
  return {
    paragraphs: [makeParagraph([makeRun('hello')])],
    attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
    ...over,
  };
}

export function makeTextEntity(
  id: string,
  over: Partial<DxfTextSceneEntity> = {},
): DxfTextSceneEntity {
  return {
    id,
    type: 'mtext',
    layer: '0',
    visible: true,
    position: { x: 0, y: 0 },
    textNode: makeNode(),
    ...over,
  };
}

export function makeScene(initial: DxfTextSceneEntity[] = []): {
  scene: ISceneManager;
  store: Map<string, SceneEntity>;
} {
  const store = new Map<string, SceneEntity>();
  for (const e of initial) store.set(e.id, e);
  const scene: ISceneManager = {
    addEntity: (e) => {
      store.set(e.id, e);
    },
    removeEntity: (id) => {
      store.delete(id);
    },
    getEntity: (id) => store.get(id),
    updateEntity: (id, updates) => {
      const cur = store.get(id);
      if (!cur) return;
      store.set(id, { ...cur, ...updates });
    },
    updateVertex: () => {},
    insertVertex: () => {},
    removeVertex: () => {},
    getVertices: () => undefined,
  };
  return { scene, store };
}

export function makeLayerProvider(
  layers: Record<string, Partial<LayerSnapshot>> = {},
  canUnlockLayer = false,
): ILayerAccessProvider {
  return {
    getLayer: (name) => {
      const partial = layers[name];
      if (!partial) return undefined;
      return {
        name,
        locked: partial.locked ?? false,
        frozen: partial.frozen ?? false,
      };
    },
    canUnlockLayer,
  };
}

export function makeRecorder(): IDxfTextAuditRecorder & {
  events: Array<{ action: string; entityId: string }>;
} {
  const events: Array<{ action: string; entityId: string }> = [];
  return {
    events,
    record(ev) {
      events.push({ action: ev.action, entityId: ev.entityId });
    },
  };
}
