/**
 * @jest-environment jsdom
 *
 * ADR-929 Φ5.3γ — η κάρτα κλίμακας στο πάνελ, με κάρτες από την **πραγματική** παράγωγη (σπίτι του fixture, 1 px = 20 mm):
 *   · ποτέ σιωπηλή εφαρμογή: «Εφαρμογή» μόνο με κλικ, και η **αντικατάσταση** θέλει και δεύτερη επιβεβαίωση·
 *   · φαίνονται ποιες διαστάσεις ορίζουν την κλίμακα και ποιες έμειναν έξω, με λόγο·
 *   · hover σε γραμμή ⇒ επισήμανση στον καμβά (μέσω callback)·
 *   · επιβεβαίωση χωρίς κουμπί εφαρμογής, αλλά με ετυμηγορία χ², ευθυγράμμιση και χειροκίνητη (§6.23)· άρνηση «μπαγιάτικη» φαίνεται.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { fusePlan } from '../../../../bim/plan-recognition/fusion/plan-fusion';
import type { PlanFusionInput } from '../../../../bim/plan-recognition/fusion/plan-fusion-types';
import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import {
  planScaleCard,
  planScaleRefinement,
  type PlanScaleCard,
  type PlanScaleCardInput,
} from '../../../../systems/plan-recognition/plan-scale-card';
import { KNOWN_SCALE, fusionInput, houseDimensions, houseSegments, reading } from '../../../../bim/plan-recognition/fusion/__tests__/fusion-fixture';
import { PlanScaleCardSection, type PlanScaleActions, type PlanScaleView } from '../PlanScaleCard';

const t = (key: string, params?: Record<string, string | number>): string => (params ? `${key}${JSON.stringify(params)}` : key);

function inputFor(knownScale: PlanFusionInput['knownScale'], overrides: Parameters<typeof houseDimensions>[0] = {}): PlanScaleCardInput {
  const { texts, dimensions } = houseDimensions(overrides);
  const read = { status: 'read' as const, reading: reading({ texts, dimensions }) };
  const base = fusionInput({ segments: houseSegments(), reading: read, knownScale });
  return {
    fusion: fusePlan(base), reading: read, sceneUnits: 'mm',
    alignment: { originalToAligned: IDENTITY_HOMOGRAPHY, alignedToOriginal: IDENTITY_HOMOGRAPHY },
    placement: { naturalBounds: { width: 500, height: 400 }, transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
    origin: knownScale === null ? null : 'pdf-vector-dimensions',
    dimensionFusion: () => fusePlan({ ...base, knownScale: null }),
  };
}

const cardFor = (knownScale: PlanFusionInput['knownScale'], overrides: Parameters<typeof houseDimensions>[0] = {}): PlanScaleCard | null =>
  planScaleCard(inputFor(knownScale, overrides));

function actions(): jest.Mocked<PlanScaleActions> {
  return { onApply: jest.fn(), onManual: jest.fn(), onRefine: jest.fn(), onCloseRefine: jest.fn(), onHover: jest.fn() };
}

function renderCard(card: PlanScaleCard | null, extra: Partial<Omit<PlanScaleView, 'card'>> = {}) {
  const a = actions();
  const view: PlanScaleView = { card, refinement: extra.refinement ?? null, applying: extra.applying ?? false, stale: extra.stale ?? false };
  return { ...render(<PlanScaleCardSection view={view} actions={a} t={t} />), a };
}

const WRONG = { ...KNOWN_SCALE, metresPerPixelX: KNOWN_SCALE.metresPerPixelX * 1.05, metresPerPixelY: KNOWN_SCALE.metresPerPixelY * 1.05 };

describe('PlanScaleCardSection (ADR-929 Φ5.3γ)', () => {
  it('χωρίς κάρτα δεν εμφανίζεται τίποτα', () => {
    expect(renderCard(null).container.textContent).toBe('');
  });

  it('πρόταση: «Εφαρμογή» στέλνει ΑΚΡΙΒΩΣ την κάρτα που φαίνεται, μία φορά', () => {
    const card = cardFor(null);
    const { getByTestId, a } = renderCard(card);
    expect(getByTestId('mfd-scale').getAttribute('data-kind')).toBe('proposal');
    fireEvent.click(getByTestId('mfd-scale-apply'));
    expect(a.onApply).toHaveBeenCalledTimes(1);
    expect(a.onApply).toHaveBeenCalledWith(card);
  });

  it('απορριφθείσα διάσταση φαίνεται με τον λόγο της, και το hover φτάνει στον καμβά', () => {
    const { getByTestId, a } = renderCard(cardFor(null, { 't-west': { raw: '2.90', valueMm: 2900 } }));
    const west = getByTestId('mfd-scale-rejected').querySelector('[data-text-id="t-west"]');
    expect(west?.getAttribute('data-reason')).toBe('conflict');
    fireEvent.mouseEnter(west as Element);
    expect(a.onHover).toHaveBeenLastCalledWith('t-west');
    fireEvent.mouseLeave(west as Element);
    expect(a.onHover).toHaveBeenLastCalledWith(null);
  });

  it('🔴 αντικατάσταση υπάρχουσας βαθμονόμησης: το πρώτο κλικ ΔΕΝ γράφει, θέλει «Ναι, αντικατάσταση»', () => {
    const { getByTestId, queryByTestId, a } = renderCard(cardFor(WRONG));
    expect(getByTestId('mfd-scale-replaces')).not.toBeNull();
    fireEvent.click(getByTestId('mfd-scale-apply'));
    expect(a.onApply).not.toHaveBeenCalled();
    fireEvent.click(getByTestId('mfd-scale-replace-yes'));
    expect(a.onApply).toHaveBeenCalledTimes(1);
    expect(queryByTestId('mfd-scale-confirm')).toBeNull();
  });

  it('§6.23 επιβεβαίωση: ετυμηγορία χ², γραμμή ανά διάσταση, προέλευση· χωρίς «Εφαρμογή», αλλά με ευθυγράμμιση ΚΑΙ χειροκίνητη', () => {
    const { getByTestId, queryByTestId, a } = renderCard(cardFor(KNOWN_SCALE));
    expect(getByTestId('mfd-scale-confirmed')).not.toBeNull();
    expect(getByTestId('mfd-scale-verdict').getAttribute('data-within')).toBe('true');
    expect(getByTestId('mfd-scale-agreement-rows').querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
    expect(getByTestId('mfd-scale-origin').getAttribute('data-origin')).toBe('pdf-vector-dimensions');
    expect(queryByTestId('mfd-scale-apply')).toBeNull();
    fireEvent.click(getByTestId('mfd-scale-refine'));
    expect(a.onRefine).toHaveBeenCalledTimes(1);
    fireEvent.click(getByTestId('mfd-scale-manual'));
    expect(a.onManual).toHaveBeenCalledTimes(1);
  });

  it('§6.23 ανοιχτή ευθυγράμμιση: αντικατάσταση με δεύτερη επιβεβαίωση που λέει «δεν βελτιώνει», και «Κλείσιμο»', () => {
    const input = inputFor(KNOWN_SCALE);
    const refinement = planScaleRefinement(input);
    const { getByTestId, queryByTestId, a } = renderCard(planScaleCard(input), { refinement });
    expect(queryByTestId('mfd-scale-refine')).toBeNull();
    expect(getByTestId('mfd-scale-refinement')).not.toBeNull();
    fireEvent.click(getByTestId('mfd-scale-apply'));
    expect(a.onApply).not.toHaveBeenCalled();
    expect(getByTestId('mfd-scale-refine-within')).not.toBeNull();
    fireEvent.click(getByTestId('mfd-scale-replace-yes'));
    expect(a.onApply).toHaveBeenCalledWith(refinement);
    fireEvent.click(getByTestId('mfd-scale-refine-close'));
    expect(a.onCloseRefine).toHaveBeenCalledTimes(1);
  });

  it('σε εξέλιξη ⇒ κουμπί κλειστό· άρνηση «μπαγιάτικη» ⇒ μήνυμα', () => {
    const card = cardFor(null);
    expect((renderCard(card, { applying: true }).getByTestId('mfd-scale-apply') as HTMLButtonElement).disabled).toBe(true);
    expect(renderCard(card, { stale: true }).getByTestId('mfd-scale-stale')).not.toBeNull();
  });

  it('«Βαθμονόμηση με το χέρι» ανοίγει τον υπάρχοντα διάλογο', () => {
    const { getByTestId, a } = renderCard(cardFor(null));
    fireEvent.click(getByTestId('mfd-scale-manual'));
    expect(a.onManual).toHaveBeenCalledTimes(1);
  });
});
