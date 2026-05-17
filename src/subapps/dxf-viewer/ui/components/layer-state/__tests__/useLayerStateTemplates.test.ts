/**
 * useLayerStateTemplates hook tests — ADR-358 §5.9 Q12 Phase 13B.2.
 *
 * Covers:
 *   - isReady gating on companyId / userId presence
 *   - service injection into LayerStateStore on mount + clear on unmount
 *   - service rebuild when companyId / userId change
 *   - initial categories fetch on mount
 *   - hash-compare guard: identical category content → no setState (ADR-040 §XV)
 *   - refreshCategories re-fetches and updates only when hash differs
 *   - saveCurrentAsTemplate forwards to store + refreshes categories
 *   - searchTemplateSummaries forwards to store
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useLayerStateTemplates } from '../useLayerStateTemplates';
import {
  __getLayerStateTemplateServiceForTesting,
  __resetLayerStateStoreForTesting,
  setProjectId,
} from '../../../../stores/LayerStateStore';
import { __resetLayerStoreForTesting, setLayers } from '../../../../stores/LayerStore';
import { __resetLayerStatePersistenceForTesting } from '../../../../services/layer-state-persistence';
import { createSceneLayer } from '../../../../types/entities';
import type {
  DxfLayerStateTemplateService,
  SaveAsTemplateInput,
  SearchTemplatesQuery,
} from '@/services/dxf-layer-state-template.service';
import type {
  DxfTemplateCategory,
  LayerStateTemplate,
  LayerStateTemplateSummary,
} from '../../../../types/layer-state-template';

interface MockHandle {
  readonly service: DxfLayerStateTemplateService;
  readonly listCategories: jest.Mock<Promise<readonly DxfTemplateCategory[]>, []>;
  readonly saveAsTemplate: jest.Mock<Promise<LayerStateTemplate>, [SaveAsTemplateInput]>;
  readonly getTemplate: jest.Mock<Promise<LayerStateTemplate>, [string]>;
  readonly listTemplateSummaries: jest.Mock<
    Promise<readonly LayerStateTemplateSummary[]>,
    [SearchTemplatesQuery?]
  >;
}

function makeService(): MockHandle {
  const listCategories = jest.fn<Promise<readonly DxfTemplateCategory[]>, []>();
  const saveAsTemplate = jest.fn<Promise<LayerStateTemplate>, [SaveAsTemplateInput]>();
  const getTemplate = jest.fn<Promise<LayerStateTemplate>, [string]>();
  const listTemplateSummaries =
    jest.fn<Promise<readonly LayerStateTemplateSummary[]>, [SearchTemplatesQuery?]>();
  const stub = {
    listCategories,
    saveAsTemplate,
    getTemplate,
    listTemplateSummaries,
  } as unknown as DxfLayerStateTemplateService;
  return { service: stub, listCategories, saveAsTemplate, getTemplate, listTemplateSummaries };
}

function makeCategory(id: string, value: string): DxfTemplateCategory {
  return {
    id,
    companyId: 'comp_test',
    value,
    createdBy: 'usr_test',
    createdAt: '2026-05-17T00:00:00.000Z',
  };
}

function makeTemplate(over: Partial<LayerStateTemplate> = {}): LayerStateTemplate {
  return {
    id: 'lstpl_test',
    companyId: 'comp_test',
    name: 'T',
    description: undefined,
    category: 'mep',
    tags: [],
    snapshot: [],
    sourceStateId: undefined,
    createdBy: 'usr_test',
    createdAt: '2026-05-17T00:00:00.000Z',
    updatedBy: 'usr_test',
    updatedAt: '2026-05-17T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetLayerStatePersistenceForTesting();
  __resetLayerStateStoreForTesting();
  try { window.localStorage.clear(); } catch { /* SSR */ }
});

// ─── isReady gating ───────────────────────────────────────────────────────────

describe('isReady gating', () => {
  it('stays false when companyId is empty', () => {
    const handle = makeService();
    const { result } = renderHook(() =>
      useLayerStateTemplates(
        { companyId: '', userId: 'usr_x' },
        { serviceFactory: () => handle.service },
      ),
    );
    expect(result.current.isReady).toBe(false);
    expect(__getLayerStateTemplateServiceForTesting()).toBeNull();
  });

  it('stays false when userId is empty', () => {
    const handle = makeService();
    const { result } = renderHook(() =>
      useLayerStateTemplates(
        { companyId: 'comp_x', userId: '' },
        { serviceFactory: () => handle.service },
      ),
    );
    expect(result.current.isReady).toBe(false);
    expect(__getLayerStateTemplateServiceForTesting()).toBeNull();
  });
});

// ─── Service lifecycle ────────────────────────────────────────────────────────

