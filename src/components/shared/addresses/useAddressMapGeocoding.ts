/* eslint-disable custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 🗺️ ADDRESS MAP — Geocoding Hook
 * =============================================================================
 *
 * Extracted from AddressMap.tsx for Google SRP compliance (<500 lines).
 * Contains: geocoding logic, reverse geocoding helper, auto-fit bounds effect,
 * and all geocoding-related state management.
 *
 * @file useAddressMapGeocoding.ts
 * @created 2026-03-28
 * @see AddressMap.tsx
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { LngLatBounds } from '@/lib/maps/maplibre';

import type { ProjectAddress } from '@/types/project/addresses';
import {
  formatAddressForGeocoding,
  getGeocodableAddresses,
} from '@/types/project/address-helpers';
import {
  geocodeAddress,
  type GeocodingServiceResult,
} from '@/lib/geocoding/geocoding-service';
import { nextPinGesture, resolvePinDrop, type PinDrop } from '@/components/shared/addresses/pin-drop';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import { cameraFraming, type CameraIntent } from '@/lib/geo/camera-motion';
import { createModuleLogger } from '@/lib/telemetry';
import {
  type GeocodingStatus,
  type DragPosition,
} from '@/components/shared/addresses/address-map-config';
import {
  reverseResultToAddress,
  findReferencePosition,
  storedPoint,
  parentPointKey,
  dropSupersededOverrides,
} from '@/components/shared/addresses/useAddressMapGeocoding.helpers';

// Re-export for backward compatibility — original module surface
export { reverseResultToAddress, findReferencePosition };

const logger = createModuleLogger('AddressMapGeocoding');

// =============================================================================
// HOOK INTERFACE
// =============================================================================

interface UseAddressMapGeocodingParams {
  addresses: ProjectAddress[];
  draggableMarkers: boolean;
  mapRef: React.RefObject<MapInstance | null>;
  mapReady: boolean;
  onGeocodingComplete?: (results: Map<string, GeocodingServiceResult>) => void;
  /** ADR-332 D27 Βήμα Β — **πάντα** με σημείο αφής· το κείμενο είναι μία από τρεις εκβάσεις. */
  onAddressDragUpdate?: (drop: PinDrop, addressIndex: number) => void;
  /** Increment to clear all drag positions and re-fit bounds (e.g. after undo/redo). */
  dragResetKey?: number;
}

