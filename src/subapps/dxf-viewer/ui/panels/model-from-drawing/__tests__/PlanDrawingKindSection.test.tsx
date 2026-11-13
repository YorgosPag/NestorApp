/**
 * @jest-environment jsdom
 *
 * ADR-929 Δ21 (0) · Δ7 Γ — «Σχέδιο υπό κλίμακα / Σκίτσο με το χέρι»: το είδος φαίνεται ΠΑΝΤΑ με τον λόγο του (ποτέ σιωπηλή
 * αυτόματη κρίση), αλλάζει με ένα κλικ, και το «Αυτόματη κρίση» εμφανίζεται μόνο όταν αποφάσισε ο άνθρωπος.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import type { PlanDrawingKindDecision } from '../../../../bim/plan-recognition/fusion/plan-fusion-types';
import { PlanDrawingKindSection, type PlanDrawingKindView } from '../PlanDrawingKindSection';

const t = (key: string): string => key;

function renderSection(view: PlanDrawingKindView | null) {
  const onSet = jest.fn();
  const utils = render(<PlanDrawingKindSection view={view} actions={{ onSet }} t={t} />);
  const q = (id: string) => utils.container.querySelector(`[data-testid="${id}"]`);
  return { ...utils, q, onSet };
}

const decision = (over: Partial<PlanDrawingKindDecision>): PlanDrawingKindDecision =>
  ({ kind: 'multipage-pdf', basis: 'default', proportions: 'unproven', ...over });

describe('PlanDrawingKindSection (ADR-929 Δ7 Γ)', () => {
  it('χωρίς σύντηξη ⇒ τίποτα', () => {
    expect(renderSection(null).container.textContent).toBe('');
  });

  it.each([
    [decision({ basis: 'vector-source', proportions: null }), 'drawing', 'reason.vector'],
    [decision({ basis: 'dimensions', proportions: 'to-scale' }), 'drawing', 'reason.toScale'],
    [decision({ kind: 'sketch', basis: 'dimensions', proportions: 'not-to-scale' }), 'sketch', 'reason.notToScale'],
    [decision({}), 'drawing', 'reason.unproven'],
    [decision({ kind: 'sketch', basis: 'human', proportions: null }), 'sketch', 'reason.human'],
  ])('🔴 η κρίση φαίνεται ΠΑΝΤΑ με τον λόγο της (%#)', (d, kind, reason) => {
    const { q } = renderSection({ decision: d, choice: d.basis === 'human' ? 'sketch' : null });
    expect(q('mfd-drawing-kind')?.getAttribute('data-kind')).toBe(kind);
    expect(q(`mfd-drawing-kind-${kind}`)?.getAttribute('aria-checked')).toBe('true');
    expect(q('mfd-drawing-kind-reason')?.textContent).toBe(`modelFromDrawing.image.drawingKind.${reason}`);
  });

  it('λέει τι σημαίνει η κρίση για τις προτάσεις: σκίτσο · αναπόδεικτο· υπό κλίμακα ⇒ τίποτα', () => {
    const effect = (d: PlanDrawingKindDecision) => renderSection({ decision: d, choice: null }).q('mfd-drawing-kind-effect')?.textContent ?? null;
    expect(effect(decision({ kind: 'sketch', basis: 'dimensions' }))).toBe('modelFromDrawing.image.drawingKind.sketchEffect');
    expect(effect(decision({}))).toBe('modelFromDrawing.image.drawingKind.unprovenEffect');
    expect(effect(decision({ basis: 'dimensions', proportions: 'to-scale' }))).toBeNull();
    expect(effect(decision({ basis: 'vector-source', proportions: null }))).toBeNull();
  });

  it('ένα κλικ στο άλλο είδος ⇒ onSet με αυτό', () => {
    const { q, onSet } = renderSection({ decision: decision({ basis: 'dimensions', proportions: 'to-scale' }), choice: null });
    fireEvent.click(q('mfd-drawing-kind-sketch') as HTMLElement);
    expect(onSet).toHaveBeenCalledWith('sketch');
  });

  it('«Αυτόματη κρίση» ΜΟΝΟ μετά από επιλογή ανθρώπου ⇒ onSet(null)', () => {
    expect(renderSection({ decision: decision({}), choice: null }).q('mfd-drawing-kind-auto')).toBeNull();
    const { q, onSet } = renderSection({ decision: decision({ kind: 'sketch', basis: 'human' }), choice: 'sketch' });
    fireEvent.click(q('mfd-drawing-kind-auto') as HTMLElement);
    expect(onSet).toHaveBeenCalledWith(null);
  });
});
