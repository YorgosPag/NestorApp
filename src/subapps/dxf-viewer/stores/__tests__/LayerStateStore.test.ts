/**
 * LayerStateStore tests — ADR-358 §5.9 Q12 Phase 12.
 *
 * Covers: lifecycle (idle/hydrating/ready), saveCurrent snapshot capture,
 * rename + delete + currentStateId tracking, subscribe notify, project switch
 * detach.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  __getLayerStateTemplateServiceForTesting,
  __resetLayerStateStoreForTesting,
  clearProject,
  captureCurrentSnapshot,
  deleteLayerStateById,
  getLayerState,
  getLayerStateStoreSnapshot,
  importTemplateAsState,
  listLayerStates,
  markCurrentLayerState,
  renameLayerState,
  saveCurrentAsTemplate,
  saveCurrentLayerState,
  searchTemplateSummaries,
  setLayerStateTemplateService,
  setProjectId,
  subscribeLayerStateStore,
} from '../LayerStateStore';
import type {
  DxfLayerStateTemplateService,
  SaveAsTemplateInput,
  SearchTemplatesQuery,
} from '@/services/dxf-layer-state-template.service';
import type {
  LayerStateTemplate,
  LayerStateTemplateSummary,
} from '../../types/layer-state-template';
import {
  __resetLayerStoreForTesting,
  setLayers,
} from '../LayerStore';
import { __resetLayerStatePersistenceForTesting } from '../../services/layer-state-persistence';
import { createSceneLayer } from '../../types/entities';

function L(name: string, overrides: Partial<Parameters<typeof createSceneLayer>[0]> = {}) {
  return createSceneLayer({ name, ...overrides });
}

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetLayerStatePersistenceForTesting();
  __resetLayerStateStoreForTesting();
  try { window.localStorage.clear(); } catch { /* SSR */ }
});

describe('lifecycle', () => {
  it('starts idle', () => {
    expect(getLayerStateStoreSnapshot().hydrationStatus).toBe('idle');
    expect(getLayerStateStoreSnapshot().projectId).toBeNull();
  });

  it('setProjectId hydrates to ready', () => {
    setProjectId('p1');
    expect(getLayerStateStoreSnapshot().hydrationStatus).toBe('ready');
    expect(getLayerStateStoreSnapshot().projectId).toBe('p1');
  });

  it('clearProject resets to idle', () => {
    setProjectId('p1');
    clearProject();
    expect(getLayerStateStoreSnapshot().hydrationStatus).toBe('idle');
    expect(getLayerStateStoreSnapshot().projectId).toBeNull();
  });

  it('switching projects detaches previous listener', () => {
    setLayers([L('A')]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 's1' });
    expect(listLayerStates()).toHaveLength(1);
    setProjectId('p2');
    expect(listLayerStates()).toHaveLength(0);
  });
});

describe('saveCurrentLayerState', () => {
  beforeEach(() => {
    setLayers([L('A', { color: '#ff0000' }), L('B')]);
    setProjectId('p1', 'user-1');
  });

  it('returns null without a project', () => {
    clearProject();
    expect(saveCurrentLayerState({ name: 's1' })).toBeNull();
  });

  it('captures every layer into snapshot', () => {
    const state = saveCurrentLayerState({ name: 'baseline' });
    expect(state).not.toBeNull();
    expect(state!.snapshot).toHaveLength(2);
    expect(state!.snapshot.map((e) => e.layerName).sort()).toEqual(['A', 'B']);
    expect(state!.createdByUserId).toBe('user-1');
    expect(state!.source).toBe('user-created');
    expect(state!.id).toMatch(/^lst_/);
  });

  it('persists across hydrate (read-back via store)', () => {
    saveCurrentLayerState({ name: 's1' });
    expect(listLayerStates().map((s) => s.name)).toEqual(['s1']);
  });
});

describe('renameLayerState', () => {
  beforeEach(() => {
    setLayers([L('A')]);
    setProjectId('p1');
  });

  it('renames in place and bumps updatedAt', () => {
    const created = saveCurrentLayerState({ name: 'old' })!;
    const renamed = renameLayerState(created.id, 'new');
    expect(renamed).not.toBeNull();
    expect(renamed!.name).toBe('new');
    expect(renamed!.updatedAt >= created.updatedAt).toBe(true);
    expect(listLayerStates()[0].name).toBe('new');
  });

  it('no-op on unknown id', () => {
    expect(renameLayerState('missing', 'x')).toBeNull();
  });

  it('rejects empty trimmed name via trimmed empty-string check from hook layer (store accepts raw)', () => {
    const created = saveCurrentLayerState({ name: 'old' })!;
    const renamed = renameLayerState(created.id, '   ');
    expect(renamed).not.toBeNull();
    expect(renamed!.name).toBe('   ');
  });
});

