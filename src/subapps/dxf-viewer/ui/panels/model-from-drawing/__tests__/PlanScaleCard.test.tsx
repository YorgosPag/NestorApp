/**
 * @jest-environment jsdom
 *
 * ADR-929 Φ5.3γ — η κάρτα κλίμακας στο πάνελ, με κάρτες από την **πραγματική** παράγωγη (σπίτι του fixture, 1 px = 20 mm):
 *   · ποτέ σιωπηλή εφαρμογή: «Εφαρμογή» μόνο με κλικ, και η **αντικατάσταση** θέλει και δεύτερη επιβεβαίωση·
 *   · φαίνονται ποιες διαστάσεις ορίζουν την κλίμακα και ποιες έμειναν έξω, με λόγο·
 *   · hover σε γραμμή ⇒ επισήμανση στον καμβά (μέσω callback)·
 *   · επιβεβαίωση χωρίς κουμπί εφαρμογής· άρνηση «μπαγιάτικη» φαίνεται.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { fusePlan } from '../../../../bim/plan-recognition/fusion/plan-fusion';
import type { PlanFusionInput } from '../../../../bim/plan-recognition/fusion/plan-fusion-types';
import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import { planScaleCard, type PlanScaleCard } from '../../../../systems/plan-recognition/plan-scale-card';
import { KNOWN_SCALE, fusionInput, houseDimensions, houseSegments, reading } from '../../../../bim/plan-recognition/fusion/__tests__/fusion-fixture';
import { PlanScaleCardSection, type PlanScaleActions } from '../PlanScaleCard';

const t = (key: string, params?: Record<string, string | number>): string => (params ? `${key}${JSON.stringify(params)}` : key);

function cardFor(knownScale: PlanFusionInput['knownScale'], overrides: Parameters<typeof houseDimensions>[0] = {}): PlanScaleCard | null {
  const { texts, dimensions } = houseDimensions(overrides);
  const read = { status: 'read' as const, reading: reading({ texts, dimensions }) };
  const base = fusionInput({ segments: houseSegments(), reading: read, knownScale });
  return planScaleCard({
    fusion: fusePlan(base), reading: read, sceneUnits: 'mm',
    alignment: { originalToAligned: IDENTITY_HOMOGRAPHY, alignedToOriginal: IDENTITY_HOMOGRAPHY },
    placement: { naturalBounds: { width: 500, height: 400 }, transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
    dimensionFusion: () => fusePlan({ ...base, knownScale: null }),
  });
}

function actions(): jest.Mocked<PlanScaleActions> {
  return { onApply: jest.fn(), onManual: jest.fn(), onHover: jest.fn() };
}

function renderCard(card: PlanScaleCard | null, extra: { applying?: boolean; stale?: boolean } = {}) {
  const a = actions();
  const view = render(<PlanScaleCardSection view={{ card, applying: extra.applying ?? false, stale: extra.stale ?? false }} actions={a} t={t} />);
  return { ...view, a };
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

  it('επιβεβαίωση: κανένα κουμπί εφαρμογής ή χειροκίνητης βαθμονόμησης', () => {
    const { getByTestId, queryByTestId } = renderCard(cardFor(KNOWN_SCALE));
    expect(getByTestId('mfd-scale-confirmed')).not.toBeNull();
    expect(queryByTestId('mfd-scale-apply')).toBeNull();
    expect(queryByTestId('mfd-scale-manual')).toBeNull();
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
