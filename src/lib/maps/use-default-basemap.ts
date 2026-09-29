'use client';

/**
 * @fileoverview **Ο ΧΑΡΤΗΣ ΦΟΝΤΟΥ ΚΑΘΕ ΧΑΡΤΗ ΧΩΡΙΣ ΔΙΑΚΟΠΤΗ ΥΠΟΒΑΘΡΟΥ** — ο δικός μας, στο θέμα της εφαρμογής, με εφεδρεία.
 * @related ADR-891 Φ4 (§10) · `basemap-catalog.ts` (`DEFAULT_BASEMAP_SOURCE_ID`) · `protomaps-style.ts` · `use-basemap-scheme.ts`
 * @module lib/maps/use-default-basemap
 *
 * 🔑 **ΕΝΑ ΦΟΝΤΟ ΣΕ ΟΛΗ ΤΗΝ ΕΦΑΡΜΟΓΗ.** Ο χάρτης θέσης, η σελίδα περιοχής, η εμβέλεια και ο ΙΚΑ έδειχναν άλλο φόντο
 * (`tile.openstreetmap.org`, raster) από τον δημόσιο χάρτη (PMTiles, ADR-891 §9). Όποιος χάρτης δεν έχει διακόπτη
 * υποβάθρου παίρνει το φόντο **από εδώ**: `<Map {...useDefaultBasemap()} …>`.
 *
 * 🔑 **ΕΦΕΔΡΕΙΑ ΑΠΟ ΤΟ ΓΕΓΟΝΟΣ, ΟΧΙ ΑΠΟ ΡΟΛΟΪ.** Ο δημόσιος χάρτης μαντεύει την αποτυχία με χρονόμετρα φόρτωσης. Εδώ
 * κρίνει το ίδιο το σφάλμα της MapLibre: σφάλμα **της πηγής φόντου χωρίς πλακίδιο** σημαίνει ότι δεν διαβάστηκε η κεφαλίδα
 * του αρχείου, δηλαδή ότι ο διακομιστής δεν απαντά. Τότε, **μία φορά**, το φόντο γίνεται η δηλωμένη εφεδρεία του μητρώου.
 * Σφάλμα **ενός** πλακιδίου ή μιας στρώσης του καταναλωτή δεν αλλάζει τίποτα.
 *
 * ⚠️ Η εφεδρεία **δεν** είναι προεπιλογή: ο χάρτης **ανοίγει** πάντα στον δικό μας διακομιστή. Η απόδοση του φόντου
 * (και της εφεδρείας) ζωγραφίζεται από το σύνορο `maplibre.ts`, από τις πηγές του στυλ (ADR-891 §8).
 */

import { useCallback, useState } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import type { MapProps } from '@/lib/maps/maplibre';
import { BASEMAP_FALLBACK_SOURCE_ID, DEFAULT_BASEMAP_SOURCE_ID, basemapStyle } from './basemap-catalog';
import { protomapsStyle } from './protomaps-style';
import { useBasemapScheme } from './use-basemap-scheme';

export type MapErrorEvent = Parameters<NonNullable<MapProps['onError']>>[0];

interface DefaultBasemap {
  /** Ό,τι δέχεται το `mapStyle` της MapLibre. */
  readonly mapStyle: string | StyleSpecification;
  /** Ο ανιχνευτής της αποτυχίας του φόντου — περνά στο `onError` του `<Map>`. */
  readonly onError: (event: MapErrorEvent) => void;
}

/**
 * Έπεσε **ο διακομιστής φόντου**; — σφάλμα με `sourceId` την πηγή φόντου και **χωρίς** `tile`. Η MapLibre βάζει το
 * `sourceId` σε κάθε σφάλμα πηγής και το `tile` μόνο σε σφάλμα πλακιδίου (`tile_manager.ts`, `style.ts`).
 */
export function isBasemapSourceFailure(event: MapErrorEvent): boolean {
  const detail: object = event;
  return 'sourceId' in detail && detail.sourceId === DEFAULT_BASEMAP_SOURCE_ID && !('tile' in detail && detail.tile);
}

export function useDefaultBasemap(): DefaultBasemap {
  const scheme = useBasemapScheme();
  const [failedOver, setFailedOver] = useState(false);

  const onError = useCallback((event: MapErrorEvent) => {
    if (isBasemapSourceFailure(event)) setFailedOver(true);
  }, []);

  const mapStyle = failedOver ? basemapStyle(BASEMAP_FALLBACK_SOURCE_ID) : protomapsStyle(DEFAULT_BASEMAP_SOURCE_ID, scheme);
  return { mapStyle, onError };
}
