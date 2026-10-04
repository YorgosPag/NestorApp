'use client';

/**
 * @fileoverview **Οι δημόσιες μονάδες ενός κτιρίου** (ADR-900 §8 #2, 2β.4) — ανάγνωση του `public_units`.
 * @module services/realtime/hooks/usePublicUnits
 *
 * Η συλλογή είναι `read: if true` (επίπεδο Α), άρα η οθόνη τη διαβάζει **απευθείας** — ίδιο σχήμα με το
 * `usePublicPlace` / `usePublicListings`. Μία ανάγνωση (όχι συνδρομή): οι μονάδες γεννιούνται με επαλήθευση
 * κατοχής, όχι με ρυθμό που χρειάζεται ζωντανή ροή.
 *
 * ⚠️ Ένα φίλτρο ισότητας μόνο (`buildingId`): η κατάσταση (`approved`/`historical`) κρίνεται στο
 * `publicUnitLevels`, ώστε το ερώτημα να μη χρειάζεται σύνθετο δείκτη.
 */

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { db } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import type { PublicUnit } from '@/types/geo/public-place';

const logger = createModuleLogger('usePublicUnits');

export type PublicUnitsState =
  | { readonly state: 'idle' }
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly units: readonly PublicUnit[] }
  | { readonly state: 'error' };

/** `buildingId === null` ⇒ `idle` (γη χωρίς κτίριο δεν έχει οριζόντιες ιδιοκτησίες). */
export function usePublicUnits(buildingId: string | null): PublicUnitsState {
  const [units, setUnits] = useState<PublicUnitsState>({ state: 'idle' });

  useEffect(() => {
    if (buildingId === null) {
      setUnits({ state: 'idle' });
      return;
    }
    // Ακύρωση: ο άνθρωπος μπορεί να αλλάξει κτίριο ενώ ταξιδεύει η προηγούμενη ανάγνωση.
    let live = true;
    setUnits({ state: 'loading' });

    void (async () => {
      try {
        // tenant-scope-exempt: επίπεδο Α (`public-world`, tenant-config) — κοινό σε όλους, χωρίς companyId.
        const snap = await getDocs(query(collection(db, COLLECTIONS.PUBLIC_UNITS), where('buildingId', '==', buildingId)));
        if (live) setUnits({ state: 'ready', units: snap.docs.map((d) => ({ ...(d.data() as Omit<PublicUnit, 'id'>), id: d.id })) });
      } catch (error) {
        logger.error('Δεν διαβάστηκαν οι μονάδες του κτιρίου', {
          data: { buildingId },
          error: error instanceof Error ? error.message : String(error),
        });
        if (live) setUnits({ state: 'error' });
      }
    })();

    return () => {
      live = false;
    };
  }, [buildingId]);

  return units;
}
