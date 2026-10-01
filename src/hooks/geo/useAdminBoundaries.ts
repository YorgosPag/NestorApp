'use client';

/**
 * @fileoverview **Τα όρια ΠΟΛΛΩΝ περιοχών, ως ΕΝΑ σχήμα** — η δηλωμένη εμβέλεια ενός επαγγελματία
 * σε δήμους / περιφέρειες / κοινότητες, πάνω στον χάρτη του καταλόγου (ADR-896).
 * @related ADR-883 · hooks/geo/useAdminBoundary · lib/geo/admin-boundaries · lib/agency/coverage-geometry
 * @module hooks/geo/useAdminBoundaries
 *
 * 🔑 **Γιατί όχι N × `useAdminBoundary`**: τα hooks δεν καλούνται σε βρόχο, και το πλήθος των
 * περιοχών αλλάζει από επαγγελματία σε επαγγελματία. Εδώ ζητούνται **παράλληλα**, από την **ίδια**
 * κρυφή μνήμη πηγών (`adminBoundarySource`) — ένα όριο που φορτώθηκε μία φορά δεν ξαναζητείται,
 * όποιος κι αν το ζήτησε πρώτος.
 *
 * 🔑 **Μερική αποτυχία ≠ συνολική**: αν έρθουν τα 4 από τα 5 όρια, ζωγραφίζονται τα 4 και το
 * `missing` το λέει. Να μη ζωγραφιστεί τίποτα επειδή έλειψε ένα θα έκρυβε τη δήλωση ολόκληρη.
 *
 * ⚠️ **Αργοπορημένη απάντηση για ΠΑΛΙΑ ερώτηση δεν γράφεται ποτέ**: ο άνθρωπος περνά γρήγορα από
 * κάρτα σε κάρτα, και τα όρια του προηγούμενου θα ζωγραφίζονταν πάνω στον επόμενο.
 */

import { useEffect, useState } from 'react';

import { adminBoundarySource } from '@/lib/geo/admin-boundaries';
import { mergeMultiPolygons } from '@/lib/agency/coverage-geometry';

export type AdminBoundariesState =
  | { readonly status: 'none' }
  | { readonly status: 'loading'; readonly key: string }
  | {
      readonly status: 'ready';
      readonly key: string;
      readonly geometry: GeoJSON.MultiPolygon;
      /** Πόσα όρια **δεν** ήρθαν — `0` = όλη η δήλωση ζωγραφίζεται. */
      readonly missing: number;
    };

async function loadAll(adminIds: readonly string[]): Promise<{ geometry: GeoJSON.MultiPolygon; missing: number }> {
  const sources = adminIds.map(adminBoundarySource);
  // `allSettled`: μία αποτυχία δεν ακυρώνει τις άλλες — το `peek() === null` τη μετρά στο `missing`.
  await Promise.allSettled(sources.map((source) => source.load()));
  const loaded = sources.map((source) => source.peek());
  const parts = loaded.flatMap((boundary) => (boundary === null ? [] : [boundary.geometry]));
  return { geometry: mergeMultiPolygons(parts), missing: loaded.length - parts.length };
}

/** @param adminIds `null` / κενό = καμία ερώτηση. */
export function useAdminBoundaries(adminIds: readonly string[] | null): AdminBoundariesState {
  const key = adminIds === null ? '' : adminIds.join('|');
  const [answer, setAnswer] = useState<AdminBoundariesState>({ status: 'none' });

  useEffect(() => {
    if (key === '') return;
    let live = true;
    void loadAll(key.split('|')).then(({ geometry, missing }) => {
      if (live) setAnswer({ status: 'ready', key, geometry, missing });
    });
    return () => {
      live = false;
    };
  }, [key]);

  if (key === '') return { status: 'none' };
  // 🔑 Η απάντηση ανήκει σε **αυτή** την ερώτηση μόνο αν ταιριάζει το κλειδί — αλλιώς φορτώνει.
  return answer.status === 'ready' && answer.key === key ? answer : { status: 'loading', key };
}
