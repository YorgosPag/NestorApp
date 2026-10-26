/**
 * ADR-920 Β4.8 5γ — the owner's preview view: never blank, never silent.
 *
 *   Ο1  updating with a map ⇒ the previous map stays, `aria-busy`, and the live region says «updating»
 *   Ο2  current ⇒ not busy, the live region is EMPTY but still in the DOM (so the next change is announced)
 *   Ο3  failed ⇒ said in words · no surface ⇒ no figure
 */

import { render, screen } from '@testing-library/react';

import { previewReplyOf } from '@/lib/terrain/survey-import/__tests__/survey-preview-fixture';

import { TerrainPreview, type TerrainPreviewProps } from '../TerrainPreview';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const NS = 'listing-detail:terrain.map.preview';
const MODEL = previewReplyOf(1, 480).model;

function renderPreview(preview: TerrainPreviewProps['preview']) {
  const view = render(<TerrainPreview preview={preview} onWidth={jest.fn()} />);
  return { region: screen.getByRole('region', { name: `${NS}.label` }), status: screen.getByRole('status'), ...view };
}

describe('TerrainPreview', () => {
  it('Ο1 updating: the previous map stays, busy, and says so', () => {
    const { region, status } = renderPreview({ model: MODEL, updating: true, failed: false });
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toBe(`${NS}.updating`);
    expect(region.querySelector('figure[data-terrain-contour-map]')).not.toBeNull();
  });

  it('Ο2 current: not busy, an empty live region that stays in the DOM', () => {
    const { region, status } = renderPreview({ model: MODEL, updating: false, failed: false });
    expect(region.getAttribute('aria-busy')).toBe('false');
    expect(status.textContent).toBe('');
  });

  it('Ο3 failed is said in words · no surface ⇒ no figure', () => {
    const { region, status } = renderPreview({ model: null, updating: false, failed: true });
    expect(status.textContent).toBe(`${NS}.failed`);
    expect(region.querySelector('figure')).toBeNull();
  });
});
