/**
 * Characterization tests — property viewer hook composition.
 *
 * Γράφτηκαν ΠΡΙΝ το de-duplication refactor (N.18 / ADR-584) σε ΑΤΕΣΤΩΤΑ hooks
 * και τρέχουν αναλλοίωτα ΠΡΙΝ και ΜΕΤΑ. Κλειδώνουν ακριβώς ό,τι ρισκάρει το merge:
 *
 *  1. τη ΛΙΣΤΑ ΠΕΔΙΩΝ του `usePropertyEditor` (γραφόταν 3×: return / destructure / re-export)
 *  2. το κενό `FilterState` (γραφόταν 2×: DEFAULT_FILTERS / DEFAULT_PUBLIC_FILTERS)
 *  3. τα μηδενικά `PropertyStats` (γραφόταν 2×: DEFAULT_STATS / emptyStats)
 *  4. ότι ο viewer ΔΕΝ εκθέτει το `handleUpdateProperty` του usePolygonHandlers
 *     αλλά το guarded — σιωπηλή απώλεια σε spread refactor.
 */

import { renderHook, act } from '@testing-library/react';

import { usePropertyEditor } from '../usePropertyEditor';
import { usePropertyFilters } from '../usePropertyFilters';
import { usePropertyViewer } from '../usePropertyViewer';
import { usePublicPropertyViewer } from '../usePublicPropertyViewer';
import type { FilterState, Property } from '@/types/property-viewer';
import type { PropertyStats } from '@/types/property';

// ============================================================================
// Mocks — lazy deref μέσα στα factories (jest.mock hoisting trap)
// ============================================================================

const mockUseSharedProperties = jest.fn();
const mockUsePublicProperties = jest.fn();
const mockUsePolygonHandlers = jest.fn();
const mockUseGuardedPropertyMutation = jest.fn();
const mockNotifySuccess = jest.fn();
const mockNotifyError = jest.fn();

jest.mock('@/contexts/SharedPropertiesProvider', () => ({
  useSharedProperties: (...args: unknown[]) => mockUseSharedProperties(...args),
}));

jest.mock('@/services/realtime/hooks/usePublicProperties', () => ({
  usePublicProperties: (...args: unknown[]) => mockUsePublicProperties(...args),
}));

jest.mock('../usePolygonHandlers', () => ({
  usePolygonHandlers: (...args: unknown[]) => mockUsePolygonHandlers(...args),
}));

jest.mock('@/hooks/useGuardedPropertyMutation', () => ({
  useGuardedPropertyMutation: (...args: unknown[]) => mockUseGuardedPropertyMutation(...args),
}));

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    error: (...args: unknown[]) => mockNotifyError(...args),
  }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// ============================================================================
// Fixtures
// ============================================================================

/** Η λίστα πεδίων του editor — ΤΟ συμβόλαιο. Γραφόταν 3× σε 2 αρχεία. */
const EDITOR_FIELDS = [
  'activeTool',
  'showGrid',
  'snapToGrid',
  'gridSize',
  'showMeasurements',
  'scale',
  'showHistoryPanel',
  'suggestionToDisplay',
  'connections',
  'groups',
  'isConnecting',
  'firstConnectionPoint',
  'viewMode',
  'showDashboard',
  'filters',
] as const;

const editorSetterOf = (field: string) => `set${field[0].toUpperCase()}${field.slice(1)}`;

/** Οι ΤΙΜΕΣ του κενού FilterState — γραμμένες εδώ ΑΝΕΞΑΡΤΗΤΑ από τον κώδικα. */
const EXPECTED_EMPTY_FILTERS: FilterState = {
  searchTerm: '',
  project: [],
  building: [],
  floor: [],
  propertyType: [],
  status: [],
  priceRange: { min: undefined, max: undefined },
  areaRange: { min: undefined, max: undefined },
  features: [],
};

/** Οι ΤΙΜΕΣ των μηδενικών PropertyStats — γραμμένες εδώ ΑΝΕΞΑΡΤΗΤΑ από τον κώδικα. */
const EXPECTED_ZERO_STATS: PropertyStats = {
  totalProperties: 0,
  availableProperties: 0,
  totalValue: 0,
  totalArea: 0,
  averagePrice: 0,
  propertiesByStatus: {},
  propertiesByType: {},
  propertiesByFloor: {},
  totalStorageUnits: 0,
  availableStorageUnits: 0,
  uniqueBuildings: 0,
  underConstructionProperties: 0,
  maintenanceProperties: 0,
  inspectionProperties: 0,
  draftProperties: 0,
};

const makeProperty = (over: Partial<Property> = {}): Property =>
  ({
    id: 'p1',
    name: 'Unit 1',
    type: 'apartment',
    project: 'proj-a',
    building: 'bld-a',
    floor: 1,
    status: 'available',
    price: 100_000,
    area: 80,
    features: [],
    ...over,
  }) as Property;

