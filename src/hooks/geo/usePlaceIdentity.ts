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
 * το αναγνωριστικό ενός κτιρίου που του έδειξε **ο χάρτης** (πλακίδια οθόνης, ADR-777 §8.104)
 * ή **ο διακομιστής** (εφεδρικός raster) — μαζί με το `near`, που μόνο εντοπίζει πλακίδιο. Δεν στέλνει
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

import { useCallback, useEffect, useRef, useState } from 'react';

import type { BuildingHighlight, RenderedBuildingPick } from '@/lib/maps/rendered-buildings';
import { createDeadline, linkedAbortSignal } from '@/lib/async-utils';
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
      /** Πού πάτησε ο άνθρωπος — ταξιδεύει ως `near` (μόνο εντοπισμός πλακιδίου, ADR-777 §8.104). */
      readonly near: GeoPoint;
      /**
       * 🔑 **Από πού ήρθε η ταυτότητα** (ADR-777 §8.104): `screen` = τα πλακίδια της οθόνης (0 δίκτυο, τονισμός με
       * ταυτότητα, **καμία** διεύθυνση ακόμη — τη συμπληρώνει ο διακομιστής στην εγγραφή) · `server` = απάντηση του
       * `/api/places/lookup` (εφεδρικός raster χάρτης), με περίγραμμα και διεύθυνση.
       */
      readonly origin: 'screen' | 'server';
      /** Το περίγραμμα προς εμφάνιση (`server`) — ο τονισμός της οθόνης δεν χρειάζεται γεωμετρία. */
      readonly outline: GeoOutline | null;
      readonly highlight: BuildingHighlight | null;
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
  /**
   * «Τι υπάρχει σε αυτό το σημείο;» — **δεν γράφει τίποτα**. Με `building` (ο χάρτης το ξέρει ήδη) **κανένα** αίτημα·
   * χωρίς (raster / κενό) ρωτά τον διακομιστή.
   */
  readonly look: (point: GeoPoint, building?: RenderedBuildingPick | null) => Promise<void>;
  /** «Καταχώρησε αυτή τη χειρονομία.» */
  readonly claim: (claim: PlaceClaim, target: PlaceTarget, distinctFromNearby?: boolean) => Promise<void>;
  readonly reset: () => void;
}

/**
 * Πόσο περιμένει η οθόνη τον διακομιστή για «τι είναι εδώ;». Ο διακομιστής κόβει μόνος του στα 8 s
 * (`lookupOsmBuildingAt`)· εδώ λίγο παραπάνω, ώστε να φτάσει η **δική του** τίμια απάντηση (503) πριν κόψουμε εμείς.
 * Ποτέ πια «σε αναμονή για πάντα» (ζωντανό εύρημα 2026-11-19).
 */
const LOOKUP_CLIENT_TIMEOUT_MS = 10_000;

/** Η ταυτότητα από την οθόνη — **κανένα** αίτημα (ADR-777 §8.104, βαθμίδα 1). */
function screenLookupOf(point: GeoPoint, building: RenderedBuildingPick): BuildingLookup {
  return {
    kind: 'found',
    elementType: building.ref.elementType,
    elementId: building.ref.elementId,
    near: point,
    origin: 'screen',
    outline: null,
    highlight: { featureId: building.featureId, source: building.source },
    displayAddress: null,
  };
}

/**
 * «Τι είναι εδώ;» από τον διακομιστή (βαθμίδα 2 — εφεδρικός raster χάρτης). `null` = ακυρώθηκε (νεότερη ματιά):
 * ο καλών **δεν** γράφει τίποτα.
 */
async function serverLookup(point: GeoPoint, signal: AbortSignal): Promise<BuildingLookup | null> {
  // ⚠️ Όχι `AbortSignal.any`/`timeout` — το SSoT του `async-utils` (Safari < 17.4 · Firefox < 124).
  const deadline = createDeadline(LOOKUP_CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `/api/places/lookup?lat=${encodeURIComponent(point.lat)}&lng=${encodeURIComponent(point.lng)}`,
      { signal: linkedAbortSignal(signal, deadline.signal) },
    );
    if (response.status === 422) return { kind: 'outside-area' };
    if (!response.ok) return { kind: 'unavailable' };

    const body = (await response.json()) as
      | { found: true; elementType: OsmElementType; elementId: string; outline: GeoOutline; displayAddress: string | null }
      | { found: false };
    return body.found
      ? { ...body, kind: 'found', near: point, origin: 'server', highlight: null }
      : { kind: 'none' };
  } catch (error) {
    if (signal.aborted) return null;
    logger.warn('Η αναζήτηση κτιρίου δεν απάντησε', { error: String(error) });
    return { kind: 'unavailable' };
  } finally {
    deadline.dispose();
  }
}

export function usePlaceIdentity(): PlaceIdentity {
  const [lookup, setLookup] = useState<BuildingLookup>({ kind: 'idle' });
  const [state, setState] = useState<PlaceIdentityState>({ kind: 'idle' });

  /** Η ματιά σε εξέλιξη — κάθε νέα την ακυρώνει (αλλιώς αργή παλιά απάντηση σβήνει νεότερη: σύγκρουση). */
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  const reset = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setLookup({ kind: 'idle' });
    setState({ kind: 'idle' });
  }, []);

  const look = useCallback(async (point: GeoPoint, building: RenderedBuildingPick | null = null): Promise<void> => {
    inFlight.current?.abort();
    // Κάθε νέα ματιά ακυρώνει προηγούμενη **απόφαση**: αλλιώς ο άνθρωπος θα υπέβαλλε
    // το κτίριο που κοίταζε πριν αλλάξει γνώμη.
    setState({ kind: 'idle' });

    if (building !== null) {
      inFlight.current = null;
      return setLookup(screenLookupOf(point, building));
    }

    const controller = new AbortController();
    inFlight.current = controller;
    setLookup({ kind: 'searching' });
    const next = await serverLookup(point, controller.signal);
    // ⚠️ Ακυρωμένη (νεότερη ματιά ή αποπροσάρτηση) ⇒ η απάντηση **δεν** γράφεται, ακόμη κι αν πρόλαβε να έρθει.
    if (controller.signal.aborted) return;
    inFlight.current = null;
    if (next !== null) setLookup(next);
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
