/**
 * LayerStateSaveAsTemplateDialog — RTL tests (ADR-358 Phase 13B.3).
 *
 * Covers:
 *   - form validation (empty name disables submit)
 *   - submit forwards payload to onSave (name trim, tags array, sourceStateId pass-through)
 *   - datalist exposes PRESET_CATEGORIES + supplied categories
 *   - tags chip-input add/remove + 10-tag limit
 *   - error rendering: LayerStateTemplateValidationError variants
 *   - generic error renders errorSave key
 *   - success closes dialog (onOpenChange(false))
 */

import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayerStateSaveAsTemplateDialog } from '../LayerStateSaveAsTemplateDialog';
import type { DxfTemplateCategory, LayerStateTemplate } from '../../../../types/layer-state-template';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

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
    createdBy: 'u',
    createdAt: '2026-05-17T00:00:00.000Z',
    updatedBy: 'u',
    updatedAt: '2026-05-17T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

function renderDialog(over: {
  onSave?: jest.Mock;
  onOpenChange?: jest.Mock;
  sourceStateId?: string;
  categories?: readonly DxfTemplateCategory[];
} = {}) {
  const onSave =
    over.onSave ??
    (jest.fn(async () => makeTemplate({ name: 'Saved' })) as unknown as jest.Mock);
  const onOpenChange = over.onOpenChange ?? (jest.fn() as unknown as jest.Mock);
  const utils = render(
    <TooltipProvider>
      <LayerStateSaveAsTemplateDialog
        open={true}
        onOpenChange={onOpenChange as unknown as (next: boolean) => void}
        categories={over.categories ?? []}
        sourceStateId={over.sourceStateId}
        onSave={onSave as unknown as (input: unknown) => Promise<LayerStateTemplate>}
      />
    </TooltipProvider>,
  );
  return { onSave, onOpenChange, ...utils };
}

