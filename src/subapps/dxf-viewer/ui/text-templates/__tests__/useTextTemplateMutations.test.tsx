/**
 * ADR-344 Phase 7.D — Optimistic mutations behaviour.
 *
 * Verifies the contract:
 *   - create / update / delete apply optimistic mutations immediately
 *   - on a 2xx response, the optimistic placeholder is replaced with the
 *     server-side document
 *   - on a non-2xx response (or fetch reject), the original snapshot is
 *     restored AND the error surfaces as `TemplateMutationError`
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  useTextTemplateMutations,
  TemplateMutationError,
} from '../hooks/useTextTemplateMutations';
import type { TextTemplate } from '@/subapps/dxf-viewer/text-engine/templates';
import type { SerializedUserTextTemplate } from '../shared/serialized-template.types';

const noopContent: TextTemplate['content'] = {
  paragraphs: [],
  attachment: 'TL',
  lineSpacing: { mode: 'multiple', factor: 1 },
  rotation: 0,
  isAnnotative: false,
  annotationScales: [],
  currentScale: '',
};

const existingTemplate: TextTemplate = {
  id: 'tpl_text_existing',
  companyId: 'company_42',
  name: 'Existing',
  category: 'custom',
  content: noopContent,
  placeholders: [],
  isDefault: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function makeWire(overrides: Partial<SerializedUserTextTemplate> = {}): SerializedUserTextTemplate {
  return {
    id: 'tpl_text_new',
    companyId: 'company_42',
    name: 'New One',
    category: 'custom',
    content: noopContent,
    placeholders: [],
    isDefault: false,
    createdAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-05-11T00:00:00.000Z',
    createdBy: 'user_1',
    createdByName: 'tester@example.com',
    updatedBy: 'user_1',
    updatedByName: 'tester@example.com',
    ...overrides,
  };
}

interface Harness {
  readonly setUserTemplates: jest.Mock;
}

function createHarness(initial: readonly TextTemplate[]): Harness & {
  result: ReturnType<typeof useTextTemplateMutations>;
} {
  const setUserTemplates = jest.fn();
  const { result } = renderHook(() =>
    useTextTemplateMutations({
      userTemplates: initial,
      setUserTemplates,
    }),
  );
  return { setUserTemplates, result: result.current };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('useTextTemplateMutations.createTemplate', () => {
  it('applies optimistic then reconciles with server response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, template: makeWire() }),
    });
    const harness = createHarness([]);
    await act(async () => {
      await harness.result.createTemplate({
        name: 'New',
        category: 'custom',
        content: noopContent,
      });
    });
    expect(harness.setUserTemplates).toHaveBeenCalledTimes(2);
    const last = harness.setUserTemplates.mock.calls[1][0] as TextTemplate[];
    expect(last).toHaveLength(1);
    expect(last[0].id).toBe('tpl_text_new');
  });

  it('rolls back snapshot when the API returns 400', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: 'bad', code: 'X' }),
    });
    const harness = createHarness([]);
    await act(async () => {
      await expect(
        harness.result.createTemplate({
          name: 'Bad',
          category: 'custom',
          content: noopContent,
        }),
      ).rejects.toBeInstanceOf(TemplateMutationError);
    });
    const restore = harness.setUserTemplates.mock.calls.at(-1)?.[0];
    expect(restore).toEqual([]);
  });
});

describe('useTextTemplateMutations.deleteTemplate', () => {
  it('removes optimistically and rolls back on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'boom' }),
    });
    const harness = createHarness([existingTemplate]);
    await act(async () => {
      await expect(harness.result.deleteTemplate(existingTemplate.id)).rejects.toBeInstanceOf(
        TemplateMutationError,
      );
    });
    const calls = harness.setUserTemplates.mock.calls;
    expect(calls[0][0]).toEqual([]);
    expect(calls[1][0]).toEqual([existingTemplate]);
  });
});

describe('useTextTemplateMutations.duplicateTemplate', () => {
  it('creates a new template with " (copy)" suffix', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, template: makeWire({ name: 'Existing (copy)' }) }),
    });
    const harness = createHarness([existingTemplate]);
    await act(async () => {
      await harness.result.duplicateTemplate(existingTemplate);
    });
    const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(fetchBody.name).toBe('Existing (copy)');
  });
});
