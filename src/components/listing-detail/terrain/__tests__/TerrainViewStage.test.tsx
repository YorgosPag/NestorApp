/**
 * ADR-920 §14.5 — «Κάτοψη | 3Δ»: τι βλέπει ο επισκέπτης ΠΡΙΝ κατέβει το three, και τι όταν η συσκευή δεν έχει WebGL.
 *
 * Ο καμβάς 3Δ αντικαθίσταται με δηλωτικό στέλεχος (το `next/dynamic` δεν φορτώνει τίποτα εδώ): το test κρίνει τη ΣΚΑΛΑ
 * αποκάλυψης και την υπερβολή που φτάνει στον καμβά, όχι το WebGL.
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { terrainMapModelOf } from '@/lib/terrain/publication/terrain-map-model';
import { REAL_PLANE } from '@/lib/terrain/publication/__tests__/fixtures/terrain-3d-fixtures';

import { TerrainViewStage } from '../TerrainViewStage';
import { elListingDetailT } from './fixtures/el-listing-detail-t';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: jest.requireActual<typeof import('./fixtures/el-listing-detail-t')>('./fixtures/el-listing-detail-t').elListingDetailT,
  }),
}));

let mockWebgl = true;
jest.mock('@/lib/browser/webgl-support', () => ({ isWebGLAvailable: () => mockWebgl }));

jest.mock('next/dynamic', () => () =>
  function Terrain3dCanvasStub({ exaggeration }: { readonly exaggeration: number }) {
    return <output data-testid="terrain-3d-canvas">{exaggeration}</output>;
  });

const SNAPSHOT = REAL_PLANE();
const MODEL = terrainMapModelOf(SNAPSHOT);
const t = (key: string, values?: Record<string, string | number>) => elListingDetailT(`listing-detail:terrain.view.${key}`, values);

function renderStage() {
  return render(<TerrainViewStage model={MODEL} snapshot={SNAPSHOT} />);
}

/** Η Radix Tabs ενεργοποιεί καρτέλα σε `mouseDown` (όχι `click`). */
function openTab(name: string): void {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });
}

beforeEach(() => {
  mockWebgl = true;
});

describe('TerrainViewStage — Κάτοψη | 3Δ', () => {
  it('ανοίγει στην ΚΑΤΟΨΗ, χωρίς καμβά 3Δ', () => {
    const { container } = renderStage();
    expect(screen.getByRole('tab', { name: t('tabs.plan') })).toHaveAttribute('aria-selected', 'true');
    expect(container.querySelector('[data-terrain-contour-map]')).not.toBeNull();
    expect(screen.queryByTestId('terrain-3d-canvas')).toBeNull();
  });

  it('η καρτέλα 3Δ δείχνει ΚΑΡΤΑ ΕΙΣΟΔΟΥ — ο καμβάς έρχεται μόνο μετά το πάτημα', () => {
    renderStage();
    openTab(t('tabs.threeD'));
    expect(screen.queryByTestId('terrain-3d-canvas')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('threeD.reveal')) }));
    expect(screen.getByTestId('terrain-3d-canvas')).toHaveTextContent('1');
  });

  it('χωρίς WebGL: εξήγηση, κανένας καμβάς, και η κάτοψη μένει μία καρτέλα μακριά', () => {
    mockWebgl = false;
    const { container } = renderStage();
    openTab(t('tabs.threeD'));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('threeD.reveal')) }));
    expect(screen.getByRole('status')).toHaveTextContent(t('threeD.noWebgl'));
    expect(screen.queryByTestId('terrain-3d-canvas')).toBeNull();
    openTab(t('tabs.plan'));
    expect(container.querySelector('[data-terrain-contour-map]')).not.toBeNull();
  });

  it('η υπερβολή 1× / 2× / 3× φτάνει στον καμβά', () => {
    renderStage();
    openTab(t('tabs.threeD'));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('threeD.reveal')) }));
    fireEvent.click(screen.getByRole('radio', { name: t('exaggeration.option', { value: 3 }) }));
    expect(screen.getByTestId('terrain-3d-canvas')).toHaveTextContent('3');
  });

  it('η κάτοψη ΚΡΑΤΑ τον χρωματισμό της όταν πας στο 3Δ και γυρίσεις', () => {
    const { container } = renderStage();
    fireEvent.click(screen.getByRole('radio', { name: elListingDetailT('listing-detail:terrain.map.fill.slope') }));
    openTab(t('tabs.threeD'));
    openTab(t('tabs.plan'));
    expect(container.querySelector('[data-terrain-fill]')).toHaveAttribute('data-terrain-fill', 'slope');
  });
});
