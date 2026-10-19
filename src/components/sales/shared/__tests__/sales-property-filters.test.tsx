/**
 * Άγκυρες — ADR-840 §7.9: τα φίλτρα «Έργο / Κτίριο / Όροφος / Τύπος» των σελίδων **πωλήσεων**
 * (Διαθέσιμα · Πωληθέντα) **ΕΧΟΥΝ επιλογές** και **ΦΙΛΤΡΑΡΟΥΝ**.
 *
 * 🔴 Γιατί χωριστό αρχείο: το `property-location-filters.test.tsx` δήλωνε στην κεφαλίδα του ότι φυλάει «τα
 * φίλτρα της Διαθέσιμα Ακίνητα», αλλά εκτελούσε τη μηχανή της οθόνης **ακινήτων**. Οι σελίδες πωλήσεων
 * περνούσαν τη **στατική** σταθερά ⇒ μόνο «Όλα» — κάλυψη σε δίδυμο, όχι στον ασθενή. Εδώ εκτελείται ο
 * **ίδιος** controller που καλούν οι δύο σελίδες (`useSalesPropertiesListPage`).
 */

import React from 'react';
import { act, renderHook } from '@testing-library/react';
import NavigationContext from '@/components/navigation/core/NavigationContext';
import type { Property } from '@/types/property-viewer';
import type { FilterOption, UnitFilterState } from '@/components/core/AdvancedFilters';
import { useSalesPropertiesListPage, toPanelFilters, fromPanelFilters } from '../use-sales-properties-list-page';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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
  listed('a-first', 'proj_A', 'bld_A1', 1, { type: 'maisonette' } as Partial<Property>),
  listed('b1-second', 'proj_B', 'bld_B1', 2, { operationalStatus: 'under-construction' } as Partial<Property>),
];

jest.mock('@/contexts/SharedPropertiesProvider', () => ({
  useSharedProperties: () => ({ properties: PROPERTIES, isLoading: false, forceDataRefresh: jest.fn() }),
}));

type NavigationValue = NonNullable<React.ContextType<typeof NavigationContext>>;
const navigationValue = {
  projects: [{ id: 'proj_A', name: 'Ζωγράφου' }, { id: 'proj_B', name: 'Αμπελόκηποι' }],
  getBuildingById: (id: string) => ({ bld_A1: { id, name: 'Α1' }, bld_B1: { id, name: 'Β1' } } as Record<string, unknown>)[id],
} as unknown as NavigationValue;

function wrapper({ children }: { children: React.ReactNode }) {
  return <NavigationContext.Provider value={navigationValue}>{children}</NavigationContext.Provider>;
}

type Page = ReturnType<typeof useSalesPropertiesListPage>;

function values(page: Page, fieldId: string): string[] {
  const field = page.filtersConfig.rows.flatMap((row) => row.fields).find((f) => f.id === fieldId);
  if (!field?.options) throw new Error(`field ${fieldId} missing from the panel`);
  return field.options.map((o: FilterOption) => o.value);
}

const ids = (page: Page) => page.state.filteredUnits.map((u) => u.id).sort();

function choose(page: Page, change: Partial<UnitFilterState>) {
  act(() => page.onAdvancedFiltersChange({ ...page.panelFilters, ...change }));
}

describe('useSalesPropertiesListPage — οι επιλογές ΥΠΑΡΧΟΥΝ (ήταν μόνο «Όλα»)', () => {
  it('έργο · κτίριο · όροφος · τύπος έχουν τις πραγματικές τιμές της προβολής', () => {
    const { result } = renderHook(() => useSalesPropertiesListPage(), { wrapper });
    expect(values(result.current, 'project')).toEqual(['all', 'proj_B', 'proj_A']);
    expect(values(result.current, 'building')).toEqual(['all', 'bld_A1', 'bld_B1']);
    expect(values(result.current, 'floor')).toEqual(['all', '0', '1', '2']);
    expect(values(result.current, 'type')).toEqual(['all', 'apartment', 'maisonette']);
  });
});

describe('useSalesPropertiesListPage — η επιλογή ΦΙΛΤΡΑΡΕΙ', () => {
  it('έργο ⇒ μόνο τα ακίνητα του έργου, και ο καταρράκτης στενεύει το «Κτίριο»', () => {
    const { result } = renderHook(() => useSalesPropertiesListPage(), { wrapper });
    choose(result.current, { project: ['proj_A'] });
    expect(ids(result.current)).toEqual(['a-first', 'a-ground']);
    expect(values(result.current, 'building')).toEqual(['all', 'bld_A1']);
  });

  it('όροφος (ισόγειο 0) και τύπος φιλτράρουν', () => {
    const { result } = renderHook(() => useSalesPropertiesListPage(), { wrapper });
    choose(result.current, { floor: ['0'] });
    expect(ids(result.current)).toEqual(['a-ground']);
    choose(result.current, { floor: [], type: ['maisonette'] });
    expect(ids(result.current)).toEqual(['a-first']);
  });

  it('αλλαγή έργου καθαρίζει κτίριο ΑΛΛΟΥ έργου — η λίστα δεν αδειάζει σιωπηλά', () => {
    const { result } = renderHook(() => useSalesPropertiesListPage(), { wrapper });
    choose(result.current, { building: ['bld_B1'] });
    expect(ids(result.current)).toEqual(['b1-second']);
    choose(result.current, { project: ['proj_A'] });
    expect(result.current.panelFilters.building).toEqual([]);
    expect(ids(result.current)).toEqual(['a-first', 'a-ground']);
  });

  it('η «Κατάσταση» (λειτουργική) φιλτράρει — πριν δεν έφτανε ποτέ στην κατάσταση', () => {
    const { result } = renderHook(() => useSalesPropertiesListPage(), { wrapper });
    choose(result.current, { status: ['under-construction'] });
    expect(ids(result.current)).toEqual(['b1-second']);
  });
});

describe('αντιστοίχιση panel ⇄ κατάσταση — ρητή, όχι cast', () => {
  it('μετ\' επιστροφής: ό,τι δείχνει το panel ξαναδιαβάζεται ως η ίδια επιλογή', () => {
    const { result } = renderHook(() => useSalesPropertiesListPage(), { wrapper });
    choose(result.current, { project: ['proj_B'], floor: ['2'], type: ['apartment'] });
    const shown = result.current.panelFilters;
    expect(shown).toMatchObject({ project: ['proj_B'], floor: ['2'], type: ['apartment'] });
    expect(toPanelFilters({ ...result.current.state.filters, ...fromPanelFilters(shown) })).toEqual(shown);
  });
});
