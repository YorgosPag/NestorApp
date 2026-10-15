/**
 * Άγκυρες — ADR-840 §7.6: τα φίλτρα «Έργο / Κτίριο / Όροφος» της «Διαθέσιμα Ακίνητα» **ΕΧΟΥΝ επιλογές** και
 * **ΦΙΛΤΡΑΡΟΥΝ** — όχι απλώς «αποδίδονται» (η ψευδής επαλήθευση του §7.5).
 *
 * 1. `useHierarchyNames` λύνει όνομα από ταυτότητα πάνω στο `NavigationContext`· εκτός provider ⇒ `null`.
 * 2. `usePropertyFiltersConfig`: `value` = ταυτότητα, `label` = όνομα (`verbatim`), καταρράκτης έργο → κτίριο,
 *    ουδέτερη ετικέτα για άγνωστο όνομα, ισόγειο παρόν.
 * 3. **Η ΜΙΑ μηχανή** (ADR-840 Σ3: `usePropertyFiltersUrlState` + `usePropertyFilters`, όπως τα συνθέτει ο
 *    `usePropertyViewer`): επιλογή έργου/κτιρίου/ορόφου **μικραίνει** το `filteredProperties`· αλλαγή έργου
 *    καθαρίζει κτίριο άλλου έργου· οι **δύο** όψεις κατάστασης (διάθεση · λειτουργία) και η πληρότητα φιλτράρουν.
 *    (Ήταν ο `usePublicPropertyViewer` — η δεύτερη μηχανή, που διαγράφηκε στο Σ3.)
 *
 * Τα έγγραφα έχουν **μόνο** `projectId`/`buildingId` — ακριβώς το σχήμα του Firestore.
 */

import React from 'react';
import { act, renderHook } from '@testing-library/react';
import NavigationContext from '@/components/navigation/core/NavigationContext';
import { useHierarchyNames } from '@/components/navigation/core/hooks/useHierarchyNames';
import { usePropertyFiltersConfig } from '../hooks/usePropertyFiltersConfig';
import { propertyFiltersConfig } from '../configs/propertyFiltersConfig';
import type { FilterOption } from '../types';
import type { Property } from '@/types/property-viewer';
import { usePropertyFiltersUrlState } from '@/hooks/usePropertyFiltersUrlState';
import { usePropertyFilters } from '@/hooks/usePropertyFilters';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));


type NavigationValue = NonNullable<React.ContextType<typeof NavigationContext>>;

const BUILDINGS: Record<string, { id: string; name: string }> = {
  bld_A1: { id: 'bld_A1', name: 'Κτίριο Α.Ε.' },
  bld_B1: { id: 'bld_B1', name: 'Β1' },
  // bld_B2: χωρίς εγγραφή — «δεν έφτασε ακόμη»
};

const navigationValue = {
  projects: [
    { id: 'proj_A', name: 'Ζωγράφου' },
    { id: 'proj_B', name: 'Αμπελόκηποι' },
  ],
  getBuildingById: (id: string) => BUILDINGS[id],
} as unknown as NavigationValue;

function withNavigation({ children }: { children: React.ReactNode }) {
  return <NavigationContext.Provider value={navigationValue}>{children}</NavigationContext.Provider>;
}

/** Έγγραφο όπως το φέρνει ο provider: ταυτότητες ναι, `project`/`building` ΟΧΙ. */
function listed(id: string, projectId: string, buildingId: string, floor: number, extra: Partial<Property> = {}): Property {
  return {
    id,
    name: id,
    type: 'apartment',
    floor,
    projectId,
    buildingId,
    floorId: `${buildingId}-${floor}`,
    vertices: [],
    status: 'for-sale',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 100000 },
    areas: { gross: 80 },
    operationalStatus: 'ready',
    ...extra,
  } as unknown as Property;
}

const PROPERTIES: Property[] = [
  listed('a-ground', 'proj_A', 'bld_A1', 0),
  listed('a-first', 'proj_A', 'bld_A1', 1),
  listed('b1-second', 'proj_B', 'bld_B1', 2),
  listed('b2-third', 'proj_B', 'bld_B2', 3, {
    status: 'sold', commercialStatus: 'sold', operationalStatus: 'under-construction',
    propertyCoverage: { hasPhotos: true, hasFloorplans: true, hasDocuments: true },
  } as Partial<Property>),
];

