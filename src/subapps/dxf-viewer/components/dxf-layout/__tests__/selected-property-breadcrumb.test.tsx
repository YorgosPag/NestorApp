/**
 * Άγκυρες του breadcrumb επιλεγμένου ακινήτου στη γραμμή πλαισίου του θεατή.
 *
 * Κρίνεται ο **προσαρμογέας** (επιλεγμένη περιοχή → ακίνητο → πότε αποδίδεται), όχι το
 * `NavigationBreadcrumb` ούτε το `useBreadcrumbSync` — αυτά είναι το κοινό SSoT και έχουν δικά
 * τους tests (ADR-016).
 *
 * @see ../SelectedPropertyBreadcrumb
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { SelectedPropertyBreadcrumb } from '../SelectedPropertyBreadcrumb';

const mockSync = jest.fn();
jest.mock('@/components/navigation/core/hooks/useBreadcrumbSync', () => ({
  useBreadcrumbSync: (entity: unknown) => mockSync(entity),
}));

let mockNavProperty: { id: string } | null = null;
jest.mock('@/components/navigation/core/NavigationContext', () => ({
  useNavigation: () => ({ selectedProperty: mockNavProperty }),
}));

jest.mock('@/components/navigation/components/NavigationBreadcrumb', () => ({
  NavigationBreadcrumb: () => <nav aria-label="Breadcrumb" />,
}));

let mockPrimaryId: string | null = null;
jest.mock('../../../systems/selection', () => ({
  useUniversalSelection: () => ({ getPrimaryId: () => mockPrimaryId }),
}));

const mockOverlays = {
  ovr_linked: { id: 'ovr_linked', label: 'Διαμέρισμα 95 τ.μ.', linked: { propertyId: 'prop_1' } },
  ovr_free: { id: 'ovr_free', label: 'Χωρίς σύνδεση' },
};
jest.mock('../../../overlays/overlay-store', () => ({
  useOverlayStore: () => ({ overlays: mockOverlays }),
}));

beforeEach(() => {
  mockSync.mockClear();
  mockPrimaryId = null;
  mockNavProperty = null;
});

describe('SelectedPropertyBreadcrumb — το κοινό breadcrumb, μόνο για το επιλεγμένο ακίνητο', () => {
  it('Β1: χωρίς επιλογή δεν αποδίδει τίποτα και ζητά καθαρισμό (null)', () => {
    render(<SelectedPropertyBreadcrumb />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(mockSync).toHaveBeenLastCalledWith(null);
  });

  it('Β2: περιοχή ΧΩΡΙΣ συνδεδεμένο ακίνητο δεν αποδίδει τίποτα', () => {
    mockPrimaryId = 'ovr_free';
    mockNavProperty = { id: 'prop_1' };
    render(<SelectedPropertyBreadcrumb />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(mockSync).toHaveBeenLastCalledWith(null);
  });

  it('Β3: συνδεδεμένη περιοχή ζητά την ιεραρχία του ΑΚΙΝΗΤΟΥ της από το κοινό hook', () => {
    mockPrimaryId = 'ovr_linked';
    render(<SelectedPropertyBreadcrumb />);

    expect(mockSync).toHaveBeenLastCalledWith({
      type: 'property', id: 'prop_1', name: 'Διαμέρισμα 95 τ.μ.',
    });
  });

  it('Β4: όσο το context κρατά ΑΛΛΟ ακίνητο δεν αποδίδει — ποτέ μπαγιάτικο όνομα', () => {
    mockPrimaryId = 'ovr_linked';
    mockNavProperty = { id: 'prop_OTHER' };
    render(<SelectedPropertyBreadcrumb />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('Β5: μόλις το context λύσει ΑΥΤΟ το ακίνητο, αποδίδεται το κοινό NavigationBreadcrumb', () => {
    mockPrimaryId = 'ovr_linked';
    mockNavProperty = { id: 'prop_1' };
    render(<SelectedPropertyBreadcrumb />);

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });
});
