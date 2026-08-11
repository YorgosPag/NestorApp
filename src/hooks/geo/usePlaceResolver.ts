'use client';

/**
 * @fileoverview **ΚΕΙΜΕΝΟ → ΣΗΜΕΙΟ** — μία διαδικασία εντοπισμού, δύο φόρμες.
 * @related ADR-777 §7 (Α5 · Α9 · Α14) · lib/geocoding/geocoding-service · CLAUDE.md N.18
 * @module hooks/geo/usePlaceResolver
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ ΓΕΩΚΩΔΙΚΟΠΟΙΗΣΗΣ — ΚΑΙ ΤΟ ΙΔΙΟ ΛΕΞΙΛΟΓΙΟ ΑΠΟΤΥΧΙΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Καλείται το **υπάρχον** `geocodeAddressDetailed`, ακριβώς όπως το κάνει και ο
 * `PlaceSearchBox` της οθόνης 1: κουβαλά ήδη **cache + in-flight dedup** και
 * επιστρέφει **διακριτή** ετυμηγορία — ώστε το *«δεν υπάρχει τέτοια περιοχή»* να μη
 * συγχέεται με *«μας έκοψε ο ρυθμιστής»*. Η πρώτη λέει στον άνθρωπο να
 * **ξαναγράψει**, η δεύτερη να **ξαναδοκιμάσει**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ: **ΤΟ CHECK 3.28 ΤΟ ΖΗΤΗΣΕ, ΜΕΣΑ ΣΤΟ ΙΔΙΟ COMMIT**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **ζήτηση** (Α9) ρωτά *«γύρω από πού ψάχνεις;»* και η **προσφορά** (Α14) *«πού
 * είναι το ακίνητό σου;»*. Δύο **διαφορετικές** ερωτήσεις τομέα — αλλά **ένας και ο
 * ίδιος** μηχανισμός: τέσσερις καταστάσεις, μία κλήση, και η ίδια σειρά χειρισμού.
 *
 * 🔑 **Ό,τι διαφέρει είναι ΤΙ ΚΡΑΤΑΕΙ ο καθένας**, και γι' αυτό οι δύο επανακλήσεις:
 * η ζήτηση κρατά **σημείο + ακτίνα** (το κείμενο είναι **αναζήτηση**, δεν
 * αποθηκεύεται)· η προσφορά κρατά **σημείο + ακρίβεια + το ίδιο το κείμενο** (είναι
 * **η δήλωση του ανθρώπου για το δικό του πράγμα**).
 *
 * ⚠️ **Η αποτυχία ΣΒΗΝΕΙ το προηγούμενο σημείο, και ο κανόνας ζει ΕΔΩ.** Αλλιώς ο
 * άνθρωπος που άλλαξε περιοχή και δεν εντοπίστηκε η νέα θα αποθήκευε την **παλιά** —
 * σιωπηλά, και με το σωστό κείμενο στην οθόνη. Γραμμένος σε δύο αντίγραφα, θα
 * μπορούσε να ξεχαστεί στο ένα.
 */

import { useCallback, useState } from 'react';

import { geocodeAddressDetailed } from '@/lib/geocoding/geocoding-service';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';

const logger = createModuleLogger('usePlaceResolver');

/**
 * Οι τέσσερις καταστάσεις — **ρητές**, ποτέ ένα `boolean` + ένα `string`.
 *
 * Ίδιο ιδίωμα με το `SubmitState` του `PlaceSearchBox`: το `not-found` και το `error`
 * έχουν **διαφορετική θεραπεία** για τον χρήστη.
 */
export type PlaceResolveState = 'idle' | 'resolving' | 'not-found' | 'error';

/** Ό,τι μάθαμε για τον τόπο — **με την ακρίβειά του**, που είναι ολόκληρη η Α5. */
export interface ResolvedPlace {
  readonly lat: number;
  readonly lng: number;
  readonly accuracy: GeocodingAccuracy;
}

export interface PlaceResolver {
  readonly state: PlaceResolveState;
  /** Εντοπίζει το κείμενο. Κενό κείμενο ⇒ **δεν κάνει τίποτα** (ούτε σφάλμα). */
  readonly resolve: (query: string) => Promise<void>;
  /** Επιστροφή στο `idle` — όταν ο άνθρωπος αρχίσει να πληκτρολογεί ξανά. */
  readonly reset: () => void;
}

export function usePlaceResolver(handlers: {
  /** Βρέθηκε: ο καλών αποθηκεύει **ό,τι τον αφορά**. */
  readonly onFound: (place: ResolvedPlace) => void;
  /** Δεν βρέθηκε ή απέτυχε: ο καλών **σβήνει** ό,τι κρατούσε. */
  readonly onCleared: () => void;
}): PlaceResolver {
  const [state, setState] = useState<PlaceResolveState>('idle');
  const { onFound, onCleared } = handlers;

  const reset = useCallback(() => setState('idle'), []);

  const resolve = useCallback(
    async (query: string): Promise<void> => {
      const trimmed = query.trim();
      if (trimmed === '') return;

      setState('resolving');
      // ⚠️ Ελεύθερο κείμενο → `city`: η μηχανή δοκιμάζει **free-form πρώτα**, οπότε
      // «Εγνατίας 147, Θεσσαλονίκη» λύνεται το ίδιο καλά με σκέτο «Θεσσαλονίκη».
      const outcome = await geocodeAddressDetailed({ city: trimmed });

      if (outcome.kind === 'found') {
        onFound({
          lat: outcome.result.lat,
          lng: outcome.result.lng,
          accuracy: outcome.result.accuracy,
        });
        setState('idle');
        return;
      }

      // 🔴 Η αποτυχία **ΣΒΗΝΕΙ** ό,τι κρατούσε ο καλών. Δες την επικεφαλίδα.
      onCleared();

      if (outcome.kind === 'not-found') {
        setState('not-found');
        return;
      }
      logger.warn('Ο εντοπισμός περιοχής απέτυχε', { data: { reason: outcome.reason } });
      setState('error');
    },
    [onFound, onCleared],
  );

  return { state, resolve, reset };
}
