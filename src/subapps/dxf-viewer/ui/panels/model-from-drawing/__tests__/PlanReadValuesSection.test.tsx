/**
 * @jest-environment jsdom
 *
 * ADR-929 Δ21 (δ) — η λίστα «Τι διάβασα» στο πάνελ (καθαρή παρουσίαση):
 *   · χωρίς ανάγνωση ⇒ τίποτα· κενή ⇒ μήνυμα· κάθε γραμμή με ερμηνεία, βεβαιότητα, κατάσταση, απόκλιση από ΡΗΤΑ κλειδιά·
 *   · κλικ ⇒ πεδίο· Enter ⇒ διόρθωση· Esc ⇒ ακύρωση χωρίς εγγραφή· «διορθώθηκε» + αρχική ανάγνωση + «Επαναφορά»·
 *   · «Δεν είναι διάσταση» μόνο για διάσταση· δείκτης πάνω σε γραμμή ⇒ επισήμανση.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import type { PlanReadValueRow } from '../../../../systems/plan-recognition/plan-read-values';
import { PlanReadValuesSection, type PlanReadValuesActions } from '../PlanReadValuesSection';

const t = (key: string, params?: Record<string, string | number>): string => (params ? `${key}${JSON.stringify(params)}` : key);

const row = (over: Partial<PlanReadValueRow> & Pick<PlanReadValueRow, 'textId' | 'raw'>): PlanReadValueRow => ({
  correctedFrom: null, confirmed: false, priority: 'ok', suggestion: null, kind: 'dimension', valueMm: null, confidence: 0.9, status: null, deviationMm: null, w: null, ...over,
});

const ROWS: readonly PlanReadValueRow[] = [
  row({ textId: 't3', raw: '4.12', correctedFrom: '4.15', valueMm: 4120, status: 'conflict', deviationMm: -420, w: -4.2, priority: 'checked' }),
  row({ textId: 't4', raw: '412', priority: 'suspect' }),
  row({ textId: 't1', raw: 'ΣΑΛΟΝΙ', kind: 'other', confidence: 0.4, priority: 'suspect' }),
];

function renderValues(rows: readonly PlanReadValueRow[] | null = ROWS) {
  const actions: jest.Mocked<PlanReadValuesActions> = {
    onCorrect: jest.fn(), onMarkNotDimension: jest.fn(), onRevert: jest.fn(), onHover: jest.fn(), onConfirm: jest.fn(), onFocusSource: jest.fn(),
    previewCorrection: jest.fn((_textId: string, raw: string) => (
      raw.trim() === '' ? null : { kind: 'dimension' as const, valueMm: raw === '412' ? null : 4120 }
    )),
  };
  return { ...render(<PlanReadValuesSection rows={rows} actions={actions} t={t} />), actions };
}

const item = (getAll: (id: string) => HTMLElement[], textId: string): HTMLElement => {
  const found = getAll('mfd-read-value').find((el) => el.getAttribute('data-text-id') === textId);
  if (!found) throw new Error(`no row ${textId}`);
  return found;
};

describe('PlanReadValuesSection (ADR-929 Δ21 (δ))', () => {
  it('χωρίς ανάγνωση ⇒ τίποτα· κενή ⇒ το μήνυμα «κανένα κείμενο»', () => {
    expect(renderValues(null).container.textContent).toBe('');
    expect(renderValues([]).getByTestId('mfd-read-values').textContent).toContain('modelFromDrawing.image.ocr.values.empty');
  });

  it('γραμμές με τη σειρά που δόθηκαν, ερμηνεία + βεβαιότητα + κατάσταση + απόκλιση + «διορθώθηκε»', () => {
    const { getAllByTestId } = renderValues();
    expect(getAllByTestId('mfd-read-value').map((el) => el.getAttribute('data-text-id'))).toEqual(['t3', 't4', 't1']);
    const t3 = item(getAllByTestId, 't3');
    expect(t3.getAttribute('data-status')).toBe('conflict');
    expect(t3.getAttribute('data-corrected')).toBe('true');
    expect(t3.textContent).toContain('modelFromDrawing.image.ocr.values.valueMm{"value":4120}');
    expect(t3.textContent).toContain('modelFromDrawing.image.ocr.values.status.conflict');
    expect(t3.textContent).toContain('modelFromDrawing.image.ocr.values.deviation{"value":-420}');
    expect(t3.textContent).toContain('modelFromDrawing.image.ocr.values.corrected{"raw":"4.15"}');
    expect(item(getAllByTestId, 't4').textContent).toContain('modelFromDrawing.image.ocr.values.noUnit');
    expect(item(getAllByTestId, 't1').textContent).toContain('modelFromDrawing.image.ocr.values.kind.other');
  });

  it('κλικ ⇒ πεδίο με το κείμενο· Enter ⇒ onCorrect μία φορά και το πεδίο κλείνει', () => {
    const { getAllByTestId, getByTestId, queryByTestId, actions } = renderValues();
    fireEvent.click(item(getAllByTestId, 't4').querySelector('[data-testid="mfd-read-value-edit"]') as HTMLElement);
    const input = getByTestId('mfd-read-value-input') as HTMLInputElement;
    expect(input.value).toBe('412');
    fireEvent.change(input, { target: { value: '4,12 μ.μ.' } });
    fireEvent.submit(getByTestId('mfd-read-value-editor'));
    expect(actions.onCorrect).toHaveBeenCalledTimes(1);
    expect(actions.onCorrect).toHaveBeenCalledWith('t4', '4,12 μ.μ.');
    expect(queryByTestId('mfd-read-value-input')).toBeNull();
  });

  it('Esc ⇒ το πεδίο κλείνει χωρίς διόρθωση· αμετάβλητο κείμενο ⇒ καμία διόρθωση', () => {
    const { getAllByTestId, getByTestId, queryByTestId, actions } = renderValues();
    const edit = (): void => fireEvent.click(item(getAllByTestId, 't4').querySelector('[data-testid="mfd-read-value-edit"]') as HTMLElement);
    edit();
    fireEvent.change(getByTestId('mfd-read-value-input'), { target: { value: '9.99' } });
    fireEvent.keyDown(getByTestId('mfd-read-value-input'), { key: 'Escape' });
    expect(queryByTestId('mfd-read-value-input')).toBeNull();
    edit();
    fireEvent.submit(getByTestId('mfd-read-value-editor'));
    expect(actions.onCorrect).not.toHaveBeenCalled();
  });

  it('βήμα 5 — ζωντανή ερμηνεία στο πεδίο, πριν από το Enter, από τον ελεγκτή (aria-live)', () => {
    const { getAllByTestId, getByTestId, actions } = renderValues();
    fireEvent.click(item(getAllByTestId, 't4').querySelector('[data-testid="mfd-read-value-edit"]') as HTMLElement);
    const preview = getByTestId('mfd-read-value-preview');
    expect(preview.getAttribute('aria-live')).toBe('polite');
    expect(getByTestId('mfd-read-value-input').getAttribute('aria-describedby')).toBe(preview.id);
    expect(preview.textContent).toContain('modelFromDrawing.image.ocr.values.noUnit');
    fireEvent.change(getByTestId('mfd-read-value-input'), { target: { value: '4,12 μ.μ.' } });
    expect(actions.previewCorrection).toHaveBeenLastCalledWith('t4', '4,12 μ.μ.');
    expect(preview.textContent).toContain('modelFromDrawing.image.ocr.values.preview');
    expect(preview.textContent).toMatch(/values\.valueMm\{\\+"value\\+":4120\}/);
    fireEvent.change(getByTestId('mfd-read-value-input'), { target: { value: '' } });
    expect(preview.textContent).toBe('');
    expect(actions.onCorrect).not.toHaveBeenCalled();
  });

  it('βήμα 3 — «Σωστό ✓» μόνο σε μη ελεγμένη· επιβεβαιωμένη ⇒ σήμανση + «Επαναφορά»· πρόοδος N από M', () => {
    const rows = [...ROWS, row({ textId: 't9', raw: '2.05', valueMm: 2050, confirmed: true, confidence: 1, priority: 'checked' })];
    const { getAllByTestId, getByTestId, actions } = renderValues(rows);
    expect(getByTestId('mfd-read-values-progress').textContent)
      .toBe('modelFromDrawing.image.ocr.values.progress{"checked":2,"total":4}');
    expect(item(getAllByTestId, 't3').querySelector('[data-testid="mfd-read-value-confirm"]')).toBeNull();
    const t9 = item(getAllByTestId, 't9');
    expect(t9.getAttribute('data-confirmed')).toBe('true');
    expect(t9.querySelector('[data-testid="mfd-read-value-confirm"]')).toBeNull();
    expect(t9.querySelector('[data-testid="mfd-read-value-confirmed"]')).not.toBeNull();
    expect(t9.querySelector('[data-testid="mfd-read-value-corrected"]')).toBeNull();
    fireEvent.click(t9.querySelector('[data-testid="mfd-read-value-revert"]') as HTMLElement);
    expect(actions.onRevert).toHaveBeenCalledWith('t9');
    fireEvent.click(item(getAllByTestId, 't1').querySelector('[data-testid="mfd-read-value-confirm"]') as HTMLElement);
    expect(actions.onConfirm).toHaveBeenCalledWith('t1');
  });

  it('βήμα 4 — ετικέτα προτεραιότητας σε κάθε γραμμή, ΡΗΤΟ κλειδί ανά κατάσταση', () => {
    const rows = [...ROWS, row({ textId: 't9', raw: '2.05', valueMm: 2050 })];
    const { getAllByTestId } = renderValues(rows);
    const badge = (id: string): Element | null => item(getAllByTestId, id).querySelector('[data-testid="mfd-read-value-priority"]');
    expect(badge('t3')?.getAttribute('data-priority')).toBe('checked');
    expect(badge('t4')?.textContent).toBe('modelFromDrawing.image.ocr.values.priority.suspect');
    expect(badge('t9')?.textContent).toBe('modelFromDrawing.image.ocr.values.priority.ok');
    expect(badge('t3')?.textContent).toBe('modelFromDrawing.image.ocr.values.priority.checked');
    expect(badge('t3')?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('βήμα 7 — πρόταση μόνο όπου υπάρχει· αποδοχή ⇒ onCorrect με το κείμενο της πρότασης (ο ΙΔΙΟΣ δρόμος)', () => {
    const rows = [row({ textId: 't3', raw: '4.12', status: 'conflict', suggestion: '3.70' }), row({ textId: 't4', raw: '412' })];
    const { getAllByTestId, actions } = renderValues(rows);
    expect(item(getAllByTestId, 't4').querySelector('[data-testid="mfd-read-value-suggestion"]')).toBeNull();
    const suggestion = item(getAllByTestId, 't3').querySelector('[data-testid="mfd-read-value-suggestion"]');
    expect(suggestion?.textContent).toContain('modelFromDrawing.image.ocr.values.suggestion{"value":"3.70"}');
    const accept = suggestion?.querySelector('[data-testid="mfd-read-value-accept-suggestion"]') as HTMLElement;
    expect(accept.getAttribute('aria-label')).toBe('modelFromDrawing.image.ocr.values.acceptSuggestionLabel{"value":"3.70"}');
    fireEvent.click(accept);
    expect(actions.onCorrect).toHaveBeenCalledWith('t3', '3.70');
  });

  it('βήμα 2 — «Εστίαση» = ξεχωριστό κουμπί· το κλικ στο κείμενο μένει «διόρθωση»', () => {
    const { getAllByTestId, queryByTestId, actions } = renderValues();
    const focus = item(getAllByTestId, 't4').querySelector('[data-testid="mfd-read-value-focus"]') as HTMLElement;
    expect(focus.getAttribute('aria-label')).toBe('modelFromDrawing.image.ocr.values.focusSourceLabel{"raw":"412"}');
    fireEvent.click(focus);
    expect(actions.onFocusSource).toHaveBeenCalledWith('t4');
    expect(queryByTestId('mfd-read-value-input')).toBeNull();
    expect(actions.onCorrect).not.toHaveBeenCalled();
  });

  it('«Επαναφορά» μόνο σε διορθωμένη· «Δεν είναι διάσταση» μόνο σε διάσταση· δείκτης ⇒ onHover', () => {
    const { getAllByTestId, actions } = renderValues();
    const t3 = item(getAllByTestId, 't3');
    fireEvent.click(t3.querySelector('[data-testid="mfd-read-value-revert"]') as HTMLElement);
    expect(actions.onRevert).toHaveBeenCalledWith('t3');
    fireEvent.click(item(getAllByTestId, 't4').querySelector('[data-testid="mfd-read-value-not-dimension"]') as HTMLElement);
    expect(actions.onMarkNotDimension).toHaveBeenCalledWith('t4');
    expect(item(getAllByTestId, 't4').querySelector('[data-testid="mfd-read-value-revert"]')).toBeNull();
    expect(item(getAllByTestId, 't1').querySelector('[data-testid="mfd-read-value-not-dimension"]')).toBeNull();
    fireEvent.mouseEnter(t3);
    expect(actions.onHover).toHaveBeenLastCalledWith('t3');
    fireEvent.mouseLeave(t3);
    expect(actions.onHover).toHaveBeenLastCalledWith(null);
  });
});