const PolygonDialogsStub = () => null;
const ImpactDialogStub = () => null;
const polygonOwnUpdateProperty = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();

  mockUseSharedProperties.mockReturnValue({
    properties: [],
    setProperties: jest.fn(),
    floors: [],
    isLoading: false,
    forceDataRefresh: jest.fn(),
  });

  mockUsePublicProperties.mockReturnValue({ properties: [], loading: false });

  mockUsePolygonHandlers.mockReturnValue({
    handlePolygonCreated: jest.fn(),
    handlePolygonUpdated: jest.fn(),
    handleDuplicate: jest.fn(),
    handleDelete: jest.fn(),
    handlePolygonSelect: jest.fn(),
    // Το usePolygonHandlers ΕΠΙΣΤΡΕΦΕΙ δικό του handleUpdateProperty — ο viewer
    // το αγνοεί σκόπιμα υπέρ του guarded. Το κρατάμε στο mock ώστε το τεστ να
    // πιάσει τυχόν spread που θα το άφηνε να διαρρεύσει.
    handleUpdateProperty: polygonOwnUpdateProperty,
    PropertyDeletionDialogs: PolygonDialogsStub,
  });

  mockUseGuardedPropertyMutation.mockReturnValue({
    checking: false,
    reset: jest.fn(),
    ImpactDialog: ImpactDialogStub,
    runPreviewedMutation: jest.fn(),
    runExistingPropertyUpdate: jest.fn().mockResolvedValue(true),
    runRevertUpdate: jest.fn(),
  });
});

// ============================================================================
// 1. usePropertyEditor — η ΠΗΓΗ της λίστας πεδίων
// ============================================================================

describe('usePropertyEditor — field-list contract', () => {
  it('εκθέτει ακριβώς τα 15 πεδία + τους 15 setters τους, τίποτε άλλο', () => {
    const { result } = renderHook(() => usePropertyEditor());

    const expectedKeys = [
      ...EDITOR_FIELDS,
      ...EDITOR_FIELDS.map(editorSetterOf),
    ].sort();

    expect(Object.keys(result.current).sort()).toEqual(expectedKeys);
  });

  it.each([
    ['activeTool', null],
    ['showGrid', true],
    ['snapToGrid', true],
    ['gridSize', 10],
    ['showMeasurements', false],
    ['scale', 0.05],
    ['showHistoryPanel', false],
    ['suggestionToDisplay', null],
    ['connections', []],
    ['groups', []],
    ['isConnecting', false],
    ['firstConnectionPoint', null],
    ['viewMode', 'list'],
    ['showDashboard', false],
  ])('αρχική τιμή %s = %p', (field, expected) => {
    const { result } = renderHook(() => usePropertyEditor());
    expect(result.current[field as keyof typeof result.current]).toEqual(expected);
  });

  it('αρχικά filters = το κενό FilterState', () => {
    const { result } = renderHook(() => usePropertyEditor());
    expect(result.current.filters).toEqual(EXPECTED_EMPTY_FILTERS);
  });

  it.each(EDITOR_FIELDS.filter((f) => f !== 'filters'))('ο setter του %s ενημερώνει την τιμή', (field) => {
    const { result } = renderHook(() => usePropertyEditor());
    const setter = result.current[editorSetterOf(field) as keyof typeof result.current] as (v: unknown) => void;

    act(() => setter('SENTINEL'));

    expect(result.current[field as keyof typeof result.current]).toBe('SENTINEL');
  });
});

// ============================================================================
// 2. usePropertyFilters — τα μηδενικά stats
// ============================================================================

describe('usePropertyFilters — zero-stats contract', () => {
  it('χωρίς properties επιστρέφει τα μηδενικά PropertyStats', () => {
    const { result } = renderHook(() =>
      usePropertyFilters(null as unknown as Property[], EXPECTED_EMPTY_FILTERS),
    );

    expect(result.current.filteredProperties).toEqual([]);
    expect(result.current.stats).toEqual(EXPECTED_ZERO_STATS);
  });

  it('χωρίς filters επιστρέφει τα μηδενικά PropertyStats', () => {
    const { result } = renderHook(() =>
      usePropertyFilters([makeProperty()], null as unknown as FilterState),
    );

    expect(result.current.filteredProperties).toEqual([]);
    expect(result.current.stats).toEqual(EXPECTED_ZERO_STATS);
  });

  it('αποκλείει storage units από τη λίστα Units', () => {
    const { result } = renderHook(() =>
      usePropertyFilters(
        [makeProperty({ id: 'u1' }), makeProperty({ id: 's1', type: 'storage' })],
        EXPECTED_EMPTY_FILTERS,
      ),
    );

    expect(result.current.filteredProperties.map((p) => p.id)).toEqual(['u1']);
  });

  it('κρατά storage units όταν excludeStorageUnits=false', () => {
    const { result } = renderHook(() =>
      usePropertyFilters(
        [makeProperty({ id: 'u1' }), makeProperty({ id: 's1', type: 'storage' })],
        EXPECTED_EMPTY_FILTERS,
        false,
      ),
    );

    expect(result.current.filteredProperties.map((p) => p.id)).toEqual(['u1', 's1']);
  });
});

