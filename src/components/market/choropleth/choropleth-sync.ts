'use client';

/**
 * @fileoverview **Ο συγχρονισμός ενός χωροπληθή με τον ΖΩΝΤΑΝΟ χάρτη** (ADR-890 §14.7 · §15) — καταστάσεις ανά
 * περιοχή, διάταξη στρώσεων, μοτίβο. Όλα **αυτοδιορθούμενα** πάνω στο `styledata`. Κοινός για τον χάρτη της
 * αναζήτησης (`search-results/price-map/price-map-sync.ts`) και τον χάρτη σύγκρισης της σελίδας Δήμου.
 * @related `price-map-paint.ts` (τι διαβάζουν οι καταστάσεις) · `lib/market/price-map-view.ts` (`featureStatesOf`)
 * @module components/market/choropleth/choropleth-sync
 *
 * 🔴 **Γιατί αυτοδιόρθωση και όχι «μία φορά στην προσάρτηση»** — μετρημένο ζωντανά 2026-09-28, διαλείπον:
 * η ενυδάτωση του θέματος **αλλάζει το στυλ υποβάθρου** (ADR-891). Η αλλαγή στυλ (α) ξαναφτιάχνει κάθε πηγή, άρα
 * **σβήνει τα `feature-state`**, (β) σβήνει τις εικόνες που προστέθηκαν, και (γ) ξαναπροσθέτει τις στρώσεις σε σειρά
 * που δεν ελέγχουμε: το `<Layer beforeId>` του `@vis.gl/react-maplibre` καλεί `addLayer(…, beforeId)` και, αν η
 * στρώση-στόχος δεν υπάρχει **ακόμη**, το MapLibre αρνείται και η στρώση **δεν προστίθεται ποτέ**. Γι' αυτό: καμία
 * `beforeId` στο JSX· η θέση, οι καταστάσεις και το μοτίβο αποκαθίστανται σε **κάθε** `styledata`, μόνο όταν χρειάζεται.
 */

import type { Map as MapInstance } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import type { BasemapScheme } from '@/lib/maps/basemap-catalog';
import type { PriceMapFeatureState } from '@/lib/market/price-map-view';

import { ensurePriceMapHatch } from './price-map-paint';

/** `[id περιοχής, κατάσταση]` — `null` = «καμία τιμή ακόμη» (ποτέ «λίγα» από άγνοια). */
export type ChoroplethStates = readonly (readonly [string, PriceMapFeatureState])[] | null;

/**
 * **Καταστάσεις ανά περιοχή + επιλογή, σε ΕΝΑ πέρασμα**, ξαναγραμμένες όταν αλλάξουν οι καταστάσεις/η επιλογή **ή** η
 * ίδια η πηγή (αλλαγή στυλ ⇒ νέο αντικείμενο πηγής ⇒ άδειες καταστάσεις). Ο καλών **απομνημονεύει** τις καταστάσεις:
 * η ταυτότητα του πίνακα είναι το σήμα «άλλαξαν».
 */
export function useFeatureStateSync(
  map: MapInstance | undefined,
  sourceId: string,
  states: ChoroplethStates,
  selectedId: string | null,
): void {
  const applied = useRef<{ source: unknown; states: unknown; selectedId: string | null } | null>(null);
  useEffect(() => {
    if (map === undefined) return;
    const apply = () => {
      const source = map.getSource(sourceId);
      if (source === undefined) return;
      const last = applied.current;
      if (last !== null && last.source === source && last.states === states && last.selectedId === selectedId) return;
      // 🔴 ΟΧΙ `removeFeatureState` πριν από τα `set` (μετρημένο ζωντανά 2026-09-28): το MapLibre συγχωνεύει τη διαγραφή
      //    ΜΕΤΑ τις εγγραφές του ίδιου καρέ, άρα έσβηνε ό,τι μόλις γράφτηκε (Δήμος με δική του τιμή ⇒ άβαφος). Γράφεται
      //    κατάσταση για ΚΑΘΕ περιοχή, οπότε καμία δεν κρατά μπαγιάτικη· η διαγραφή μένει μόνο για «καμία τιμή ακόμη».
      if (states === null) map.removeFeatureState({ source: sourceId });
      else for (const [id, state] of states) map.setFeatureState({ source: sourceId, id }, { ...state, s: id === selectedId });
      applied.current = { source, states, selectedId };
    };
    apply();
    map.on('styledata', apply);
    map.on('sourcedata', apply);
    return () => {
      map.off('styledata', apply);
      map.off('sourcedata', apply);
    };
  }, [map, selectedId, sourceId, states]);
}

/**
 * **Οι στρώσεις του χωροπληθή ΚΑΤΩ από την πρώτη υπαρκτή στρώση-στόχο** (όριο περιοχής, αγγελίες) — επανέλεγχος σε
 * κάθε αλλαγή στυλ. Ο καλών δίνει **σταθερούς** πίνακες (σταθερές module): αλλιώς κάθε απόδοση ξαναδένει ακροατή.
 */
export function useLayerOrderBelow(map: MapInstance | undefined, ownLayers: readonly string[], targets: readonly string[]): void {
  useEffect(() => {
    if (map === undefined) return;
    const place = () => {
      const target = targets.find((id) => map.getLayer(id) !== undefined);
      if (target === undefined) return;
      const order = map.getLayersOrder();
      const targetIndex = order.indexOf(target);
      // Μόνο όταν η σειρά είναι λάθος: το `moveLayer` γεννά `styledata`, και χωρίς τον έλεγχο θα ήταν βρόχος.
      for (const id of ownLayers) if (order.indexOf(id) > targetIndex) map.moveLayer(id, target);
    };
    place();
    map.on('styledata', place);
    return () => { map.off('styledata', place); };
  }, [map, ownLayers, targets]);
}

/** Το μοτίβο στο στυλ — και ξανά όταν το ζητήσει ο χάρτης (η αλλαγή στυλ σβήνει τις εικόνες που προστέθηκαν). */
export function useHatchImage(map: MapInstance | undefined, scheme: BasemapScheme): void {
  useEffect(() => {
    if (map === undefined) return;
    const ensure = () => ensurePriceMapHatch(map, scheme);
    ensure();
    map.on('styleimagemissing', ensure);
    return () => { map.off('styleimagemissing', ensure); };
  }, [map, scheme]);
}
