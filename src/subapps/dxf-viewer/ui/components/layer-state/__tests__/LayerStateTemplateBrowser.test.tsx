/**
 * LayerStateTemplateBrowser — RTL tests (ADR-358 Phase 13B.3).
 *
 * Covers:
 *   - loading skeleton (fetch pending)
 *   - empty state (fetch resolves to [])
 *   - list rendering (name + category badge + tags + entryCount)
 *   - search filter (debounced — fast-forwarded with jest fake timers)
 *   - category filter
 *   - tag chip filter
 *   - click "Use" → onUseTemplate + close
 *   - error mapping (CrossTenant, NotFound, generic)
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayerStateTemplateBrowser } from '../LayerStateTemplateBrowser';
import type {
  DxfTemplateCategory,
  LayerStateTemplateSummary,
} from '../../../../types/layer-state-template';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

function makeSummary(over: Partial<LayerStateTemplateSummary>): LayerStateTemplateSummary {
  return {
    id: over.id ?? 'lstpl_x',
    companyId: 'comp_test',
    name: 'X',
    description: undefined,
    category: 'mep',
    tags: [],
    entryCount: 0,
    createdBy: 'u',
    createdAt: '2026-05-17T00:00:00.000Z',
    updatedAt: '2026-05-17T00:00:00.000Z',
    ...over,
  };
}

function renderBrowser(over: {
  fetchSummaries?: jest.Mock;
  onUseTemplate?: jest.Mock;
  onOpenChange?: jest.Mock;
  categories?: readonly DxfTemplateCategory[];
} = {}) {
  const fetchSummaries =
    over.fetchSummaries ?? (jest.fn(async () => []) as unknown as jest.Mock);
  const onUseTemplate =
    over.onUseTemplate ?? (jest.fn(async () => undefined) as unknown as jest.Mock);
  const onOpenChange = over.onOpenChange ?? (jest.fn() as unknown as jest.Mock);
  const utils = render(
    <TooltipProvider>
      <LayerStateTemplateBrowser
        open={true}
        onOpenChange={onOpenChange as unknown as (next: boolean) => void}
        categories={over.categories ?? []}
        fetchSummaries={fetchSummaries as unknown as () => Promise<readonly LayerStateTemplateSummary[]>}
        onUseTemplate={onUseTemplate as unknown as (id: string) => Promise<unknown>}
      />
    </TooltipProvider>,
  );
  return { fetchSummaries, onUseTemplate, onOpenChange, ...utils };
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('LayerStateTemplateBrowser — fetch states', () => {
  it('shows loading skeleton while fetch pending', () => {
    const pending = new Promise<readonly LayerStateTemplateSummary[]>(() => {});
    const fetchSummaries = jest.fn(() => pending) as unknown as jest.Mock;
    renderBrowser({ fetchSummaries });
    expect(screen.getByTestId('layer-state-template-browser-loading')).toBeTruthy();
  });

  it('shows empty state when fetch resolves to []', async () => {
    const fetchSummaries = jest.fn(async () => []) as unknown as jest.Mock;
    renderBrowser({ fetchSummaries });
    await waitFor(() =>
      expect(screen.queryByTestId('layer-state-template-browser-empty')).not.toBeNull(),
    );
  });

  it('renders rows with name, category badge, tags, entryCount', async () => {
    const summaries: readonly LayerStateTemplateSummary[] = [
      makeSummary({ id: 'a', name: 'Alpha', category: 'mep', tags: ['hvac'], entryCount: 7 }),
    ];
    const fetchSummaries = jest.fn(async () => summaries) as unknown as jest.Mock;
    renderBrowser({ fetchSummaries });
    const row = await screen.findByTestId('layer-state-template-browser-row-a');
    expect(row.textContent).toContain('Alpha');
    expect(row.textContent).toContain('mep');
    expect(row.textContent).toContain('hvac');
    expect(row.textContent).toContain('7'); // entryCount interpolation
  });
});

describe('LayerStateTemplateBrowser — filters', () => {
  it('filters by search (debounced)', async () => {
    const summaries: readonly LayerStateTemplateSummary[] = [
      makeSummary({ id: 'a', name: 'Alpha' }),
      makeSummary({ id: 'b', name: 'Beta' }),
    ];
    const fetchSummaries = jest.fn(async () => summaries) as unknown as jest.Mock;
    renderBrowser({ fetchSummaries });
    await waitFor(() =>
      expect(screen.queryByTestId('layer-state-template-browser-row-a')).not.toBeNull(),
    );

    fireEvent.change(screen.getByTestId('layer-state-template-browser-search'), {
      target: { value: 'beta' },
    });
    // Search applies after 150ms debounce.
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId('layer-state-template-browser-row-a')).toBeNull();
    expect(screen.queryByTestId('layer-state-template-browser-row-b')).not.toBeNull();
  });

  it('filters by category', async () => {
    const summaries: readonly LayerStateTemplateSummary[] = [
      makeSummary({ id: 'a', name: 'A', category: 'mep' }),
      makeSummary({ id: 'b', name: 'B', category: 'structural' }),
    ];
    const fetchSummaries = jest.fn(async () => summaries) as unknown as jest.Mock;
    renderBrowser({ fetchSummaries });
    await waitFor(() =>
      expect(screen.queryByTestId('layer-state-template-browser-row-a')).not.toBeNull(),
    );
    fireEvent.change(screen.getByTestId('layer-state-template-browser-category'), {
      target: { value: 'structural' },
    });
    expect(screen.queryByTestId('layer-state-template-browser-row-a')).toBeNull();
    expect(screen.queryByTestId('layer-state-template-browser-row-b')).not.toBeNull();
  });

  it('filters by tag chip (AND of all selected tags)', async () => {
    const summaries: readonly LayerStateTemplateSummary[] = [
      makeSummary({ id: 'a', name: 'A', tags: ['hvac'] }),
      makeSummary({ id: 'b', name: 'B', tags: ['hvac', 'electrical'] }),
    ];
    const fetchSummaries = jest.fn(async () => summaries) as unknown as jest.Mock;
    renderBrowser({ fetchSummaries });
    await waitFor(() =>
      expect(screen.queryByTestId('layer-state-template-browser-row-a')).not.toBeNull(),
    );
    const tagInput = screen.getByTestId('layer-state-template-browser-tag-input');
    fireEvent.change(tagInput, { target: { value: 'electrical' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    expect(screen.queryByTestId('layer-state-template-browser-row-a')).toBeNull();
    expect(screen.queryByTestId('layer-state-template-browser-row-b')).not.toBeNull();
  });

  it('shows noResults when filters match nothing', async () => {
    const summaries: readonly LayerStateTemplateSummary[] = [
      makeSummary({ id: 'a', name: 'Alpha' }),
    ];
    const fetchSummaries = jest.fn(async () => summaries) as unknown as jest.Mock;
    renderBrowser({ fetchSummaries });
    await waitFor(() =>
      expect(screen.queryByTestId('layer-state-template-browser-row-a')).not.toBeNull(),
    );
    fireEvent.change(screen.getByTestId('layer-state-template-browser-search'), {
      target: { value: 'zzz' },
    });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId('layer-state-template-browser-no-results')).not.toBeNull();
  });
});

describe('LayerStateTemplateBrowser — use template', () => {
  it('calls onUseTemplate(id) and closes on success', async () => {
    const summaries: readonly LayerStateTemplateSummary[] = [
      makeSummary({ id: 'a', name: 'Alpha' }),
    ];
    const fetchSummaries = jest.fn(async () => summaries) as unknown as jest.Mock;
    const onUseTemplate = jest.fn(async () => undefined) as unknown as jest.Mock;
    const onOpenChange = jest.fn() as unknown as jest.Mock;
    renderBrowser({ fetchSummaries, onUseTemplate, onOpenChange });
    const useBtn = await screen.findByTestId('layer-state-template-browser-use-a');
    await act(async () => {
      fireEvent.click(useBtn);
    });
    expect(onUseTemplate).toHaveBeenCalledWith('a');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does NOT close on CrossTenant error', async () => {
    const summaries: readonly LayerStateTemplateSummary[] = [
      makeSummary({ id: 'a', name: 'Alpha' }),
    ];
    const fetchSummaries = jest.fn(async () => summaries) as unknown as jest.Mock;
    const onUseTemplate = jest.fn(async () => {
      const e = new Error('cross');
      e.name = 'LayerStateTemplateCrossTenantError';
      throw e;
    }) as unknown as jest.Mock;
    const onOpenChange = jest.fn() as unknown as jest.Mock;
    renderBrowser({ fetchSummaries, onUseTemplate, onOpenChange });
    const useBtn = await screen.findByTestId('layer-state-template-browser-use-a');
    await act(async () => {
      fireEvent.click(useBtn);
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('does NOT close on NotFound error', async () => {
    const summaries: readonly LayerStateTemplateSummary[] = [
      makeSummary({ id: 'a', name: 'Alpha' }),
    ];
    const fetchSummaries = jest.fn(async () => summaries) as unknown as jest.Mock;
    const onUseTemplate = jest.fn(async () => {
      const e = new Error('nf');
      e.name = 'LayerStateTemplateNotFoundError';
      throw e;
    }) as unknown as jest.Mock;
    const onOpenChange = jest.fn() as unknown as jest.Mock;
    renderBrowser({ fetchSummaries, onUseTemplate, onOpenChange });
    const useBtn = await screen.findByTestId('layer-state-template-browser-use-a');
    await act(async () => {
      fireEvent.click(useBtn);
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe('LayerStateTemplateBrowser — category dropdown options', () => {
  it('includes preset categories and supplied categories', async () => {
    const fetchSummaries = jest.fn(async () => []) as unknown as jest.Mock;
    renderBrowser({
      fetchSummaries,
      categories: [
        {
          id: 'c1',
          companyId: 'c',
          value: 'landscape',
          createdBy: 'u',
          createdAt: '2026-05-17T00:00:00.000Z',
        },
      ],
    });
    const select = screen.getByTestId('layer-state-template-browser-category') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain(''); // categoryFilterAll
    expect(values).toContain('architectural');
    expect(values).toContain('mep');
    expect(values).toContain('landscape');
  });
});
