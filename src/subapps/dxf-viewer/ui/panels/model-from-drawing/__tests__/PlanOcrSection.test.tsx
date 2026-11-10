/**
 * @jest-environment jsdom
 *
 * ADR-929 Φ0.6 — το τμήμα της τοπικής ανάγνωσης στο πάνελ (καθαρή παρουσίαση):
 *   · `idle` ⇒ τίποτα· `running` ⇒ στάδιο, πρόοδος, «Ακύρωση»· `done` ⇒ τι μετρά ή ότι μετρά η ανάγνωση AI·
 *   · `cancelled` / `failed` ⇒ μήνυμα με όνομα και «Ξανά»· κάθε κείμενο από ΡΗΤΟ κλειδί i18n.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import type { PlanOcrFailure, PlanOcrState } from '../../../../systems/plan-recognition/plan-recognition-store';
import { PlanOcrSection, type PlanOcrActions, type PlanOcrView } from '../PlanOcrSection';

const t = (key: string, params?: Record<string, string | number>): string => (params ? `${key}${JSON.stringify(params)}` : key);

function renderOcr(state: PlanOcrState, extra: Partial<Omit<PlanOcrView, 'state'>> = {}) {
  const actions: jest.Mocked<PlanOcrActions> = { onCancel: jest.fn(), onRetry: jest.fn() };
  const view: PlanOcrView = { state, inUse: extra.inUse ?? false, counts: extra.counts ?? null };
  return { ...render(<PlanOcrSection view={view} actions={actions} t={t} />), actions };
}

describe('PlanOcrSection (ADR-929 Φ0.6)', () => {
  it('idle ⇒ δεν εμφανίζεται τίποτα', () => {
    expect(renderOcr({ status: 'idle' }).container.textContent).toBe('');
  });

  it('running πριν την πρώτη αναφορά ⇒ «starting», χωρίς μετρητή· «Ακύρωση» καλεί onCancel μία φορά', () => {
    const { getByTestId, queryByText, actions } = renderOcr({ status: 'running', stage: null, done: 0, total: 0 });
    expect(getByTestId('mfd-ocr').getAttribute('data-status')).toBe('running');
    expect(getByTestId('mfd-ocr-running').getAttribute('data-stage')).toBe('starting');
    expect(getByTestId('mfd-ocr-running').textContent).toContain('modelFromDrawing.image.ocr.stage.starting');
    expect(queryByText(/modelFromDrawing\.image\.ocr\.progress\{/)).toBeNull();
    fireEvent.click(getByTestId('mfd-ocr-cancel'));
    expect(actions.onCancel).toHaveBeenCalledTimes(1);
    expect(actions.onRetry).not.toHaveBeenCalled();
  });

  it.each(['load', 'detect', 'read'] as const)('running στο στάδιο %s ⇒ το κλειδί του και «done από total»', (stage) => {
    const { getByTestId } = renderOcr({ status: 'running', stage, done: 3, total: 8 });
    const running = getByTestId('mfd-ocr-running');
    expect(running.getAttribute('data-stage')).toBe(stage);
    expect(running.textContent).toContain(`modelFromDrawing.image.ocr.stage.${stage}`);
    expect(running.textContent).toContain('modelFromDrawing.image.ocr.progress{"done":3,"total":8}');
    expect(getByTestId('mfd-ocr-progress').getAttribute('aria-label')).toBe('modelFromDrawing.image.ocr.progressLabel');
  });

  it('done και μετρά ⇒ τα πλήθη της τρέχουσας όψης', () => {
    const { getByTestId, queryByTestId } = renderOcr({ status: 'done' }, { inUse: true, counts: { texts: 12, dimensions: 5 } });
    expect(getByTestId('mfd-ocr-result').textContent).toContain('modelFromDrawing.image.ocr.result{"texts":12,"dimensions":5}');
    expect(queryByTestId('mfd-ocr-ai-preferred')).toBeNull();
    expect(queryByTestId('mfd-ocr-retry')).toBeNull();
  });

  it('done αλλά μετρά η ανάγνωση AI ⇒ το λέει, χωρίς πλήθη', () => {
    const { getByTestId, queryByTestId } = renderOcr({ status: 'done' }, { inUse: false, counts: null });
    expect(getByTestId('mfd-ocr-ai-preferred').textContent).toBe('modelFromDrawing.image.ocr.aiPreferred');
    expect(queryByTestId('mfd-ocr-result')).toBeNull();
  });

  it('cancelled ⇒ μήνυμα και «Ξανά» που καλεί onRetry', () => {
    const { getByTestId, actions } = renderOcr({ status: 'cancelled' });
    expect(getByTestId('mfd-ocr-stopped').textContent).toContain('modelFromDrawing.image.ocr.cancelled');
    fireEvent.click(getByTestId('mfd-ocr-retry'));
    expect(actions.onRetry).toHaveBeenCalledTimes(1);
  });

  it.each(['no-pixels', 'worker-unavailable', 'models-unavailable', 'ocr-failed'] as const satisfies readonly PlanOcrFailure[])(
    'failed: %s ⇒ το δικό του κλειδί και «Ξανά»',
    (reason) => {
      const { getByTestId, actions } = renderOcr({ status: 'failed', reason });
      expect(getByTestId('mfd-ocr-stopped').textContent).toContain(`modelFromDrawing.image.ocr.failure.${reason}`);
      fireEvent.click(getByTestId('mfd-ocr-retry'));
      expect(actions.onRetry).toHaveBeenCalledTimes(1);
    },
  );
});
