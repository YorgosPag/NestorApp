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
  correctedFrom: null, kind: 'dimension', valueMm: null, confidence: 0.9, status: null, deviationMm: null, w: null, ...over,
});

const ROWS: readonly PlanReadValueRow[] = [
  row({ textId: 't3', raw: '4.12', correctedFrom: '4.15', valueMm: 4120, status: 'conflict', deviationMm: -420, w: -4.2 }),
  row({ textId: 't4', raw: '412' }),
  row({ textId: 't1', raw: 'ΣΑΛΟΝΙ', kind: 'other', confidence: 0.4 }),
];

function renderValues(rows: readonly PlanReadValueRow[] | null = ROWS) {
  const actions: jest.Mocked<PlanReadValuesActions> = {
    onCorrect: jest.fn(), onMarkNotDimension: jest.fn(), onRevert: jest.fn(), onHover: jest.fn(),
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
