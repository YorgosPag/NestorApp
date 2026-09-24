'use client';

/**
 * **ΠΟΙΑ ΣΗΜΕΙΑ ΖΩΓΡΑΦΙΣΕ Ο ΧΑΡΤΗΣ ΧΩΡΙΣΤΑ** — η ανάγνωση από το MapLibre και ο φορέας της προς
 * τις πινακίδες (ADR-777 §8.78).
 *
 * 🔑 **Ρωτάμε τον χάρτη τι ζωγράφισε — δεν ξαναϋπολογίζουμε την ομαδοποίηση.** Ένα δεύτερο
 * supercluster στο JS θα έπρεπε να συμφωνεί με του worker (ακτίνα κλιμακωμένη σε `extent`
 * 8192, ζουμ πλακιδίου, υπερ-ζουμ) — δύο μηχανές για μία ερώτηση, που «πρέπει» να συμφωνούν.
 * Το `querySourceFeatures` διαβάζει **την ίδια** απόφαση που ζωγραφίστηκε: ομάδα ⇒ έχει
 * `point_count`, μεμονωμένο σημείο ⇒ έχει `id`.
 *
 * ⏱️ **Στο `idle`**: τότε ο χάρτης έχει τελειώσει κίνηση **και** φόρτωση πλακιδίων ⇒ η απάντηση
 * είναι πλήρης. Μέσα σε κίνηση οι πινακίδες κρατούν την προηγούμενη απάντηση (ίδια
 * συμπεριφορά με τους δείκτες του Redfin, που ξαναστήνονται όταν σταματήσει ο χάρτης).
 *
 * 🔑 **Context, όχι prop** — ίδιος λόγος με το `StayTotalsContext`: οι πινακίδες ζουν στα
 * `children` του καταναλωτή, ο χάρτης στον πυρήνα. Η **προεπιλογή `'all'`** είναι αληθής έξω
 * από τον πυρήνα: χωρίς ομαδοποιητή, κάθε σημείο ζωγραφίζεται μόνο του.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { CLUSTER_KEY } from '@/lib/maps/listing-clusters';
import type { DrawnListingPoints } from '@/lib/listings/listing-price-markers';
import type { MapEventTarget, RenderedFeature } from './results-map-contract';

/**
 * Η απάντηση του χάρτη στο τελευταίο `idle`: **ποια** σημεία ζωγραφίστηκαν χωριστά, και **σε ποιο
 * ζουμ**. Το ζουμ είναι η μόνη μεταβλητή που αλλάζει τις **σχετικές** θέσεις των πινακίδων (το
 * σύρσιμο τις μετακινεί όλες μαζί) ⇒ είναι το σήμα «ξαναμέτρησε συγκρούσεις» (κανόνας 5).
 */
export interface DrawnListingSnapshot {
  readonly points: DrawnListingPoints;
  readonly zoom: number | null;
}

const OUTSIDE_MAP_CORE: DrawnListingSnapshot = { points: 'all', zoom: null };
const DrawnListingPointsContext = createContext<DrawnListingSnapshot>(OUTSIDE_MAP_CORE);

interface DrawnListingPointsProviderProps {
  readonly drawn: DrawnListingPoints;
  readonly zoom: number | null;
  readonly children: React.ReactNode;
}

export function DrawnListingPointsProvider({ drawn, zoom, children }: DrawnListingPointsProviderProps) {
  const value = useMemo(() => ({ points: drawn, zoom }), [drawn, zoom]);
  return <DrawnListingPointsContext.Provider value={value}>{children}</DrawnListingPointsContext.Provider>;
}

/** Τα σημεία που ο χάρτης ζωγράφισε χωριστά — δες {@link DrawnListingPoints}. */
export function useDrawnListingPoints(): DrawnListingPoints {
  return useContext(DrawnListingPointsContext).points;
}

/** Το ζουμ του τελευταίου `idle` — `null` έξω από τον πυρήνα ή πριν απαντήσει ο χάρτης. */
export function usePlaqueLayoutZoom(): number | null {
  return useContext(DrawnListingPointsContext).zoom;
}

/**
 * Οι ταυτότητες των **μεμονωμένων** σημείων στα φορτωμένα πλακίδια της πηγής.
 *
 * ⚠️ Το ίδιο σημείο μπορεί να επιστραφεί από **δύο** πλακίδια (κοντά σε όριο) — το `Set` το
 * απορροφά. Σημεία εκτός φορτωμένων πλακιδίων δεν είναι ορατά ⇒ η πινακίδα τους δεν λείπει.
 */
export function readDrawnListingPoints(features: readonly RenderedFeature[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const feature of features) {
    const properties = feature.properties;
    if (properties === undefined || CLUSTER_KEY.pointCount in properties) continue;
    const id = properties.id;
    if (typeof id === 'string') ids.add(id);
  }
  return ids;
}

/**
 * Δέσε την ανάγνωση στο `idle` — **μία** φορά, στο `load` (κανόνας 2 του ADR-040: ο καλών
 * δίνει σταθερό χειριστή, ώστε η ταυτότητά του να μην αγγίζει το `onMapReady`).
 *
 * ⚠️ Το `sourceId` το δίνει ο πυρήνας (`POINT_SOURCE_ID`): αυτό το αρχείο το εισάγουν και οι
 * πινακίδες, και **δεν** πρέπει να σέρνει μαζί του τα επίπεδα του χάρτη.
 */
export function bindDrawnListingPoints(
  target: MapEventTarget,
  sourceId: string,
  onDrawn: (snapshot: DrawnListingSnapshot) => void,
): void {
  target.on('idle', () => onDrawn({
    points: readDrawnListingPoints(target.querySourceFeatures(sourceId)),
    zoom: target.getZoom(),
  }));
}