// ============================================================================
// 3. usePropertyViewer — η σύνθεση (ό,τι ρισκάρει το spread refactor)
// ============================================================================

describe('usePropertyViewer — composition contract', () => {
  it.each(EDITOR_FIELDS)('περνά το πεδίο %s του editor στην επιφάνειά του', (field) => {
    const editor = renderHook(() => usePropertyEditor());
    const viewer = renderHook(() => usePropertyViewer());

    expect(viewer.result.current).toHaveProperty(field);
    expect(viewer.result.current[field as keyof typeof viewer.result.current]).toEqual(
      editor.result.current[field as keyof typeof editor.result.current],
    );
  });

  it.each(EDITOR_FIELDS.map(editorSetterOf))('περνά τον setter %s του editor στην επιφάνειά του', (setter) => {
    const { result } = renderHook(() => usePropertyViewer());
    expect(typeof result.current[setter as keyof typeof result.current]).toBe('function');
  });

  it.each(EDITOR_FIELDS.filter((f) => f !== 'filters'))(
    'ο setter του %s μέσω viewer ενημερώνει την τιμή (ζωντανό wiring, όχι σκέτο σχήμα)',
    (field) => {
      const { result } = renderHook(() => usePropertyViewer());
      const setter = result.current[editorSetterOf(field) as keyof typeof result.current] as (v: unknown) => void;

      act(() => setter('SENTINEL'));

      expect(result.current[field as keyof typeof result.current]).toBe('SENTINEL');
    },
  );

  it('εκθέτει το GUARDED handleUpdateProperty, ΟΧΙ αυτό του usePolygonHandlers', () => {
    const { result } = renderHook(() => usePropertyViewer());

    expect(typeof result.current.handleUpdateProperty).toBe('function');
    expect(result.current.handleUpdateProperty).not.toBe(polygonOwnUpdateProperty);
  });

  it('τα filters περνούν στο usePropertyFilters (setFilters → φιλτραρισμένο αποτέλεσμα)', () => {
    mockUseSharedProperties.mockReturnValue({
      properties: [makeProperty({ id: 'u1', name: 'Alpha' }), makeProperty({ id: 'u2', name: 'Beta' })],
      setProperties: jest.fn(),
      floors: [],
      isLoading: false,
      forceDataRefresh: jest.fn(),
    });

    const { result } = renderHook(() => usePropertyViewer());
    expect(result.current.filteredProperties).toHaveLength(2);

    act(() => result.current.setFilters({ ...EXPECTED_EMPTY_FILTERS, searchTerm: 'Alpha' }));

    expect(result.current.filteredProperties.map((p) => p.id)).toEqual(['u1']);
  });

  it('το isConnecting/firstConnectionPoint του editor φτάνει στο usePolygonHandlers', () => {
    const { result } = renderHook(() => usePropertyViewer());

    act(() => result.current.setIsConnecting(true));

    expect(mockUsePolygonHandlers).toHaveBeenLastCalledWith(
      expect.objectContaining({ isConnecting: true, firstConnectionPoint: null }),
    );
  });

  it('χωρίς properties επιστρέφει τα μηδενικά PropertyStats', () => {
    const { result } = renderHook(() => usePropertyViewer());
    expect(result.current.stats).toEqual(EXPECTED_ZERO_STATS);
  });

  it('εκθέτει τα dialogs και το checking flag του guard', () => {
    const { result } = renderHook(() => usePropertyViewer());

    expect(result.current.checkingPropertyMutation).toBe(false);
    expect(result.current.PropertyMutationImpactDialog).toBe(ImpactDialogStub);
    expect(result.current.PropertyDeletionDialogs).toBe(PolygonDialogsStub);
  });
});

// ============================================================================
// 4. usePublicPropertyViewer — το δεύτερο αντίγραφο του κενού FilterState
// ============================================================================

describe('usePublicPropertyViewer — empty-FilterState contract', () => {
  it('αρχικά filters = το ΙΔΙΟ κενό FilterState με τον authenticated viewer', () => {
    const { result } = renderHook(() => usePublicPropertyViewer());
    expect(result.current.filters).toEqual(EXPECTED_EMPTY_FILTERS);
  });

  it('παραμένει read-only mirror (οι δυνατότητες editing μένουν κλειστές)', () => {
    const { result } = renderHook(() => usePublicPropertyViewer());

    expect(result.current.isReadOnly).toBe(true);
    expect(result.current.activeTool).toBeNull();
    expect(result.current.isConnecting).toBe(false);
  });
});
