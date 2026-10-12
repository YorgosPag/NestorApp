/**
 * @jest-environment jsdom
 *
 * ADR-911 Φ3β — η κατάσταση κάθε ορθογωνίου φτάνει όντως ως τα pixels του καμβά.
 *
 * Έλεγχος ΡΑΦΗΣ: store → φύλλο → `PreviewZoneShape` → attribute. Κάθε κρίκος μπορεί να ρίξει την
 * κατάσταση χωρίς κανένα type error (π.χ. όλα πράσινα). Γι' αυτό οι ισχυρισμοί κοιτούν το ΤΕΛΙΚΟ
 * SVG — χρώμα ΚΑΙ μοτίβο γραμμής ανά κατάσταση — όχι τι κρατά το store.
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { ModelFromDrawingPreviewOverlay } from '../ModelFromDrawingPreviewOverlay';
import { modelFromDrawingStore } from '../../../systems/model-from-drawing/model-from-drawing-store';
import { ASSISTANT_STATUS_TONE, OPENING_STATUS_TONE } from '../../../systems/model-from-drawing/assistant-status-tone';
import type { OpeningPreview, OpeningPreviewZone } from '../../../bim/model-from-drawing/opening-preview';
import { PREVIEW_ZONE_STYLE } from '../../../systems/region-preview/preview-zone-style';
import type { AssistantPreview, AssistantPreviewZone } from '../../../bim/model-from-drawing/assistant-preview';
import type { WallProposalStatus } from '../../../bim/model-from-drawing/wall-proposal';
import { updateImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import type { Point2D, Viewport } from '../../../rendering/types/Types';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
}));

updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 });
const viewport = { width: 800, height: 600 } as unknown as Viewport;

const rect = (x: number): Point2D[] => [{ x, y: 0 }, { x: x + 100, y: 0 }, { x: x + 100, y: 20 }, { x, y: 20 }];

function zone(key: string, status: WallProposalStatus, extra: Partial<AssistantPreviewZone> = {}): AssistantPreviewZone {
  return { key, status, pieces: [rect(Number(key) * 200)], thicknessMm: 200, ...extra };
}

const PREVIEW: AssistantPreview = {
  zones: [
    zone('1', 'rejected', { reason: 'regionPerimeter.rejected.lengthTooShort' }),
    zone('2', 'ready', { pieces: [rect(400), rect(520)] }),
    zone('3', 'needs-decision'),
    zone('4', 'existing'),
  ],
  unexplained: [{ start: { x: 0, y: 300 }, end: { x: 100, y: 300 } }],
};

const seed = (patch: Parameters<typeof modelFromDrawingStore.patch>[0]) => act(() => modelFromDrawingStore.patch(patch));
const renderOverlay = () => render(<ModelFromDrawingPreviewOverlay viewport={viewport} />);
const zoneGroups = (container: HTMLElement) => [...container.querySelectorAll('g[data-tone]')];

afterEach(() => act(() => modelFromDrawingStore.reset()));

describe('ModelFromDrawingPreviewOverlay', () => {
  it('κλειστός βοηθός ⇒ τίποτα στον καμβά, ακόμη κι αν έμεινε προεπισκόπηση', () => {
    const { container } = renderOverlay();
    seed({ phase: 'closed', preview: PREVIEW });
    expect(container.querySelector('svg')).toBeNull();
  });

  it('κάθε κατάσταση ζωγραφίζεται με το ΔΙΚΟ της χρώμα και μοτίβο γραμμής', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', preview: PREVIEW });
    for (const z of PREVIEW.zones) {
      const style = PREVIEW_ZONE_STYLE[ASSISTANT_STATUS_TONE[z.status]];
      const path = container.querySelector(`[data-testid="mfd-zone-${z.status}"] path`);
      expect(path?.getAttribute('stroke')).toBe(style.stroke);
      expect(path?.getAttribute('stroke-dasharray')).toBe(style.dash);
    }
    const dashes = PREVIEW.zones.map((z) =>
      container.querySelector(`[data-testid="mfd-zone-${z.status}"] path`)?.getAttribute('stroke-dasharray') ?? 'solid');
    expect(new Set(dashes).size).toBe(4);
  });

  it('τοίχος σε δύο κομμάτια = δύο paths στην ΙΔΙΑ ζώνη', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', preview: PREVIEW });
    expect(container.querySelectorAll('[data-testid="mfd-zone-ready"] path')).toHaveLength(2);
  });

  it('ο λόγος απόρριψης φτάνει ως tooltip, μεταφρασμένος', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', preview: PREVIEW });
    expect(container.querySelector('[data-testid="mfd-zone-rejected"] title')?.textContent)
      .toBe('t:regionPerimeter.rejected.lengthTooShort');
  });

  it('ό,τι θέλει προσοχή ζωγραφίζεται από πάνω, και η εστιασμένη ζώνη τελευταία', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', preview: PREVIEW });
    expect(zoneGroups(container).map((g) => g.getAttribute('data-tone')))
      .toEqual(['existing', 'accept', 'decide', 'reject']);

    seed({ focusedKey: '4' });
    const order = zoneGroups(container).map((g) => g.getAttribute('data-tone'));
    expect(order[order.length - 1]).toBe('existing');
    const focused = container.querySelector('[data-testid="mfd-zone-existing"] path');
    expect(Number(focused?.getAttribute('stroke-width'))).toBeGreaterThan(PREVIEW_ZONE_STYLE.existing.strokeWidth);
  });

  it('οι ανεξήγητες γραμμές φωτίζονται ως ανοιχτές γραμμές στο χρώμα της απόρριψης', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', preview: PREVIEW });
    const lines = container.querySelectorAll('[data-testid="mfd-unexplained"]');
    expect(lines).toHaveLength(1);
    expect(lines[0].getAttribute('stroke')).toBe(PREVIEW_ZONE_STYLE.reject.stroke);
    expect(lines[0].getAttribute('d')?.endsWith('Z')).toBe(false);
  });
});

/**
 * ADR-911 Φ4-3β — η στρώση ανοιγμάτων. Ίδιος έλεγχος ραφής: τόνος ΚΑΙ μοτίβο ως το τελικό SVG.
 */