describe('deleteLayerStateById', () => {
  beforeEach(() => {
    setLayers([L('A')]);
    setProjectId('p1');
  });

  it('removes the state', () => {
    const created = saveCurrentLayerState({ name: 's1' })!;
    deleteLayerStateById(created.id);
    expect(getLayerState(created.id)).toBeNull();
  });

  it('clears currentStateId if it pointed to the deleted state', () => {
    const created = saveCurrentLayerState({ name: 's1' })!;
    markCurrentLayerState(created.id);
    expect(getLayerStateStoreSnapshot().currentStateId).toBe(created.id);
    deleteLayerStateById(created.id);
    expect(getLayerStateStoreSnapshot().currentStateId).toBeNull();
  });
});

describe('markCurrentLayerState', () => {
  beforeEach(() => {
    setLayers([L('A')]);
    setProjectId('p1');
  });

  it('ignores unknown id', () => {
    markCurrentLayerState('missing');
    expect(getLayerStateStoreSnapshot().currentStateId).toBeNull();
  });

  it('accepts null clear', () => {
    const created = saveCurrentLayerState({ name: 's1' })!;
    markCurrentLayerState(created.id);
    markCurrentLayerState(null);
    expect(getLayerStateStoreSnapshot().currentStateId).toBeNull();
  });
});

describe('captureCurrentSnapshot', () => {
  it('mirrors the live LayerStore', () => {
    setLayers([L('A', { visible: false, frozen: true })]);
    const snapshot = captureCurrentSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].layerName).toBe('A');
    expect(snapshot[0].visible).toBe(false);
    expect(snapshot[0].frozen).toBe(true);
  });

  it('empty when no layers loaded', () => {
    expect(captureCurrentSnapshot()).toEqual([]);
  });
});

describe('subscribe', () => {
  it('fires on save + delete', () => {
    setLayers([L('A')]);
    setProjectId('p1');
    let count = 0;
    const unsub = subscribeLayerStateStore(() => { count += 1; });
    const created = saveCurrentLayerState({ name: 's1' })!;
    deleteLayerStateById(created.id);
    expect(count).toBeGreaterThanOrEqual(2);
    unsub();
  });
});

// ─── Phase 13B.2 — cross-project templates ──────────────────────────────────