describe('service lifecycle', () => {
  it('injects the service into LayerStateStore on mount and clears on unmount', async () => {
    const handle = makeService();
    handle.listCategories.mockResolvedValue([]);
    const { result, unmount } = renderHook(() =>
      useLayerStateTemplates(
        { companyId: 'comp_x', userId: 'usr_x' },
        { serviceFactory: () => handle.service },
      ),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(__getLayerStateTemplateServiceForTesting()).toBe(handle.service);

    unmount();
    expect(__getLayerStateTemplateServiceForTesting()).toBeNull();
  });

  it('rebuilds the service when companyId changes', async () => {
    const factory = jest.fn((cfg: { companyId: string; userId: string }) => {
      const h = makeService();
      h.listCategories.mockResolvedValue([]);
      // Tag the service so we can identify which one was injected.
      (h.service as unknown as { __cfg: typeof cfg }).__cfg = cfg;
      return h.service;
    });
    const { result, rerender } = renderHook(
      (props: { companyId: string; userId: string }) =>
        useLayerStateTemplates(props, { serviceFactory: factory }),
      { initialProps: { companyId: 'comp_a', userId: 'usr_x' } },
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    const first = __getLayerStateTemplateServiceForTesting();
    expect((first as unknown as { __cfg: { companyId: string } }).__cfg.companyId).toBe(
      'comp_a',
    );

    rerender({ companyId: 'comp_b', userId: 'usr_x' });
    await waitFor(() => {
      const next = __getLayerStateTemplateServiceForTesting();
      expect(next).not.toBe(first);
      expect((next as unknown as { __cfg: { companyId: string } }).__cfg.companyId).toBe(
        'comp_b',
      );
    });
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

// ─── Categories: initial fetch + hash guard ──────────────────────────────────

describe('categories fetch + hash-compare', () => {
  it('fetches categories on mount', async () => {
    const handle = makeService();
    handle.listCategories.mockResolvedValue([makeCategory('c1', 'mep')]);
    const { result } = renderHook(() =>
      useLayerStateTemplates(
        { companyId: 'comp_x', userId: 'usr_x' },
        { serviceFactory: () => handle.service },
      ),
    );
    await waitFor(() => expect(result.current.categories).toHaveLength(1));
    expect(result.current.categories[0].value).toBe('mep');
    expect(handle.listCategories).toHaveBeenCalledTimes(1);
  });

  it('does not change the categories array ref when content is identical', async () => {
    const handle = makeService();
    const initial = [makeCategory('c1', 'mep')];
    // Two distinct array references with the same shape — hash must match.
    handle.listCategories
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce([makeCategory('c1', 'mep')]);
    const { result } = renderHook(() =>
      useLayerStateTemplates(
        { companyId: 'comp_x', userId: 'usr_x' },
        { serviceFactory: () => handle.service },
      ),
    );
    await waitFor(() => expect(result.current.categories).toHaveLength(1));
    const before = result.current.categories;
    await act(async () => {
      await result.current.refreshCategories();
    });
    expect(result.current.categories).toBe(before);
  });

  it('replaces the categories array when content differs', async () => {
    const handle = makeService();
    handle.listCategories
      .mockResolvedValueOnce([makeCategory('c1', 'mep')])
      .mockResolvedValueOnce([
        makeCategory('c1', 'mep'),
        makeCategory('c2', 'landscape'),
      ]);
    const { result } = renderHook(() =>
      useLayerStateTemplates(
        { companyId: 'comp_x', userId: 'usr_x' },
        { serviceFactory: () => handle.service },
      ),
    );
    await waitFor(() => expect(result.current.categories).toHaveLength(1));
    const before = result.current.categories;
    await act(async () => {
      await result.current.refreshCategories();
    });
    expect(result.current.categories).not.toBe(before);
    expect(result.current.categories.map((c) => c.value)).toEqual(['mep', 'landscape']);
  });
});

// ─── Store proxies ────────────────────────────────────────────────────────────

describe('saveCurrentAsTemplate proxy', () => {
  it('captures snapshot via the store and refreshes categories afterwards', async () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    const handle = makeService();
    handle.listCategories
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeCategory('c1', 'mep')]);
    handle.saveAsTemplate.mockResolvedValue(makeTemplate({ name: 'New' }));

    const { result } = renderHook(() =>
      useLayerStateTemplates(
        { companyId: 'comp_x', userId: 'usr_x' },
        { serviceFactory: () => handle.service },
      ),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let created: LayerStateTemplate | undefined;
    await act(async () => {
      created = await result.current.saveCurrentAsTemplate({ name: 'New', category: 'mep' });
    });
    expect(created?.name).toBe('New');
    const call = handle.saveAsTemplate.mock.calls[0][0];
    expect(call.snapshot).toHaveLength(1);
    expect(call.snapshot[0].layerName).toBe('A');
    await waitFor(() => expect(result.current.categories).toHaveLength(1));
  });
});

describe('importTemplateAsState proxy', () => {
  it('clones the template into a project-local LayerState', async () => {
    setProjectId('p1', 'usr_x');
    const handle = makeService();
    handle.listCategories.mockResolvedValue([]);
    handle.getTemplate.mockResolvedValue(
      makeTemplate({
        id: 'lstpl_clone',
        name: 'Clone',
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
    const { result } = renderHook(() =>
      useLayerStateTemplates(
        { companyId: 'comp_x', userId: 'usr_x' },
        { serviceFactory: () => handle.service },
      ),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let cloned: unknown;
    await act(async () => {
      cloned = await result.current.importTemplateAsState('lstpl_clone');
    });
    expect(cloned).not.toBeNull();
    expect(handle.getTemplate).toHaveBeenCalledWith('lstpl_clone');
  });
});

describe('searchTemplateSummaries proxy', () => {
  it('forwards the query and returns the service result', async () => {
    const handle = makeService();
    handle.listCategories.mockResolvedValue([]);
    const summaries: readonly LayerStateTemplateSummary[] = [
      {
        id: 'lstpl_a',
        companyId: 'comp_x',
        name: 'A',
        category: 'mep',
        tags: ['hvac'],
        entryCount: 2,
        createdBy: 'usr_x',
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
    ];
    handle.listTemplateSummaries.mockResolvedValue(summaries);
    const { result } = renderHook(() =>
      useLayerStateTemplates(
        { companyId: 'comp_x', userId: 'usr_x' },
        { serviceFactory: () => handle.service },
      ),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let out: readonly LayerStateTemplateSummary[] | undefined;
    await act(async () => {
      out = await result.current.searchTemplateSummaries({ category: 'mep' });
    });
    expect(out).toBe(summaries);
    expect(handle.listTemplateSummaries).toHaveBeenCalledWith({ category: 'mep' });
  });
});