describe('ModelFromDrawingPreviewOverlay — ανοίγματα', () => {
  const oZone = (key: string, status: OpeningPreviewZone['status'], extra: Partial<OpeningPreviewZone> = {}): OpeningPreviewZone =>
    ({ key, status, pieces: [rect(Number(key) * 200)], occupied: false, dismissed: false, ...extra });
  const segment = (y: number) => ({ start: { x: 0, y }, end: { x: 100, y } });
  const OPENINGS: OpeningPreview = {
    zones: [
      oZone('1', 'door'),
      oZone('2', 'window'),
      oZone('3', 'needs-decision', { reason: 'no-symbol', occupied: true }),
      oZone('4', 'existing'),
    ],
    occupants: [segment(400)],
    loose: [segment(420), segment(440)],
    unexplained: [segment(460)],
  };
  const pathOf = (container: HTMLElement, status: string) => container.querySelector(`[data-testid="mfd-opening-${status}"] path`);

  it('ο πίνακας τόνων, ΑΠΟΛΥΤΑ: ό,τι θα γραφτεί πράσινο, ό,τι ρωτιέται κεχριμπαρί, ό,τι υπάρχει γκρι', () => {
    // Οι παρακάτω έλεγχοι συγκρίνουν το SVG με τον πίνακα· αυτός κρίνει τον ίδιο τον πίνακα.
    expect(OPENING_STATUS_TONE).toEqual({ door: 'accept', window: 'accept', 'needs-decision': 'decide', existing: 'existing' });
  });

  it('ζωγραφίζεται και ΧΩΡΙΣ πρόταση τοίχων (τοίχοι σχεδιασμένοι με το χέρι)', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', preview: null, openingPreview: OPENINGS });
    expect(container.querySelectorAll('g[data-testid^="mfd-opening-"]')).toHaveLength(4);
    expect(container.querySelector('[data-testid^="mfd-zone-"]')).toBeNull();
  });

  it('κάθε κατάσταση με τον τόνο της· πόρτα και παράθυρο τις ξεχωρίζει η ΕΤΙΚΕΤΑ', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', openingPreview: OPENINGS });
    for (const z of OPENINGS.zones) {
      const style = PREVIEW_ZONE_STYLE[OPENING_STATUS_TONE[z.status]];
      expect(pathOf(container, z.status)?.getAttribute('stroke')).toBe(style.stroke);
      expect(pathOf(container, z.status)?.getAttribute('stroke-dasharray')).toBe(style.dash);
    }
    const label = (status: string) => container.querySelector(`[data-testid="mfd-opening-${status}"] text`)?.textContent;
    expect(label('door')).toBe('t:modelFromDrawing.openings.choice.door');
    expect(label('window')).toBe('t:modelFromDrawing.openings.choice.window');
    expect(label('needs-decision')).toBeUndefined();
    expect(label('existing')).toBeUndefined();
  });

  it('ο λόγος που ρωτιέται ο άνθρωπος φτάνει ως tooltip', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', openingPreview: OPENINGS });
    expect(container.querySelector('[data-testid="mfd-opening-needs-decision"] title')?.textContent)
      .toBe('t:modelFromDrawing.openings.reason.no-symbol');
  });

  it('«τίποτα» από τον άνθρωπο ⇒ η ζώνη γίνεται «δεν θα δημιουργηθεί»', () => {
    const { container } = renderOverlay();
    const dismissed = { ...OPENINGS, zones: OPENINGS.zones.map((z) => (z.key === '3' ? { ...z, dismissed: true } : z)) };
    seed({ phase: 'review', openingPreview: dismissed });
    expect(pathOf(container, 'needs-decision')?.getAttribute('stroke')).toBe(PREVIEW_ZONE_STYLE.reject.stroke);
  });

  it('άρνηση του σχεδίου εγγραφής ⇒ ό,τι «θα γραφόταν» κοκκινίζει· τα υπόλοιπα μένουν όπως ήταν', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', openingPreview: { ...OPENINGS, refusal: 'overlap' } });
    expect(pathOf(container, 'door')?.getAttribute('stroke')).toBe(PREVIEW_ZONE_STYLE.reject.stroke);
    expect(pathOf(container, 'window')?.getAttribute('stroke')).toBe(PREVIEW_ZONE_STYLE.reject.stroke);
    expect(pathOf(container, 'needs-decision')?.getAttribute('stroke')).toBe(PREVIEW_ZONE_STYLE.decide.stroke);
    expect(pathOf(container, 'existing')?.getAttribute('stroke')).toBe(PREVIEW_ZONE_STYLE.existing.stroke);
  });

  it('ένοικοι και σύμβολα χωρίς λωρίδα στο χρώμα της απόφασης· ανεξήγητες στο χρώμα της απόρριψης', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', openingPreview: OPENINGS });
    const strokes = (testId: string) => [...container.querySelectorAll(`[data-testid="${testId}"]`)].map((p) => p.getAttribute('stroke'));
    expect(strokes('mfd-opening-occupant')).toEqual([PREVIEW_ZONE_STYLE.decide.stroke]);
    expect(strokes('mfd-opening-loose')).toEqual([PREVIEW_ZONE_STYLE.decide.stroke, PREVIEW_ZONE_STYLE.decide.stroke]);
    expect(strokes('mfd-opening-unexplained')).toEqual([PREVIEW_ZONE_STYLE.reject.stroke]);
  });

  it('τα ανοίγματα ζωγραφίζονται ΠΑΝΩ από τους τοίχους, και το εστιασμένο τελευταίο', () => {
    const { container } = renderOverlay();
    seed({ phase: 'review', preview: PREVIEW, openingPreview: OPENINGS, focusedKey: '4' });
    const ids = zoneGroups(container).map((g) => g.getAttribute('data-testid') ?? '');
    const firstOpening = ids.findIndex((id) => id.startsWith('mfd-opening-'));
    expect(ids.slice(0, firstOpening).every((id) => id.startsWith('mfd-zone-'))).toBe(true);
    expect(ids.slice(firstOpening).every((id) => id.startsWith('mfd-opening-'))).toBe(true);
    expect(ids[ids.length - 1]).toBe('mfd-opening-existing');
  });
});