function makeTemplate(overrides: Partial<LayerStateTemplate> = {}): LayerStateTemplate {
  return {
    id: 'lstpl_test0000000000000000000',
    companyId: 'comp_test0000000000000000',
    name: 'Tpl',
    description: undefined,
    category: 'mep',
    tags: [],
    snapshot: [],
    sourceStateId: undefined,
    createdBy: 'usr_test0000000000000000',
    createdAt: '2026-05-17T00:00:00.000Z',
    updatedBy: 'usr_test0000000000000000',
    updatedAt: '2026-05-17T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function makeServiceMock(): {
  service: DxfLayerStateTemplateService;
  saveAsTemplate: jest.Mock<Promise<LayerStateTemplate>, [SaveAsTemplateInput]>;
  getTemplate: jest.Mock<Promise<LayerStateTemplate>, [string]>;
  listTemplateSummaries: jest.Mock<
    Promise<readonly LayerStateTemplateSummary[]>,
    [SearchTemplatesQuery?]
  >;
} {
  const saveAsTemplate = jest.fn<Promise<LayerStateTemplate>, [SaveAsTemplateInput]>();
  const getTemplate = jest.fn<Promise<LayerStateTemplate>, [string]>();
  const listTemplateSummaries =
    jest.fn<Promise<readonly LayerStateTemplateSummary[]>, [SearchTemplatesQuery?]>();
  const stub = {
    saveAsTemplate,
    getTemplate,
    listTemplateSummaries,
  } as unknown as DxfLayerStateTemplateService;
  return { service: stub, saveAsTemplate, getTemplate, listTemplateSummaries };
}

describe('saveCurrentAsTemplate', () => {
  beforeEach(() => {
    setLayers([L('A'), L('B')]);
    setProjectId('p1', 'user-1');
  });

  it('throws when no service is injected', async () => {
    await expect(
      saveCurrentAsTemplate({ name: 'T' }),
    ).rejects.toThrow(/no template service injected/);
  });

  it('captures the live LayerStore snapshot and forwards to the service', async () => {
    const { service, saveAsTemplate } = makeServiceMock();
    const expected = makeTemplate({ name: 'MEP' });
    saveAsTemplate.mockResolvedValue(expected);
    setLayerStateTemplateService(service);

    const result = await saveCurrentAsTemplate({
      name: 'MEP',
      category: 'mep',
      tags: ['hvac'],
      sourceStateId: 'lst_src',
    });

    expect(saveAsTemplate).toHaveBeenCalledTimes(1);
    const call = saveAsTemplate.mock.calls[0][0];
    expect(call.name).toBe('MEP');
    expect(call.category).toBe('mep');
    expect(call.tags).toEqual(['hvac']);
    expect(call.sourceStateId).toBe('lst_src');
    expect(call.snapshot).toHaveLength(2);
    expect(call.snapshot.map((e) => e.layerName).sort()).toEqual(['A', 'B']);
    expect(result).toBe(expected);
  });
});

describe('importTemplateAsState', () => {
  beforeEach(() => {
    setLayers([L('A')]);
  });

  it('returns null when no project is attached', async () => {
    const { service, getTemplate } = makeServiceMock();
    setLayerStateTemplateService(service);
    const result = await importTemplateAsState('lstpl_x');
    expect(result).toBeNull();
    expect(getTemplate).not.toHaveBeenCalled();
  });

  it('throws when no service is injected', async () => {
    setProjectId('p1');
    await expect(importTemplateAsState('lstpl_x')).rejects.toThrow(
      /no template service injected/,
    );
  });

  it('clones the template snapshot into a project-local LayerState with template-shared source', async () => {
    setProjectId('p1', 'user-1');
    const { service, getTemplate } = makeServiceMock();
    getTemplate.mockResolvedValue(
      makeTemplate({
        id: 'lstpl_clone',
        name: 'Clone Me',
        description: 'reusable',
        snapshot: [
          {
            layerId: 'L-A',
            layerName: 'A',
            visible: true,
            frozen: false,
            locked: false,
            color: '#fff',
            colorTrueColor: null,
            linetype: 'Continuous',
            lineweight: -3,
            transparency: 0,
            plottable: true,
          },
        ],
      }),
    );
    setLayerStateTemplateService(service);

    const cloned = await importTemplateAsState('lstpl_clone');
    expect(cloned).not.toBeNull();
    expect(cloned!.source).toBe('template-shared');
    expect(cloned!.sourceTemplateId).toBe('lstpl_clone');
    expect(cloned!.name).toBe('Clone Me');
    expect(cloned!.description).toBe('reusable');
    expect(cloned!.createdByUserId).toBe('user-1');
    expect(cloned!.snapshot).toHaveLength(1);
    expect(listLayerStates()).toHaveLength(1);
    expect(listLayerStates()[0].id).toBe(cloned!.id);
  });
});

describe('searchTemplateSummaries', () => {
  it('throws when no service is injected', async () => {
    await expect(searchTemplateSummaries()).rejects.toThrow(
      /no template service injected/,
    );
  });

  it('forwards the query to the injected service and returns its result', async () => {
    const { service, listTemplateSummaries } = makeServiceMock();
    const summaries: readonly LayerStateTemplateSummary[] = [
      {
        id: 'lstpl_a',
        companyId: 'comp_x',
        name: 'A',
        category: 'mep',
        tags: ['hvac'],
        entryCount: 3,
        createdBy: 'usr',
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
    ];
    listTemplateSummaries.mockResolvedValue(summaries);
    setLayerStateTemplateService(service);

    const out = await searchTemplateSummaries({ category: 'mep', tags: ['hvac'] });
    expect(listTemplateSummaries).toHaveBeenCalledWith({
      category: 'mep',
      tags: ['hvac'],
    });
    expect(out).toBe(summaries);
  });
});

describe('setLayerStateTemplateService', () => {
  it('reset clears the injected service', () => {
    const { service } = makeServiceMock();
    setLayerStateTemplateService(service);
    expect(__getLayerStateTemplateServiceForTesting()).toBe(service);
    __resetLayerStateStoreForTesting();
    expect(__getLayerStateTemplateServiceForTesting()).toBeNull();
  });
});
