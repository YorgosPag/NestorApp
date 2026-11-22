/**
 * ADR-920 Β4.8 5γ · Β6.7 — the owner's preview view: never blank, never silent, and the SAME scene the buyer gets.
 *
 *   Ο1  updating with a scene ⇒ the previous scene stays, `aria-busy`, and the live region says «updating»
 *   Ο2  current ⇒ not busy, the live region is EMPTY but still in the DOM (so the next change is announced)
 *   Ο3  failed ⇒ said in words · no surface ⇒ no scene
 *   Ο4  Β6.7: the scene is «Κάτοψη | 3Δ» (`TerrainViewStage`) — plan first, the 3D canvas only after the reveal
 *   Ο5  Β6.7: a map without its snapshot is never drawn half (the two come from ONE reply)
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { previewReplyOf } from '@/lib/terrain/survey-import/__tests__/survey-preview-fixture';

import { TerrainPreview, type TerrainPreviewProps } from '../TerrainPreview';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/browser/webgl-support', () => ({ isWebGLAvailable: () => true }));
jest.mock('next/dynamic', () => () =>
  function Terrain3dCanvasStub() {
    return <output data-testid="terrain-3d-canvas" />;
  });

const NS = 'listing-detail:terrain.map.preview';
const VIEW = 'listing-detail:terrain.view';
const REPLY = previewReplyOf(1, 480);
const MODEL = REPLY.model;
const SNAPSHOT = REPLY.preparation.ok ? REPLY.preparation.snapshot : null;

/** Οι περιπτώσεις εδώ δεν αφορούν τις συντεταγμένες του ιδιοκτήτη (ADR-920 §14.10) — πάντα `null`. */
function renderPreview(preview: Omit<TerrainPreviewProps['preview'], 'worldCentreMm'>) {
  const view = render(<TerrainPreview preview={{ ...preview, worldCentreMm: null }} onWidth={jest.fn()} />);
  return { region: screen.getByRole('region', { name: `${NS}.label` }), status: screen.getByRole('status'), ...view };
}

describe('TerrainPreview', () => {
  it('the fixture is a real surface (map AND snapshot)', () => {
    expect(MODEL).not.toBeNull();
    expect(SNAPSHOT).not.toBeNull();
  });

  it('Ο1 updating: the previous scene stays, busy, and says so', () => {
    const { region, status } = renderPreview({ model: MODEL, snapshot: SNAPSHOT, updating: true, failed: false });
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toBe(`${NS}.updating`);
    expect(region.querySelector('[data-terrain-view-stage] figure[data-terrain-contour-map]')).not.toBeNull();
  });

  it('Ο2 current: not busy, an empty live region that stays in the DOM', () => {
    const { region, status } = renderPreview({ model: MODEL, snapshot: SNAPSHOT, updating: false, failed: false });
    expect(region.getAttribute('aria-busy')).toBe('false');
    expect(status.textContent).toBe('');
  });

  it('Ο3 failed is said in words · no surface ⇒ no scene', () => {
    const { region, status } = renderPreview({ model: null, snapshot: null, updating: false, failed: true });
    expect(status.textContent).toBe(`${NS}.failed`);
    expect(region.querySelector('[data-terrain-view-stage]')).toBeNull();
  });

  it('Ο4 «Κάτοψη | 3Δ»: plan first, the 3D canvas only after the reveal', () => {
    renderPreview({ model: MODEL, snapshot: SNAPSHOT, updating: false, failed: false });
    expect(screen.getByRole('tab', { name: `${VIEW}.tabs.plan` })).toHaveAttribute('aria-selected', 'true');
    // Η Radix Tabs ενεργοποιεί καρτέλα σε `mouseDown` (όχι `click`).
    fireEvent.mouseDown(screen.getByRole('tab', { name: `${VIEW}.tabs.threeD` }), { button: 0 });
    expect(screen.queryByTestId('terrain-3d-canvas')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${VIEW}.threeD.reveal`) }));
    expect(screen.getByTestId('terrain-3d-canvas')).not.toBeNull();
  });

  it('Ο5 a map without its snapshot is not drawn half', () => {
    const { region } = renderPreview({ model: MODEL, snapshot: null, updating: false, failed: false });
    expect(region.querySelector('[data-terrain-view-stage]')).toBeNull();
  });
});