function optionsOf(config: ReturnType<typeof usePropertyFiltersConfig>, fieldId: string): FilterOption[] {
  const field = config.rows.flatMap((row) => row.fields).find((f) => f.id === fieldId);
  if (!field?.options) throw new Error(`field ${fieldId} missing from the panel`);
  return field.options;
}

describe('useHierarchyNames — ο ένας επιλυτής ονομάτων', () => {
  it('λύνει έργο και κτίριο από ταυτότητα', () => {
    const { result } = renderHook(() => useHierarchyNames(), { wrapper: withNavigation });
    expect(result.current.projectName('proj_A')).toBe('Ζωγράφου');
    expect(result.current.buildingName('bld_B1')).toBe('Β1');
    expect(result.current.buildingName('bld_B2')).toBeNull();
    expect(result.current.projectName(undefined)).toBeNull();
  });

  it('εκτός provider δεν ρίχνει — απλώς δεν ξέρει κανένα όνομα', () => {
    const { result } = renderHook(() => useHierarchyNames());
    expect(result.current.projectName('proj_A')).toBeNull();
  });
});

describe('usePropertyFiltersConfig — επιλογές με ταυτότητα + όνομα', () => {
  it('έργα: ΜΗ κενά, value = projectId, label = όνομα (αυτούσιο), αλφαβητικά', () => {
    const { result } = renderHook(() => usePropertyFiltersConfig(PROPERTIES, propertyFiltersConfig), {
      wrapper: withNavigation,
    });
    expect(optionsOf(result.current, 'project')).toEqual([
      { value: 'all', label: 'filters.allProjects' },
      { value: 'proj_B', label: 'Αμπελόκηποι', verbatim: true },
      { value: 'proj_A', label: 'Ζωγράφου', verbatim: true },
    ]);
  });

  it('κτίριο με τελεία στο όνομα μένει δεδομένο· κτίριο χωρίς όνομα ⇒ ουδέτερη ετικέτα, ποτέ ωμή ταυτότητα', () => {
    const { result } = renderHook(() => usePropertyFiltersConfig(PROPERTIES, propertyFiltersConfig), {
      wrapper: withNavigation,
    });
    const buildings = optionsOf(result.current, 'building');
    expect(buildings).toContainEqual({ value: 'bld_A1', label: 'Κτίριο Α.Ε.', verbatim: true });
    expect(buildings[buildings.length - 1]).toEqual({ value: 'bld_B2', label: 'filters.unknownBuilding' });
  });

  it('καταρράκτης: επιλεγμένο έργο ⇒ το «Κτίριο» προσφέρει ΜΟΝΟ τα κτίρια του', () => {
    const { result } = renderHook(
      () => usePropertyFiltersConfig(PROPERTIES, propertyFiltersConfig, { project: ['proj_A'] }),
      { wrapper: withNavigation },
    );
    expect(optionsOf(result.current, 'building').map((o) => o.value)).toEqual(['all', 'bld_A1']);
    expect(optionsOf(result.current, 'floor').map((o) => o.value)).toEqual(['all', '0', '1']);
  });

  it('το ισόγειο (0) είναι επιλογή ορόφου, με αποδοσμένη ετικέτα', () => {
    const { result } = renderHook(() => usePropertyFiltersConfig(PROPERTIES, propertyFiltersConfig), {
      wrapper: withNavigation,
    });
    const ground = optionsOf(result.current, 'floor').find((o) => o.value === '0');
    expect(ground).toMatchObject({ verbatim: true });
    expect(ground?.label).not.toBe('');
  });
});

/** Η ΜΙΑ μηχανή, συντεθειμένη όπως στον `usePropertyViewer` (διεύθυνση → κριτής). */
function useEngine() {
  const { filters, updateFilters } = usePropertyFiltersUrlState(PROPERTIES);
  const { filteredProperties, stats } = usePropertyFilters(PROPERTIES, filters, false);
  return { filters, updateFilters, filteredProperties, stats };
}

