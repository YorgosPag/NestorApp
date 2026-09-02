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
import { addressLineToQuery } from '@/lib/geocoding/address-line-query';
import {
  houseNumberStanding,
  type HouseNumberStanding,
} from '@/lib/geocoding/house-number-standing';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

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
  /**
   * **Η ΔΙΕΥΘΥΝΣΗ ΟΠΩΣ ΤΗΝ ΚΑΤΑΛΑΒΕ Ο ΓΕΩΚΩΔΙΚΟΠΟΙΗΤΗΣ** — όχι όπως τη *έγραψε* ο
   * άνθρωπος.
   *
   * 🔴 **Οι δύο ΔΕΝ ταυτίζονται, και η διαφορά τους είναι ΟΛΟΚΛΗΡΗ Η ΕΠΑΛΗΘΕΥΣΗ.**
   * Ο άνθρωπος γράφει *«Σαμοθράκης 16, 56334»*· ο πάροχος μπορεί να απαντήσει
   * *«Σαμοθράκης, Εύοσμος, Θεσσαλονίκη»* — **χωρίς αριθμό**. Ίδιο κείμενο στην
   * οθόνη ⇒ ο άνθρωπος δεν έχει **κανέναν** τρόπο να δει ότι το 16 χάθηκε.
   *
   * ⚠️ **ΤΟ ΠΕΤΑΓΑΜΕ** (μετρημένο 2026-09-02): το `displayName` έφτανε από τον
   * διακομιστή σε **κάθε** κλήση και αυτός ο μεταφραστής κρατούσε μόνο lat/lng/βαθμό.
   * Η οθόνη ανάγκαζε τον άνθρωπο να επαληθεύσει τη διεύθυνσή του διαβάζοντας
   * **δεκαδικές συντεταγμένες** — δηλαδή δεν την επαλήθευε κανείς.
   *
   * ⛔ **Είναι ΕΠΙΒΕΒΑΙΩΣΗ, όχι δήλωση**: δεν αποθηκεύεται και δεν ταξιδεύει. Η
   * δήλωση του ανθρώπου για το δικό του ακίνητο παραμένει **το κείμενο που έγραψε**.
   */
  readonly label: string;
  /**
   * **Η μετρημένη έκταση του αποτελέσματος** — δες `lib/geo/geocoding-focus`.
   * `undefined` όταν ο πάροχος δεν τη δίνει· η απουσία είναι **δεδομένο**.
   */
  readonly extent?: GeoBoundingBox;
  /**
   * **ΠΟΥ ΣΤΕΚΕΤΑΙ Ο ΑΡΙΘΜΟΣ ΠΟΥ ΕΓΡΑΨΕ Ο ΑΝΘΡΩΠΟΣ** — δες {@link HouseNumberStanding}.
   *
   * 🔴 **Δεν προκύπτει από τον βαθμό ακρίβειας, και γι' αυτό είναι χωριστό πεδίο.** Ο
   * βαθμός περιγράφει **την απάντηση** («δρόμος χωρίς αριθμό»)· αυτό περιγράφει **τι
   * απέγινε η ερώτηση** («τον είπες, δεν επιβεβαιώθηκε»). Δύο διευθύνσεις με τον ίδιο
   * `interpolated` — η μία με δηλωμένο αριθμό, η άλλη χωρίς — χρωστούν στον άνθρωπο
   * **διαφορετική** πρόταση.
   */
  readonly houseNumber: HouseNumberStanding;
  /**
   * Ο αριθμός **όπως τον έγραψε ο άνθρωπος** — για να τον δει αυτούσιο στο μήνυμα.
   * `undefined` όταν το κείμενο δεν είχε αναγνωρίσιμο αριθμό.
   */
  readonly declaredNumber?: string;
  /**
   * Ο αριθμός **που επέστρεψε ο πάροχος**, όταν διαφέρει από τον δηλωμένο. Χωρίς
   * αυτόν, η κατάσταση `'contradicted'` θα έλεγε *«βρήκα άλλον»* **χωρίς να τον πει** —
   * δηλαδή θα ζητούσε από τον άνθρωπο να διορθώσει κάτι που δεν βλέπει.
   */
  readonly resolvedNumber?: string;
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
      /**
       * 🔴 **ΤΟ ΚΕΙΜΕΝΟ ΑΝΑΛΥΕΤΑΙ ΠΡΙΝ ΦΥΓΕΙ** (2026-09-02) — δες
       * {@link addressLineToQuery}. Πριν, ολόκληρο το «Σαμοθράκης 16, 56334» πήγαινε
       * στο **ένα** πεδίο `city`, οπότε ο διακομιστής **δεν μάθαινε ποτέ** ότι
       * δηλώθηκε αριθμός — και η στάση του αριθμού ήταν δομικά ανέφικτη.
       *
       * ⚠️ **Η μηχανή δοκιμάζει free-form πρώτα, και το ερώτημα εκείνης της
       * παραλλαγής μένει ΤΑΥΤΟΣΗΜΟ** μετά τη δόμηση — άγκυρα:
       * `app/api/geocoding/__tests__/geocoding-query-identity.test.ts`.
       */
      const request = addressLineToQuery(trimmed);
      const outcome = await geocodeAddressDetailed(request);

      if (outcome.kind === 'found') {
        onFound({
          lat: outcome.result.lat,
          lng: outcome.result.lng,
          accuracy: outcome.result.accuracy,
          label: outcome.result.displayName,
          extent: outcome.result.extent,
          // ⚠️ `fieldMatches.number` είναι **προαιρετικό στον τύπο** (ο `FieldMatchMap`
          //    παράγεται από τα προαιρετικά κλειδιά του `ResolvedAddressFields`) — γι'
          //    αυτό το `houseNumberStanding` δέχεται `undefined` ως `'absent'`.
          houseNumber: houseNumberStanding(outcome.result.reasoning.fieldMatches.number),
          declaredNumber: request.number,
          resolvedNumber: outcome.result.resolvedFields.number,
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
