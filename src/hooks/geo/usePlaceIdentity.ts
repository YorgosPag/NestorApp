'use client';

/**
 * @fileoverview **ΧΕΙΡΟΝΟΜΙΑ → ΤΑΥΤΟΤΗΤΑ ΤΟΠΟΥ**, από την πλευρά της οθόνης.
 * @related ADR-777 · SPEC-777A §13.3 · §13.6 · §14.4 · app/api/places/**
 * @module hooks/geo/usePlaceIdentity
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Ο ΠΕΛΑΤΗΣ ΔΕΝ ΥΠΟΛΟΓΙΖΕΙ **ΤΙΠΟΤΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αυτό το hook στέλνει **μόνο ό,τι έκανε ο άνθρωπος** — ένα σημείο, έναν δακτύλιο, ή
 * το αναγνωριστικό ενός κτιρίου που **ο διακομιστής** του έδειξε. Δεν στέλνει
 * `provenance`, δεν στέλνει συντεταγμένες «εκ μέρους» του OSM, δεν συνθέτει
 * διεύθυνση. Ο λόγος είναι ο §14.4 κανόνας 2, και ζει στον τύπο `PlaceClaim`: ό,τι
 * είναι **συμπέρασμα** το βγάζει ξανά ο διακομιστής από την πηγή.
 *
 * ⚠️ **Το `duplicate-candidate` ΔΕΝ είναι σφάλμα** και δεν χειρίζεται ως τέτοιο. Είναι
 * **ερώτηση** που γύρισε ο διακομιστής επειδή το §13.3 του απαγορεύει να αποφασίσει
 * μόνος του. Η οθόνη οφείλει να τη δείξει και να περιμένει άνθρωπο.
 *
 * ⚠️ **Το «δεν απάντησε» ΔΕΝ γίνεται «δεν υπάρχει».** Η διαδρομή γυρίζει **503** και
 * εδώ γίνεται `unavailable` — ξεχωριστή κατάσταση από το `none`. Αν συγχωνεύονταν,
 * μια διακοπή δικτύου θα έσπρωχνε τον άνθρωπο να **ζωγραφίσει** κτίριο που υπάρχει
 * ήδη στον χάρτη, γεννώντας δεύτερη ταυτότητα για ένα φυσικό πράγμα (§14.5).
 */

import { useCallback, useState } from 'react';

import { createModuleLogger } from '@/lib/telemetry';
import type { PlaceClaim, PlaceTarget } from '@/lib/places/place-claim';
import type { PlaceClaimDefect } from '@/lib/places/place-claim-validation';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';
import type { OsmElementType, PlaceRef } from '@/types/geo/public-place';

const logger = createModuleLogger('usePlaceIdentity');

// =============================================================================
// 1. «ΤΙ ΥΠΑΡΧΕΙ ΕΔΩ;»
// =============================================================================

export type BuildingLookup =
  | {
      readonly kind: 'found';
      readonly elementType: OsmElementType;
      readonly elementId: string;
      readonly outline: GeoOutline;
      readonly displayAddress: string | null;
    }
  | { readonly kind: 'none' }
  | { readonly kind: 'outside-area' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'idle' }
  | { readonly kind: 'searching' };

// =============================================================================
// 2. «ΚΑΤΑΧΩΡΗΣΕ ΤΟΝ»
// =============================================================================

export type PlaceIdentityState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working' }
  | { readonly kind: 'settled'; readonly ref: PlaceRef; readonly created: boolean }
  /** **Ερώτηση**, όχι σφάλμα (§13.3). */
  | { readonly kind: 'duplicate'; readonly existing: PlaceRef; readonly displayAddress: string | null }
  | { readonly kind: 'malformed'; readonly defect: PlaceClaimDefect }
  | { readonly kind: 'rejected'; readonly reason: string }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

interface ResolveResponseBody {
  readonly place?: PlaceRef;
  readonly created?: boolean;
  readonly duplicateOf?: PlaceRef;
  readonly displayAddress?: string | null;
  readonly error?: string;
  readonly detail?: string;
}

export interface PlaceIdentity {
  readonly lookup: BuildingLookup;
  readonly state: PlaceIdentityState;
  /** «Τι υπάρχει σε αυτό το σημείο;» — **δεν γράφει τίποτα**. */
  readonly look: (point: GeoPoint) => Promise<void>;
  /** «Καταχώρησε αυτή τη χειρονομία.» */
  readonly claim: (claim: PlaceClaim, target: PlaceTarget, distinctFromNearby?: boolean) => Promise<void>;
  readonly reset: () => void;
}

export function usePlaceIdentity(): PlaceIdentity {
  const [lookup, setLookup] = useState<BuildingLookup>({ kind: 'idle' });
  const [state, setState] = useState<PlaceIdentityState>({ kind: 'idle' });

  const reset = useCallback(() => {
    setLookup({ kind: 'idle' });
    setState({ kind: 'idle' });
  }, []);

  const look = useCallback(async (point: GeoPoint): Promise<void> => {
    setLookup({ kind: 'searching' });
    // Κάθε νέα ματιά ακυρώνει προηγούμενη **απόφαση**: αλλιώς ο άνθρωπος θα υπέβαλλε
    // το κτίριο που κοίταζε πριν αλλάξει γνώμη.
    setState({ kind: 'idle' });

    try {
      const response = await fetch(
        `/api/places/lookup?lat=${encodeURIComponent(point.lat)}&lng=${encodeURIComponent(point.lng)}`,
      );

      if (response.status === 422) return setLookup({ kind: 'outside-area' });
      if (!response.ok) return setLookup({ kind: 'unavailable' });

      const body = (await response.json()) as
        | { found: true; elementType: OsmElementType; elementId: string; outline: GeoOutline; displayAddress: string | null }
        | { found: false };

      setLookup(body.found ? { ...body, kind: 'found' } : { kind: 'none' });
    } catch (error) {
      logger.warn('Η αναζήτηση κτιρίου δεν απάντησε', { error: String(error) });
      setLookup({ kind: 'unavailable' });
    }
  }, []);

  const claim = useCallback(
    async (placeClaim: PlaceClaim, target: PlaceTarget, distinctFromNearby = false): Promise<void> => {
      setState({ kind: 'working' });

      try {
        const response = await fetch('/api/places/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claim: placeClaim, target, distinctFromNearby }),
        });

        const body = (await response.json().catch(() => ({}))) as ResolveResponseBody;

        // ⚠️ Η **ερώτηση** ελέγχεται πρώτη, και ταξιδεύει με 200 — ένας έλεγχος
        // `response.ok` που την προσπερνούσε θα την έχανε σιωπηλά.
        if (body.duplicateOf !== undefined) {
          return setState({
            kind: 'duplicate',
            existing: body.duplicateOf,
            displayAddress: body.displayAddress ?? null,
          });
        }

        if (response.ok && body.place !== undefined) {
          return setState({ kind: 'settled', ref: body.place, created: body.created === true });
        }

        if (response.status === 503) return setState({ kind: 'unavailable' });
        if (body.error === 'PLACE_CLAIM_MALFORMED' && body.detail !== undefined) {
          return setState({ kind: 'malformed', defect: body.detail as PlaceClaimDefect });
        }
        if (body.error === 'PLACE_SOURCE_REJECTED' && body.detail !== undefined) {
          return setState({ kind: 'rejected', reason: body.detail });
        }

        setState({ kind: 'failed' });
      } catch (error) {
        logger.warn('Η καταχώρηση τόπου δεν απάντησε', { error: String(error) });
        setState({ kind: 'failed' });
      }
    },
    [],
  );

  return { lookup, state, look, claim, reset };
}
