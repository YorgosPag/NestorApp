/**
 * Άγκυρες του breadcrumb θέσης στη γραμμή πλαισίου του θεατή.
 *
 * Κρίνεται ο **προσαρμογέας** (κατάσταση θεατή → περιγραφικό οντότητας → πότε αποδίδεται), όχι
 * το `NavigationBreadcrumb` ούτε το `useBreadcrumbSync` — αυτά είναι το κοινό SSoT και έχουν
 * δικά τους tests (ADR-016).
 *
 * @see ../ViewerLocationBreadcrumb
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ViewerLocationBreadcrumb } from '../ViewerLocationBreadcrumb';

const mockSync = jest.fn();
jest.mock('@/components/navigation/core/hooks/useBreadcrumbSync', () => ({
  useBreadcrumbSync: (entity: unknown) => mockSync(entity),
}));

const BUILDINGS: Record<string, { id: string; name: string; projectId: string | null }> = {
  bldg_1: { id: 'bldg_1', name: 'Κτήριο Α', projectId: 'prj_1' },
  bldg_orphan: { id: 'bldg_orphan', name: 'Χωρίς έργο', projectId: null },
};
let mockNavProperty: { id: string } | null = null;
let mockNavBuilding: { id: string } | null = null;
jest.mock('@/components/navigation/core/NavigationContext', () => ({
  useNavigation: () => ({
    selectedProperty: mockNavProperty,
    selectedBuilding: mockNavBuilding,
    getBuildingById: (id: string) => BUILDINGS[id],
  }),
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

jest.mock('../../../systems/levels', () => ({
  useLevels: () => ({ levels: [], currentLevelId: null }),
}));
let mockActiveBuildingId: string | null = null;
jest.mock('../../../systems/levels/hooks/useActiveBuildingId', () => ({
  useActiveBuildingId: () => mockActiveBuildingId,
}));

const PROPERTY_ENTITY = { type: 'property', id: 'prop_1', name: 'Διαμέρισμα 95 τ.μ.' };
const BUILDING_ENTITY = { type: 'building', id: 'bldg_1', name: 'Κτήριο Α', projectId: 'prj_1' };
const queryBreadcrumb = () => screen.queryByRole('navigation', { name: 'Breadcrumb' });

beforeEach(() => {
  mockSync.mockClear();
  mockPrimaryId = null;
  mockNavProperty = null;
  mockNavBuilding = null;
  mockActiveBuildingId = null;
});

describe('ViewerLocationBreadcrumb — το κοινό breadcrumb, από την κατάσταση του θεατή', () => {
  it('Β1: ούτε κτίριο ούτε επιλογή ⇒ τίποτα, και καθαρισμός (null)', () => {
    render(<ViewerLocationBreadcrumb />);

    expect(queryBreadcrumb()).not.toBeInTheDocument();
    expect(mockSync).toHaveBeenLastCalledWith(null);
  });

  it('Β2: ενεργό κτίριο ΧΩΡΙΣ επιλεγμένη περιοχή ⇒ ζητά το ΚΤΙΡΙΟ και σταματά εκεί', () => {
    mockActiveBuildingId = 'bldg_1';
    mockNavBuilding = { id: 'bldg_1' };
    render(<ViewerLocationBreadcrumb />);

    expect(mockSync).toHaveBeenLastCalledWith(BUILDING_ENTITY);
    expect(queryBreadcrumb()).toBeInTheDocument();
  });

  it('Β3: περιοχή ΧΩΡΙΣ συνδεδεμένο ακίνητο δεν κρύβει το κτίριο', () => {
    mockActiveBuildingId = 'bldg_1';
    mockPrimaryId = 'ovr_free';
    render(<ViewerLocationBreadcrumb />);

    expect(mockSync).toHaveBeenLastCalledWith(BUILDING_ENTITY);
  });

  it('Β4: συνδεδεμένη περιοχή ΚΕΡΔΙΖΕΙ το κτίριο ⇒ ζητά το ΑΚΙΝΗΤΟ', () => {
    mockActiveBuildingId = 'bldg_1';
    mockPrimaryId = 'ovr_linked';
    mockNavProperty = { id: 'prop_1' };
    render(<ViewerLocationBreadcrumb />);

    expect(mockSync).toHaveBeenLastCalledWith(PROPERTY_ENTITY);
    expect(queryBreadcrumb()).toBeInTheDocument();
  });

  it('Β5: όσο το context κρατά ΑΛΛΟ ακίνητο δεν αποδίδει — ποτέ μπαγιάτικο όνομα', () => {
    mockPrimaryId = 'ovr_linked';
    mockNavProperty = { id: 'prop_OTHER' };
    render(<ViewerLocationBreadcrumb />);

    expect(queryBreadcrumb()).not.toBeInTheDocument();
  });

  it('Β6: μετά την αποεπιλογή, όσο το context κρατά ακόμη το ΑΚΙΝΗΤΟ δεν αποδίδει ως κτίριο', () => {
    mockActiveBuildingId = 'bldg_1';
    mockNavBuilding = { id: 'bldg_1' };
    mockNavProperty = { id: 'prop_1' };
    render(<ViewerLocationBreadcrumb />);

    expect(mockSync).toHaveBeenLastCalledWith(BUILDING_ENTITY);
    expect(queryBreadcrumb()).not.toBeInTheDocument();
  });

  it('Β7: κτίριο ΧΩΡΙΣ γνωστό έργο ⇒ τίποτα (η αλυσίδα δεν λύνεται)', () => {
    mockActiveBuildingId = 'bldg_orphan';
    mockNavBuilding = { id: 'bldg_orphan' };
    render(<ViewerLocationBreadcrumb />);

    expect(mockSync).toHaveBeenLastCalledWith(null);
    expect(queryBreadcrumb()).not.toBeInTheDocument();
  });
});
