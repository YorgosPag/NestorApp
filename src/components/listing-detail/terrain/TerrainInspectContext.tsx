'use client';

/**
 * @fileoverview **Ο ΠΑΡΟΧΟΣ ΤΗΣ ΕΠΙΘΕΩΡΗΣΗΣ ΕΔΑΦΟΥΣ** — ένα store ανά θεατή, και ο επιλογέας με τον οποίο κάθε φύλλο ρωτά ΜΟΝΟ
 *   ό,τι το αφορά (ADR-920 §14.10).
 * @related ./terrain-inspect-store (η κατάσταση) · ./TerrainViewStage (ο πάροχος, γύρω από Κάτοψη ΚΑΙ 3Δ)
 * @module components/listing-detail/terrain/TerrainInspectContext
 *
 * 🔑 Χωρίς πάροχο (π.χ. ο χάρτης σε test ή στο PDF) τα hooks απαντούν «τίποτα» — ποτέ σφάλμα, ποτέ hover.
 */

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';

import { TERRAIN_INSPECT_IDLE, createTerrainInspectStore, type TerrainInspectState, type TerrainInspectStore } from './terrain-inspect-store';

const TerrainInspectContext = createContext<TerrainInspectStore | null>(null);
/** Το παγκόσμιο κέντρο (mm) — υπάρχει ΜΟΝΟ στην προεπισκόπηση του ιδιοκτήτη (Δ3)· στη δημόσια αγγελία `null`. */
const TerrainWorldCentreContext = createContext<PlanarPoint | null>(null);

interface TerrainInspectProviderProps {
  readonly snapshot: ListingTerrainSnapshot;
  /** ADR-920 §14.10 — μόνο από την προεπισκόπηση του ιδιοκτήτη· η δημόσια αγγελία δεν το έχει και δεν το περνά. */
  readonly worldCentreMm?: PlanarPoint | null;
  readonly children: ReactNode;
}

export function TerrainInspectProvider({ snapshot, worldCentreMm = null, children }: TerrainInspectProviderProps) {
  const store = useMemo(() => createTerrainInspectStore(snapshot), [snapshot]);
  return (
    <TerrainInspectContext.Provider value={store}>
      <TerrainWorldCentreContext.Provider value={worldCentreMm}>{children}</TerrainWorldCentreContext.Provider>
    </TerrainInspectContext.Provider>
  );
}

/** Το παγκόσμιο κέντρο της επιφάνειας, ή `null` (δημόσια αγγελία — μόνο τοπικές συντεταγμένες). */
export function useTerrainWorldCentre(): PlanarPoint | null {
  return useContext(TerrainWorldCentreContext);
}

/** Το store του θεατή — για τους χειριστές συμβάντων (γράφουν), ποτέ για απόδοση. `null` χωρίς πάροχο. */
export function useTerrainInspectStore(): TerrainInspectStore | null {
  return useContext(TerrainInspectContext);
}

const noSubscribe = () => () => undefined;
const idle = (): TerrainInspectState => TERRAIN_INSPECT_IDLE;

/**
 * Ένα κομμάτι της κατάστασης. Ο επιλογέας πρέπει να επιστρέφει πρωτογενή τιμή ή αντικείμενο της ίδιας της κατάστασης
 * (ποτέ νέο αντικείμενο) — τότε ξαναποδίδεται μόνο όταν αλλάξει η απάντηση.
 */
export function useTerrainInspect<R>(selector: (state: TerrainInspectState) => R): R {
  const store = useContext(TerrainInspectContext);
  const get = store?.get ?? idle;
  const snapshot = useCallback(() => selector(get()), [selector, get]);
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, snapshot, () => selector(TERRAIN_INSPECT_IDLE));
}