interface UseAddressMapGeocodingReturn {
  geocodedAddresses: Map<string, GeocodingServiceResult>;
  geocodingStatus: GeocodingStatus;
  dragPositions: Map<string, DragPosition>;
  isReverseGeocoding: boolean;
  hasEverRendered: boolean;
  handleDragEnd: (
    event: { lngLat: { lng: number; lat: number } },
    addressId: string,
    addressIndex: number,
  ) => Promise<void>;
  autoPanRafRef: React.MutableRefObject<number | null>;
  autoPanDeltaRef: React.MutableRefObject<{ dx: number; dy: number }>;
  stopAutoPan: () => void;
  tickAutoPan: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Custom hook encapsulating all geocoding logic for AddressMap.
 * Handles: forward geocoding, reverse geocoding on drag, auto-fit bounds,
 * drag position tracking, and auto-pan during drag.
 */
export function useAddressMapGeocoding({
  addresses,
  draggableMarkers,
  mapRef,
  mapReady,
  onGeocodingComplete,
  onAddressDragUpdate,
  dragResetKey,
}: UseAddressMapGeocodingParams): UseAddressMapGeocodingReturn {
  const [geocodedAddresses, setGeocodedAddresses] = useState<Map<string, GeocodingServiceResult>>(new Map());
  const [geocodingStatus, setGeocodingStatus] = useState<GeocodingStatus>('idle');
  const [dragPositions, setDragPositions] = useState<Map<string, DragPosition>>(new Map());
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Track if map has ever rendered successfully (prevents unmount during re-geocoding)
  const hasEverRenderedRef = useRef(false);

  if (geocodingStatus === 'success' || geocodingStatus === 'partial') {
    hasEverRenderedRef.current = true;
  }

  // ===========================================================================
  // CONTROLLED — τη θέση την αποφασίζει ο γονιός (ADR-332 D27 Β10 + Β12)
  // ===========================================================================
  //
  // 🔴 Β12: το `dragPositions` γέμιζε με **κάθε** γεωκωδικοποιημένη θέση και ανανεωνόταν «μόνο
  //    όσα λείπουν» ⇒ μετά την αποθήκευση η πινέζα έμενε στο **πριν**, ενώ τα props είχαν ήδη
  //    το **μετά** (μετρημένο ζωντανά).
  // 🔴 Β10: εδώ ζούσε ανιχνευτής «Παλιές συντεταγμένες» + «Ανανέωση χάρτη». Πυροδοτούσε μόνο σε
  //    διευθύνσεις με συντεταγμένες, δηλαδή **αποθηκευμένες**, που ο διακομιστής είχε ήδη κρίνει
  //    (`lib/geocoding/address-position`) — και η «Ανανέωση» έδειχνε το σημείο της μηχανής πάνω
  //    από την πινέζα του ανθρώπου. Η απόκλιση ζει ΜΟΝΟ στα `positionAdvisories` του διακομιστή.
  //
  // 🔑 Το `dragPositions` είναι πλέον **μόνο** η υπερίσχυση μιας χειρονομίας σε εξέλιξη — από την
  //    αφή ως την απόφαση του γονιού. Μόλις ο γονιός δώσει **άλλο** σημείο για ένα id, σβήνει.
  const parentPointsRef = useRef<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    const previous = parentPointsRef.current;
    const next = new Map(addresses.map((addr) => [addr.id, parentPointKey(addr)] as const));
    parentPointsRef.current = next;
    setDragPositions((current) => dropSupersededOverrides(current, previous, next));
  }, [addresses]);

  // ===========================================================================
  // GEOCODING EFFECT
  // ===========================================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      const geocodeAllAddresses = async () => {
        // ⚠️ Το `dragPositions` ΔΕΝ αγγίζεται εδώ: τον κύκλο ζωής του τον έχει ΜΟΝΟ το
        //    «CONTROLLED» παραπάνω (ένας ιδιοκτήτης — Β12).
        if (addresses.length === 0) {
          setGeocodingStatus('idle');
          setGeocodedAddresses(new Map());
          return;
        }

        const currentIds = new Set(addresses.map(a => a.id));
        setGeocodedAddresses(prev => {
          const next = new Map<string, GeocodingServiceResult>();
          prev.forEach((v, id) => { if (currentIds.has(id)) next.set(id, v); });
          return next;
        });

        setGeocodingStatus('loading');

        try {
          const geocodable = getGeocodableAddresses(addresses);

          if (geocodable.length === 0) {
            setGeocodingStatus('idle');
            setGeocodedAddresses(new Map());
            return;
          }

          const geocodedMap = new Map<string, GeocodingServiceResult>();
          let successCount = 0;

          for (let i = 0; i < geocodable.length; i++) {
            const addr = geocodable[i];
            try {
              // Αποθηκευμένο σημείο ⇒ ΠΟΤΕ δεύτερη ερώτηση: τη θέση την έκρινε ο διακομιστής (Β10).
              const stored = storedPoint(addr);
              if (stored) {
                geocodedMap.set(addr.id, {
                  lat: stored.lat,
                  lng: stored.lng,
                  accuracy: 'exact' as const,
                  confidence: 1,
                  displayName: [addr.street, addr.number, addr.city].filter(Boolean).join(' '),
                  resolvedFields: {},
                  partialMatch: false,
                  reasoning: {} as import('@/lib/geocoding/geocoding-types').GeocodingReasoning,
                  alternatives: [],
                  source: {} as import('@/lib/geocoding/geocoding-types').GeocodingSource,
                });
                successCount++;
                continue;
              }
              const query = formatAddressForGeocoding(addr);
              const result = await geocodeAddress(query);
              if (result) {
                geocodedMap.set(addr.id, result);
                successCount++;
              }
            } catch {
              logger.warn('Geocoding failed for address', { data: { id: addr.id } });
            }
          }

          setGeocodedAddresses(geocodedMap);

          logger.info('Geocoding complete', { data: {
            totalAddresses: addresses.length,
            geocodableAddresses: geocodable.length,
            successCount,
          } });

          if (successCount === 0) {
            setGeocodingStatus('error');
          } else if (successCount < geocodable.length) {
            setGeocodingStatus('partial');
          } else {
            setGeocodingStatus('success');
          }

          onGeocodingComplete?.(geocodedMap);
          // 🔴 Β12: εδώ το `dragPositions` αρχικοποιούνταν με ΚΑΘΕ θέση («μόνο όσα λείπουν») και δεν
          //    ανανεωνόταν ποτέ. Δεν υπάρχει πια: ο χάρτης δείχνει ό,τι δίνει ο γονιός (`displayedPosition`).
        } catch (error) {
          logger.error('Geocoding failed:', { error });
          setGeocodingStatus('error');
        }
      };

      geocodeAllAddresses();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, onGeocodingComplete]);

  // ===========================================================================
  // FIT BOUNDS — SSoT helper + two triggers
  // ===========================================================================

  /**
   * Zoom the map so every pin (geocoded + drag-pending + unrendered fallback)
   * is visible. Single source of truth for bounds composition.
   *
   * 🔴 ADR-332 D27 Β14 (ζωντανή επαλήθευση): επιστρέφει **αν καδράρισε**. Οι δύο σκανδάλες
   * σημείωναν «καδράρισα» και όταν ο χάρτης **δεν ήταν έτοιμος** ⇒ θέσεις που έφταναν πριν το
   * `mapReady` δεν καδραρίζονταν ποτέ, και ο χάρτης έμενε στο προεπιλεγμένο κέντρο (Αθήνα) ενώ η
   * πινέζα ήταν στη Θεσσαλονίκη.
   */
  const runFitBounds = useCallback((intent: CameraIntent): boolean => {
    if (!mapRef.current || !mapReady) return false;
    try {
      const bounds = new LngLatBounds();
      geocodedAddresses.forEach(result => bounds.extend([result.lng, result.lat]));
      if (draggableMarkers) {
        dragPositions.forEach(pos => bounds.extend([pos.lng, pos.lat]));
        const refPos = findReferencePosition(addresses, dragPositions, geocodedAddresses);
        for (let i = 0; i < addresses.length; i++) {
          const addr = addresses[i];
          if (!dragPositions.has(addr.id) && !geocodedAddresses.has(addr.id) && refPos) {
            bounds.extend([refPos.lng - 0.003 * i, refPos.lat + 0.003 * i]);
          }
        }
      }
      if (bounds.isEmpty()) return false;
      /*
        🔑 **ΤΟ ΜΟΝΟ ΣΗΜΕΙΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΜΕ ΔΥΟ ΠΡΟΘΕΣΕΙΣ ΣΤΗΝ ΙΔΙΑ ΣΥΝΑΡΤΗΣΗ**, και
        γι' αυτό η πρόθεση **δίνεται από τον καλούντα**: η **πρώτη** προσαρμογή είναι
        άφιξη *(ο άνθρωπος δεν είδε ποτέ την προεπιλεγμένη προβολή· μια πτήση από εκεί
        δεν επικοινωνεί τίποτα)*, ενώ κάθε **επόμενη** — προστέθηκε ή σβήστηκε πινέζα —
        είναι ταξίδι *(κοιτούσε ένα καδραρισμένο σύνολο και το μετακινήσαμε)*.

        ⚠️ Το `'confirmed'` επιτρέπει ζουμ **κτιρίου** (18) και είναι η μοναδική οθόνη
        που το δικαιούται: εδώ οι πινέζες είναι **αποθηκευμένες** διευθύνσεις, όχι
        προτάσεις γεωκωδικοποιητή — γι' αυτό το ίδιο ταβάνι είναι `15` στους υποψηφίους.
        Οι δύο τιμές έμοιαζαν με ασυνέπεια· είναι **δύο διαφορετικές δηλώσεις ακρίβειας**.
      */
      mapRef.current.fitBounds(bounds, cameraFraming(intent, 'pin', 'confirmed'));
      return true;
    } catch (error) {
      logger.error('fitBounds failed:', { error });
      return false;
    }
  }, [geocodedAddresses, mapReady, draggableMarkers, dragPositions, addresses]);

  // Trigger 1 — View mode: auto-fit whenever the geocoded set changes. Skipped
  // in edit mode so a careful zoom-in + drag is not immediately reversed by
  // an auto-fit triggered by the new drag position or freshly geocoded entry.
  const hasFittedViewRef = useRef(false);
  useEffect(() => {
    if (draggableMarkers) {
      hasFittedViewRef.current = false;
      return;
    }
    // Β14: «καδράρισα» ΜΟΝΟ αν έγινε — αλλιώς η άφιξη χάνεται όταν ο χάρτης δεν ήταν έτοιμος.
    if (runFitBounds(hasFittedViewRef.current ? 'travel' : 'arrive')) hasFittedViewRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodedAddresses, mapReady, draggableMarkers]);

  // Trigger 2 — Edit mode: fit on entry + re-fit when pin count CHANGES
  // (added pin, deleted pin, pending pin appended/removed). Does NOT re-fit
  // on drag or repeated calls with same counts — that would fight the user
  // dragging or panning the map.
  const lastEditFitRef = useRef(false);
  const lastGeocodedCountRef = useRef(0);
  const lastAddressCountRef = useRef(0);
  useEffect(() => {
    if (!draggableMarkers) {
      lastEditFitRef.current = false;
      lastGeocodedCountRef.current = 0;
      lastAddressCountRef.current = 0;
      return;
    }
    const geocodedCount = geocodedAddresses.size;
    const addressCount = addresses.length;
    const countChanged =
      geocodedCount !== lastGeocodedCountRef.current ||
      addressCount !== lastAddressCountRef.current;
    if (lastEditFitRef.current && !countChanged) return;
    // 🔑 Το `lastEditFitRef` απαντούσε **ήδη** «έχω καδράρει ξανά;» — δηλαδή «υπάρχει
    //    ΑΠΟ;». Δεν χρειάστηκε νέα κατάσταση, μόνο να ερωτηθεί.
    // 🔴 Β14: τα πλήθη και η σημαία γράφονται ΜΟΝΟ αν το καδράρισμα έγινε — αλλιώς ένας χάρτης
    //    που δεν ήταν έτοιμος «κατανάλωνε» την άφιξη και δεν καδράριζε ποτέ.
    if (!runFitBounds(lastEditFitRef.current ? 'travel' : 'arrive')) return;
    lastGeocodedCountRef.current = geocodedCount;
    lastAddressCountRef.current = addressCount;
    lastEditFitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggableMarkers, mapReady, geocodedAddresses, addresses]);

  // ===========================================================================
  // DRAG RESET — Clear drag positions on undo/redo (dragResetKey increment)
  // ===========================================================================
  // When the editor undo/redo restores a previous address, the drag position
  // must revert so the pin renders at the geocoded (not dragged) position.
  // Placed after lastEditFitRef declaration so the ref is in scope.
  const prevDragResetKeyRef = useRef<number>(0);
  useEffect(() => {
    if (!dragResetKey) return;
    if (dragResetKey === prevDragResetKeyRef.current) return;
    prevDragResetKeyRef.current = dragResetKey;
    setDragPositions(new Map());
    lastEditFitRef.current = false;
  }, [dragResetKey]);

  // ===========================================================================
  // AUTO-PAN DURING DRAG
  // ===========================================================================

  const autoPanRafRef = useRef<number | null>(null);
  const autoPanDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const stopAutoPan = useCallback(() => {
    if (autoPanRafRef.current) {
      cancelAnimationFrame(autoPanRafRef.current);
      autoPanRafRef.current = null;
    }
    autoPanDeltaRef.current = { dx: 0, dy: 0 };
  }, []);

  const tickAutoPan = useCallback(() => {
    const map = mapRef.current;
    const { dx, dy } = autoPanDeltaRef.current;
    if (map && (dx !== 0 || dy !== 0)) {
      map.panBy([dx, dy], { duration: 0 });
    }
    autoPanRafRef.current = requestAnimationFrame(tickAutoPan);
  }, []);

  // ===========================================================================
  // DRAG END — Reverse Geocode (ADR-332 D27 Β6 + Β13)
  // ===========================================================================

  /** Η ερώτηση της τελευταίας χειρονομίας — νεότερη χειρονομία ή αποπροσάρτηση την ακυρώνει. */
  const dropAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => dropAbortRef.current?.abort(), []);

  const handleDragEnd = useCallback(async (
    event: { lngLat: { lng: number; lat: number } },
    addressId: string,
    addressIndex: number,
  ) => {
    stopAutoPan();
    const { lng, lat } = event.lngLat;
    // flushSync: commit dragPositions synchronously BEFORE maplibre's moveend
    // event triggers a MapContext re-render with old longitude/latitude props,
    // which would cause a visible pin snap-back to the previous position.
    flushSync(() => {
      setDragPositions(prev => {
        const next = new Map(prev);
        next.set(addressId, { lng, lat });
        return next;
      });
      setIsReverseGeocoding(true);
    });

    // 🔑 Β13: νεότερη χειρονομία ⇒ η ερώτηση της παλιότερης ακυρώνεται και ΔΕΝ παραδίδεται ποτέ.
    dropAbortRef.current?.abort();
    const controller = new AbortController();
    dropAbortRef.current = controller;
    const point = { lat, lng };
    const gesture = nextPinGesture();
    // Google «Dropped pin»: το σημείο ΑΜΕΣΩΣ — ο διάλογος ανοίγει με «Μόνο η θέση» πριν απαντήσει η μηχανή.
    onAddressDragUpdate?.({ point, gesture, text: { kind: 'pending' } }, addressIndex);

    try {
      // 🔴 Β6: ο γονιός μαθαίνει ΠΑΝΤΑ το σημείο — με ή χωρίς κείμενο.
      const drop = await resolvePinDrop(point, gesture, controller.signal);
      if (controller.signal.aborted) return;
      if (drop.text.kind !== 'resolved') logger.warn('Position-only drop', { data: { lat, lng, outcome: drop.text.kind } });
      onAddressDragUpdate?.(drop, addressIndex);
    } catch (error) {
      logger.error('Drag update handler failed', { error: String(error) });
    } finally {
      // Μόνο η ΤΡΕΧΟΥΣΑ χειρονομία κλείνει τον δείκτη — μια ακυρωμένη δεν τον σβήνει από τη νεότερη.
      if (dropAbortRef.current === controller) {
        dropAbortRef.current = null;
        setIsReverseGeocoding(false);
      }
    }
  }, [onAddressDragUpdate, stopAutoPan]);

  return {
    geocodedAddresses,
    geocodingStatus,
    dragPositions,
    isReverseGeocoding,
    hasEverRendered: hasEverRenderedRef.current,
    handleDragEnd,
    autoPanRafRef,
    autoPanDeltaRef,
    stopAutoPan,
    tickAutoPan,
  };
}

