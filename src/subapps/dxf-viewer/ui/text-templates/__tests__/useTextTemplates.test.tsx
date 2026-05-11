/**
 * ADR-344 Phase 7.D — List fetch + cache behaviour.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTextTemplates } from '../hooks/useTextTemplates';
import { clearCachedUserTemplates } from '../hooks/template-cache';

const COMPANY_ID = 'company_test_42';

const wireTemplate = {
  id: 'tpl_text_one',
  companyId: COMPANY_ID,
  name: 'Sample',
  category: 'custom' as const,
  content: {
    paragraphs: [],
    attachment: 'TL' as const,
    lineSpacing: { mode: 'multiple' as const, factor: 1 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  },
  placeholders: [],
  isDefault: false as const,
  createdAt: '2026-05-11T00:00:00Z',
  updatedAt: '2026-05-11T00:00:00Z',
  createdBy: 'u1',
  createdByName: null,
  updatedBy: 'u1',
  updatedByName: null,
};

beforeEach(() => {
  clearCachedUserTemplates(COMPANY_ID);
  global.fetch = jest.fn();
});

describe('useTextTemplates', () => {
  it('returns built-ins synchronously and fetches user templates', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, templates: [wireTemplate] }),
    });
    const { result } = renderHook(() => useTextTemplates(COMPANY_ID));
    expect(result.current.builtIn.length).toBeGreaterThan(0);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toHaveLength(1);
    expect(result.current.user[0].id).toBe('tpl_text_one');
    expect(result.current.all.length).toBe(result.current.builtIn.length + 1);
  });

  it('surfaces fetch errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'boom' }),
    });
    const { result } = renderHook(() => useTextTemplates(COMPANY_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('boom');
  });

  it('refresh re-fetches the list', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, templates: [] }),
    });
    const { result } = renderHook(() => useTextTemplates(COMPANY_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.refresh();
    });
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
  });

  it('returns empty user list and skips fetch when companyId is null', async () => {
    const { result } = renderHook(() => useTextTemplates(null));
    expect(result.current.user).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