describe('LayerStateSaveAsTemplateDialog — validation', () => {
  it('disables submit when name is empty', () => {
    renderDialog();
    const submit = screen.getByTestId('layer-state-save-as-template-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('enables submit once name is non-empty', () => {
    renderDialog();
    const name = screen.getByTestId('layer-state-save-as-template-name') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Plan A' } });
    const submit = screen.getByTestId('layer-state-save-as-template-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it('trims trailing whitespace before passing name to onSave', async () => {
    const { onSave } = renderDialog();
    fireEvent.change(screen.getByTestId('layer-state-save-as-template-name'), {
      target: { value: '  Plan B  ' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('layer-state-save-as-template-submit'));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = (onSave.mock.calls[0] as unknown as [{ name: string }])[0];
    expect(payload.name).toBe('Plan B');
  });
});

describe('LayerStateSaveAsTemplateDialog — datalist', () => {
  it('exposes preset + provided categories', () => {
    renderDialog({
      categories: [
        {
          id: 'cat1',
          companyId: 'c',
          value: 'landscape',
          createdBy: 'u',
          createdAt: '2026-05-17T00:00:00.000Z',
        },
      ],
    });
    // Radix Dialog portals into document.body — query the document, not container.
    const options = Array.from(
      document.querySelectorAll('datalist#layer-state-template-categories option'),
    ).map((o) => (o as HTMLOptionElement).value);
    expect(options).toContain('architectural');
    expect(options).toContain('mep');
    expect(options).toContain('custom');
    expect(options).toContain('landscape');
  });
});

describe('LayerStateSaveAsTemplateDialog — tags chip-input', () => {
  it('adds a tag on Enter and removes on chip remove click', () => {
    renderDialog();
    const tagInput = screen.getByTestId('layer-state-save-as-template-tag-input');
    fireEvent.change(tagInput, { target: { value: 'hvac' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    expect(screen.getByTestId('tag-chip-hvac')).toBeTruthy();
    fireEvent.click(screen.getByTestId('tag-chip-remove-hvac'));
    expect(screen.queryByTestId('tag-chip-hvac')).toBeNull();
  });

  it('prevents adding the same tag twice', () => {
    renderDialog();
    const tagInput = screen.getByTestId('layer-state-save-as-template-tag-input');
    fireEvent.change(tagInput, { target: { value: 'dup' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    fireEvent.change(tagInput, { target: { value: 'dup' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    const chips = screen
      .getByTestId('layer-state-save-as-template-tags-list')
      .querySelectorAll('[data-testid^="tag-chip-"]');
    // 1 tag chip + its remove button → 2 [data-testid^="tag-chip-"] hits, but
    // counting only the wrappers is sufficient via querySelector pattern below.
    const wrappers = Array.from(chips).filter((el) =>
      el.getAttribute('data-testid')!.startsWith('tag-chip-') &&
      !el.getAttribute('data-testid')!.startsWith('tag-chip-remove-'),
    );
    expect(wrappers).toHaveLength(1);
  });

  it('disables the input once 10 tags are added', () => {
    renderDialog();
    const tagInput = screen.getByTestId('layer-state-save-as-template-tag-input') as HTMLInputElement;
    for (let i = 0; i < 10; i++) {
      fireEvent.change(tagInput, { target: { value: `t${i}` } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });
    }
    expect(tagInput.disabled).toBe(true);
    expect(screen.getByTestId('layer-state-save-as-template-tags-limit')).toBeTruthy();
  });
});

describe('LayerStateSaveAsTemplateDialog — submit', () => {
  it('passes payload (incl. sourceStateId, tags) and closes on success', async () => {
    const onSave = jest.fn(async () => makeTemplate({ name: 'Plan A' })) as unknown as jest.Mock;
    const onOpenChange = jest.fn() as unknown as jest.Mock;
    renderDialog({ onSave, onOpenChange, sourceStateId: 'lst_source' });

    fireEvent.change(screen.getByTestId('layer-state-save-as-template-name'), {
      target: { value: 'Plan A' },
    });
    fireEvent.change(screen.getByTestId('layer-state-save-as-template-description'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByTestId('layer-state-save-as-template-category'), {
      target: { value: 'mep' },
    });
    const tagInput = screen.getByTestId('layer-state-save-as-template-tag-input');
    fireEvent.change(tagInput, { target: { value: 'hvac' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });

    await act(async () => {
      fireEvent.click(screen.getByTestId('layer-state-save-as-template-submit'));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = (onSave.mock.calls[0] as unknown as [{
      name: string;
      description?: string;
      category?: string;
      tags?: readonly string[];
      sourceStateId?: string;
    }])[0];
    expect(payload).toEqual({
      name: 'Plan A',
      description: 'short',
      category: 'mep',
      tags: ['hvac'],
      sourceStateId: 'lst_source',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('LayerStateSaveAsTemplateDialog — errors', () => {
  // Note: The jest.mock above intercepts '@/i18n' for the consumer component,
  // but real i18next still initializes via Radix Dialog internals (which import
  // useTranslation through a different alias). Asserting against real EN locale
  // text keeps the contract crisp without fragile mock-leak debugging.
  it('renders errorNameRequired when service throws NAME_REQUIRED', async () => {
    const onSave = jest.fn(async () => {
      throw new Error('LAYER_STATE_TEMPLATE_NAME_REQUIRED');
    }) as unknown as jest.Mock;
    renderDialog({ onSave });
    fireEvent.change(screen.getByTestId('layer-state-save-as-template-name'), {
      target: { value: 'X' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('layer-state-save-as-template-submit'));
    });
    const text = screen.getByTestId('layer-state-save-as-template-error').textContent ?? '';
    expect(
      text === 'layerState.templates.errorNameRequired' ||
        /name is required|όνομα είναι υποχρεωτικό/i.test(text),
    ).toBe(true);
  });

  it('renders errorEmptySnapshot when service throws EMPTY_SNAPSHOT', async () => {
    const onSave = jest.fn(async () => {
      throw new Error('LAYER_STATE_TEMPLATE_EMPTY_SNAPSHOT');
    }) as unknown as jest.Mock;
    renderDialog({ onSave });
    fireEvent.change(screen.getByTestId('layer-state-save-as-template-name'), {
      target: { value: 'X' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('layer-state-save-as-template-submit'));
    });
    const text = screen.getByTestId('layer-state-save-as-template-error').textContent ?? '';
    expect(
      text === 'layerState.templates.errorEmptySnapshot' ||
        /no layers to save|δεν υπάρχουν επίπεδα/i.test(text),
    ).toBe(true);
  });

  it('renders generic errorSave on unknown error', async () => {
    const onSave = jest.fn(async () => {
      throw new Error('boom');
    }) as unknown as jest.Mock;
    renderDialog({ onSave });
    fireEvent.change(screen.getByTestId('layer-state-save-as-template-name'), {
      target: { value: 'X' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('layer-state-save-as-template-submit'));
    });
    const text = screen.getByTestId('layer-state-save-as-template-error').textContent ?? '';
    expect(
      text === 'layerState.templates.errorSave' ||
        /failed to save template|αποτυχία αποθήκευσης/i.test(text),
    ).toBe(true);
  });
});

describe('LayerStateSaveAsTemplateDialog — cancel', () => {
  it('closes via cancel button', () => {
    const onOpenChange = jest.fn() as unknown as jest.Mock;
    renderDialog({ onOpenChange });
    fireEvent.click(screen.getByTestId('layer-state-save-as-template-cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