describe('η ΜΙΑ μηχανή — η επιλογή ΦΙΛΤΡΑΡΕΙ τη λίστα', () => {
  beforeEach(() => {
    // ADR-840 §7.7 — τα φίλτρα ζουν στη ΔΙΕΥΘΥΝΣΗ: κάθε test ξεκινά από καθαρή.
    window.history.replaceState(null, '', '/o/ws/properties');
  });

  /** Η ειδοποίηση του `url-query-state` φεύγει σε microtask — βλ. `useSelectedEntityUrlState.test.ts`. */
  const flushUrl = () => act(async () => { await Promise.resolve(); });

  const visible = (rows: readonly Property[]) => rows.map((p) => p.id);

  it('έργο ⇒ μόνο τα ακίνητα του έργου', async () => {
    const { result } = renderHook(() => useEngine());
    expect(visible(result.current.filteredProperties)).toHaveLength(4);
    act(() => result.current.updateFilters({ project: ['proj_B'] }));
    await flushUrl();
    expect(visible(result.current.filteredProperties)).toEqual(['b1-second', 'b2-third']);
  });

  it('κτίριο και όροφος (ισόγειο) φιλτράρουν', async () => {
    const { result } = renderHook(() => useEngine());
    act(() => result.current.updateFilters({ building: ['bld_A1'], floor: ['0'] }));
    await flushUrl();
    expect(visible(result.current.filteredProperties)).toEqual(['a-ground']);
  });

  it('αλλαγή έργου καθαρίζει κτίριο άλλου έργου — η λίστα δεν αδειάζει σιωπηλά', async () => {
    const { result } = renderHook(() => useEngine());
    act(() => result.current.updateFilters({ project: ['proj_B'], building: ['bld_B1'] }));
    await flushUrl();
    act(() => result.current.updateFilters({ project: ['proj_A'] }));
    await flushUrl();
    expect(result.current.filters.building).toEqual([]);
    expect(visible(result.current.filteredProperties)).toEqual(['a-ground', 'a-first']);
  });

  it('το ταμπλό μετρά διακριτά κτίρια με ταυτότητα — πάνω σε ό,τι ΒΛΕΠΕΙΣ', async () => {
    const { result } = renderHook(() => useEngine());
    expect(result.current.stats.uniqueBuildings).toBe(3);
    act(() => result.current.updateFilters({ project: ['proj_A'] }));
    await flushUrl();
    expect(result.current.stats.uniqueBuildings).toBe(1);
  });

  /**
   * ADR-840 Σ3 — ΤΟ ΦΙΛΤΡΟ «ΚΑΤΑΣΤΑΣΗ» ΗΤΑΝ ΝΕΚΡΟ ΚΑΙ ΣΤΙΣ ΔΥΟ ΟΘΟΝΕΣ: ο ένας πίνακας έδινε `available`, ο άλλος
   * λειτουργικές τιμές, και η μηχανή τα σύγκρινε με το εμπορικό `status` (`for-sale`…) ⇒ ποτέ ταίριασμα.
   * ⛔ MUTATION: γύρισε τον κριτή σε `matchesArrayFilter(property.status, status)` ⇒ κόκκινο.
   */
  it('διάθεση: ο κουβάς `listed` κρατά ό,τι είναι στην αγορά — και το ταμπλό το μετρά', async () => {
    const { result } = renderHook(() => useEngine());
    expect(result.current.stats.onMarketProperties).toBe(3);
    act(() => result.current.updateFilters({ status: ['listed'] }));
    await flushUrl();
    expect(visible(result.current.filteredProperties)).toEqual(['a-ground', 'a-first', 'b1-second']);
    act(() => result.current.updateFilters({ status: ['sold'] }));
    await flushUrl();
    expect(visible(result.current.filteredProperties)).toEqual(['b2-third']);
  });

  it('λειτουργία και πληρότητα φιλτράρουν — και επιβιώνουν στη διεύθυνση', async () => {
    const { result } = renderHook(() => useEngine());
    act(() => result.current.updateFilters({ operationalStatus: ['under-construction'] }));
    await flushUrl();
    expect(visible(result.current.filteredProperties)).toEqual(['b2-third']);
    expect(window.location.search).toContain('opstatus=under-construction');

    act(() => result.current.updateFilters({ operationalStatus: [], coverage: { missingPhotos: true } }));
    await flushUrl();
    expect(visible(result.current.filteredProperties)).toEqual(['a-ground', 'a-first', 'b1-second']);
    expect(window.location.search).toContain('missing=photos');
    expect(result.current.stats.coverage.propertiesWithPhotos).toBe(0);
  });
});
