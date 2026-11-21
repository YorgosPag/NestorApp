/**
 * ADR-920 §14.5 — η κάθετη υπερβολή φαίνεται ΠΑΝΩ ΣΤΗ ΣΚΗΝΗ όταν ≠ 1×, και η «Αρχική όψη» φτάνει στη μηχανή.
 * Η μηχανή (WebGL) αντικαθίσταται· η γεωμετρία χτίζεται με τον ΑΛΗΘΙΝΟ `buildTerrain3dGeometry`.
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { REAL_PLANE } from '@/lib/terrain/publication/__tests__/fixtures/terrain-3d-fixtures';

import { elListingDetailT } from '../../__tests__/fixtures/el-listing-detail-t';
import Terrain3dCanvas from '../Terrain3dCanvas';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: jest.requireActual<typeof import('../../__tests__/fixtures/el-listing-detail-t')>('../../__tests__/fixtures/el-listing-detail-t')
      .elListingDetailT,
  }),
}));

const mockHome = jest.fn();
jest.mock('../useTerrain3dEngine', () => ({ useTerrain3dEngine: () => ({ home: mockHome }) }));

const SNAPSHOT = REAL_PLANE();
const t = (key: string, values?: Record<string, string | number>) => elListingDetailT(`listing-detail:terrain.view.${key}`, values);

function renderCanvas(exaggeration: 1 | 2 | 3) {
  return render(<Terrain3dCanvas snapshot={SNAPSHOT} exaggeration={exaggeration} onFailed={jest.fn()} />);
}

describe('Terrain3dCanvas — ένδειξη υπερβολής', () => {
  it('1×: καμία ένδειξη (τα ύψη είναι τα πραγματικά)', () => {
    const { container } = renderCanvas(1);
    expect(container.querySelector('[data-terrain-exaggeration-badge]')).toBeNull();
  });

  it.each([2, 3] as const)('%i×: η ένδειξη λέει τον συντελεστή πάνω στη σκηνή', (value) => {
    const { container } = renderCanvas(value);
    expect(container.querySelector('[data-terrain-exaggeration-badge]')).toHaveTextContent(t('exaggeration.badge', { value }));
  });

  it('ο καμβάς έχει όνομα, εστίαση και περιγραφή για αναγνώστη οθόνης', () => {
    renderCanvas(1);
    const canvas = screen.getByLabelText(t('threeD.canvasLabel'));
    expect(canvas.tagName).toBe('CANVAS');
    expect(canvas).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('figure')).toHaveTextContent(t('threeD.description'));
  });

  it('«Αρχική όψη» = επαναφορά της μηχανής', () => {
    mockHome.mockClear();
    renderCanvas(1);
    fireEvent.click(screen.getByRole('button', { name: t('threeD.home') }));
    expect(mockHome).toHaveBeenCalledTimes(1);
  });
});
