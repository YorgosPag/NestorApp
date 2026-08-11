'use client';

/**
 * @fileoverview **ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΤΟΥ ΤΟΠΟΥ, ΖΩΝΤΑΝΑ** — ο καταναλωτής που έλειπε.
 * @related ADR-777 · SPEC-777A §13.4 (ODbL) · §13.7.3 · app/api/places/[placeId]/outline
 * @module hooks/geo/usePlaceOutline
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΔΙΑΔΡΟΜΗ ΥΠΗΡΧΕ, ΔΟΥΛΕΥΕ, ΚΑΙ **ΚΑΝΕΙΣ ΔΕΝ ΤΗΝ ΚΑΛΟΥΣΕ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Β2 έγραψε το `/api/places/[placeId]/outline` — το σημείο όπου το νομικό όριο του
 * §13.4 γίνεται μηχανισμός: το περίγραμμα **δείχνεται** και δεν **αποθηκεύεται**. Και
 * έμεινε **χωρίς έναν καταναλωτή**, δηλαδή ένα σωστό μισό ενός μηχανισμού που ποτέ δεν
 * εκτελέστηκε. Αυτό το αρχείο είναι το άλλο μισό.
 *
 * ⚠️ **Η μνήμη ΕΔΩ είναι θεμιτή, η μνήμη σε ΒΑΣΗ δεν είναι** (§13.4). Το περίγραμμα ζει
 * σε κατάσταση React — μνήμη **περιηγητή**, ίδιος μηχανισμός με ένα καρέ χάρτη που δεν
 * ζητιέται δύο φορές. Μια **συλλογή** περιγραμμάτων σε δική μας βάση θα ήταν
 * *«συστηματική συγκέντρωση»* και ενεργοποιεί το share-alike. ⛔ **Ούτε «για απόδοση».**
 *
 * ⚠️ **Το «δεν μάθαμε» ΔΕΝ γίνεται «δεν έχει σχήμα».** Η διαδρομή απαντά **503** ακριβώς
 * για να μη συγχωνευθούν, και είναι το ίδιο λάθος που η Β2 πλήρωσε **μέσα στο αρχείο
 * που το τεκμηριώνει** (§13.7.2 #5): 11 άγκυρες πράσινες, και το βρήκε ζωντανή δοκιμή
 * όταν το δημόσιο Overpass μας έκοψε (**2 slots ανά IP**). Αν συγχωνεύονταν εδώ, ο
 * χάρτης θα έλεγε ήρεμα *«αυτό το κτίριο δεν έχει σχήμα»* για κτίριο που μόλις είδαμε.
 */

import { useEffect, useState } from 'react';

import { createModuleLogger } from '@/lib/telemetry';
import type { GeoOutline } from '@/types/geo/coordinates';

const logger = createModuleLogger('usePlaceOutline');

/** 429 = *«σε κόψαμε»*, 503 = *«δεν απάντησε η πηγή»*. **Και τα δύο: «δεν μάθαμε».** */
const DID_NOT_LEARN_STATUSES: ReadonlySet<number> = new Set([429, 503]);

/**
 * **Πέντε ρητές καταστάσεις** — καμία δεν καλύπτει δεύτερη.
 *
 * | Κατάσταση | Τι λέει στον άνθρωπο |
 * |---|---|
 * | `idle` | δεν ζητήθηκε τόπος — **δεν είναι φόρτωση** |
 * | `loading` | ρωτάμε |
 * | `outline` | ορίστε το σχήμα |
 * | `none` | αυτός ο τόπος **δεν έχει** σχήμα να δειχθεί (δεν ήρθε από OSM· `node`/`relation`· το στοιχείο έσβησε) |
 * | `unavailable` | **δεν μάθαμε** — ξαναδοκίμασε, μην αλλάξεις τίποτα |
 * | `failed` | το αίτημα ήταν λάθος (π.χ. ταυτότητα που δεν είναι τόπος) — η επανάληψη **δεν** θα βοηθήσει |
 */
export type PlaceOutlineState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'outline'; readonly outline: GeoOutline }
  | { readonly kind: 'none' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

/**
 * Το ζωντανό περίγραμμα ενός τόπου του επιπέδου Α.
 *
 * @param placeId `pbld_*` ή `land_*`, ή `null` όταν δεν υπάρχει τόπος να ρωτηθεί.
 */
export function usePlaceOutline(placeId: string | null): PlaceOutlineState {
  const [state, setState] = useState<PlaceOutlineState>({ kind: 'idle' });

  useEffect(() => {
    if (placeId === null || placeId.trim() === '') {
      setState({ kind: 'idle' });
      return;
    }

    // ⚠️ `AbortController` και όχι σημαία: το αίτημα προς το Overpass είναι **αργό**
    // (δευτερόλεπτα), και ένας άνθρωπος που αλλάζει τόπο δεν πρέπει να κρατά ζωντανή
    // μια κλήση που κανείς δεν θα διαβάσει — ιδίως με **2 slots ανά IP**.
    const controller = new AbortController();
    setState({ kind: 'loading' });

    void (async () => {
      try {
        const response = await fetch(
          `/api/places/${encodeURIComponent(placeId)}/outline`,
          { signal: controller.signal },
        );

        if (DID_NOT_LEARN_STATUSES.has(response.status)) {
          setState({ kind: 'unavailable' });
          return;
        }
        if (!response.ok) {
          setState({ kind: 'failed' });
          return;
        }

        const body = (await response.json()) as { outline: GeoOutline | null };
        setState(
          body.outline !== null && body.outline.length >= 3
            ? { kind: 'outline', outline: body.outline }
            : { kind: 'none' },
        );
      } catch (error) {
        // Η ακύρωση **δεν είναι αποτυχία** — είναι εντολή μας. Χωρίς αυτόν τον έλεγχο
        // κάθε αλλαγή τόπου θα άφηνε πίσω της ένα ψεύτικο «δεν μάθαμε».
        if (controller.signal.aborted) return;
        logger.warn('Το περίγραμμα δεν απάντησε', { data: { placeId }, error: String(error) });
        setState({ kind: 'unavailable' });
      }
    })();

    return () => controller.abort();
  }, [placeId]);

  return state;
}
