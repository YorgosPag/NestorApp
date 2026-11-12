'use client';

/**
 * ADR-929 Δ21 (δ) βήμα 1 — οι **μικρογραφίες** της λίστας «Τι διάβασα»: για κάθε κείμενο, το απόσπασμα της εικόνας από το
 * οποίο διαβάστηκε (η τιμή δίπλα στο τεκμήριό της — πρακτική Microsoft Content Understanding, «grounding»).
 *
 * 🔑 **Κάτοχος του κύκλου ζωής των object URL**: κάθε URL που δημιουργείται εδώ ανακαλείται εδώ — σε νέα ανάγνωση, νέα
 *   αναγνώριση ή κλείσιμο (cleanup του effect). Καμία διαρροή, κανένα URL σε store.
 * 🔑 Από την ανάγνωση της **μηχανής**: τα πλαίσια δεν αλλάζουν με τις διορθώσεις, άρα μια διόρθωση δεν ξαναφτιάχνει
 *   μικρογραφίες. Ο provider διαβάζεται τη στιγμή της δουλειάς (getter, ADR-040).
 * 🔑 Ακύρωση: αν αλλάξει η ανάγνωση στο μεταξύ, ό,τι έχει ήδη φτιαχτεί ανακαλείται και τίποτα δεν γράφεται.
 *
 * @see ../floorplan-background/providers/provider-plan-raster.ts (`cropPlanRegion`)
 */

import * as React from 'react';
import { getFloorProvider } from '../floorplan-background/stores/floorplanBackgroundStore';
import type { PlanReadingOutcome } from '../bim/plan-recognition/plan-recognition-types';
import { PLAN_READ_THUMB_MAX_EDGE_PX, planReadThumbRect } from '../systems/plan-recognition/plan-read-values';

/** Ανώτατο πλήθος μικρογραφιών ανά ανάγνωση (μια σελίδα με εκατοντάδες κείμενα δεν παράγει εκατοντάδες εικόνες). */
const MAX_THUMBNAILS = 150;

const NO_THUMBNAILS: ReadonlyMap<string, string> = new Map();

/** `textId → object URL`. Άδειο χωρίς ανάγνωση ή υπόβαθρο. */
export function usePlanReadValueThumbnails(floorId: string | null, reading: PlanReadingOutcome | null): ReadonlyMap<string, string> {
  const [thumbnails, setThumbnails] = React.useState<ReadonlyMap<string, string>>(NO_THUMBNAILS);
  React.useEffect(() => {
    setThumbnails(NO_THUMBNAILS);
    const provider = floorId ? getFloorProvider(floorId) : null;
    if (!provider || reading?.status !== 'read') return undefined;
    const created: string[] = [];
    let cancelled = false;
    void (async () => {
      const next = new Map<string, string>();
      for (const text of reading.reading.texts.slice(0, MAX_THUMBNAILS)) {
        const blob = await provider
          .getRegionImage(planReadThumbRect(text.rect), PLAN_READ_THUMB_MAX_EDGE_PX)
          .catch(() => null); // μια μικρογραφία που αποτυγχάνει απλώς λείπει· η λίστα δουλεύει χωρίς αυτήν
        if (cancelled) return;
        if (blob === null) continue;
        const url = URL.createObjectURL(blob);
        created.push(url);
        next.set(text.id, url);
      }
      setThumbnails(next);
    })();
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [floorId, reading]);
  return thumbnails;
}
