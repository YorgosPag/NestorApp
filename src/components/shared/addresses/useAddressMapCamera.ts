/**
 * @fileoverview **Ποιος κινεί την κάμερα του χάρτη διευθύνσεων, και πότε** (ADR-948 §8.7.3 · ADR-332 D27 Β14 ·
 * ADR-847).
 * @module components/shared/addresses/useAddressMapCamera
 *
 * 🔴 **Η βλάβη**: μετά την «Αναίρεση» της πρότασης έδρας ο χάρτης έμενε πάνω σε διεύθυνση που δεν υπήρχε πια. Η
 *    σκανδάλη επεξεργασίας ξανακαδράριζε **μόνο όταν άλλαζε το πλήθος**, και το καδράρισμα έβγαινε «άδειο» όταν
 *    έφευγε η τελευταία διεύθυνση ⇒ κανείς δεν κατείχε την κάμερα, και η εφεδρική πινέζα (η μόνη που μπορούσε να
 *    πιάσει ο άνθρωπος) έμενε εκτός οθόνης. Το ίδιο κενό είχε και η αναίρεση πάνω σε **υπαρκτή** έδρα (πλήθος 1 → 1,
 *    η πινέζα γύριζε αλλού, η κάμερα όχι).
 *
 * 🔑 **Ο κανόνας — «αποκάλυψε μόνο αν χρειάζεται»** (`scrollIntoView({ block: 'nearest' })` του browser ·
 *    `revealRangeInCenterIfOutsideViewport` του VS Code): στον χάρτη επεξεργασίας η κάμερα κινείται **μόνο** όταν
 *    μια πινέζα εμφανίστηκε ή μετακινήθηκε **και** βρίσκεται εκτός οθόνης. Τότε καδράρει όλο το σύνολο (ταξίδι).
 *    - Σύρσιμο: η πινέζα είναι κάτω από το δάχτυλο ⇒ μέσα στην οθόνη ⇒ η κάμερα **δεν** αγγίζεται. Χωρίς ειδική
 *      εξαίρεση για τη χειρονομία — προκύπτει από τον κανόνα.
 *    - Αναίρεση / πρόταση / πληκτρολόγηση που πάει την πινέζα αλλού ⇒ εκτός οθόνης ⇒ ταξίδι.
 *    - Ο χάρτης άδειασε ⇒ η εφεδρική πινέζα στέκεται στη θέαση «δεν ξέρουμε ακόμη πού» ⇒ επιστροφή **εκεί**.
 *    ⚠️ Το Figma **δεν** το κάνει (η αναίρεση δεν μετακινεί την οθόνη, και οι χρήστες ζητούν «πήγαινέ με πίσω»)·
 *    εδώ η κάμερα δεν «κλέβει» το βλέμμα όσο η αλλαγή φαίνεται, και το φέρνει όταν δεν φαίνεται.
 *
 * 🔑 **Η πρόθεση (`arrive` / `travel`) μένει όπως ορίζει το ADR-847**: η πρώτη πραγματική εικόνα είναι άφιξη·
 *    κάθε επόμενη, ταξίδι. Η άφιξη **ολοκληρώνεται** μόνο όταν καδραριστεί **πραγματική** πινέζα — ως τότε ο χάρτης
 *    δείχνει τη θέαση επισκόπησης, που δεν είναι «από» για να αξίζει πτήση (Β14: η άφιξη δεν «καταναλώνεται» όσο ο
 *    χάρτης δεν είναι έτοιμος).
 *
 * Ο χάρτης **προβολής** κρατά τη συμπεριφορά του: καδράρει όλο το σύνολο όποτε αλλάξει.
 */

import { useCallback, useEffect, useRef } from 'react';

import { DEFAULT_MAP_OVERVIEW } from '@/config/geographic-config';
import { cameraFlight, cameraFraming, type CameraIntent } from '@/lib/geo/camera-motion';
import { LngLatBounds } from '@/lib/maps/maplibre';
import { createModuleLogger } from '@/lib/telemetry';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import type { DragPosition } from '@/components/shared/addresses/address-map-config';
import {
  movedPins,
  pinPointSnapshot,
  type AddressMapPin,
} from '@/components/shared/addresses/address-map-pins';

const logger = createModuleLogger('AddressMapCamera');

/** Τι έδειξε το καδράρισμα: πραγματικές πινέζες · τη θέαση επισκόπησης · τίποτα (χάρτης όχι έτοιμος / καμία πινέζα). */
type FrameOutcome = 'pins' | 'overview' | 'none';

/**
 * Καδράρει **όλες** τις πινέζες. Οι θέσεις αναμονής χωρίς γνωστή γειτονιά (`unanchored`) **δεν** μπαίνουν στο
 * ορθογώνιο — δεν ισχυρίζονται θέση, άρα δεν δικαιούνται ζουμ κτιρίου· αν είναι οι μόνες, η κάμερα πάει στη θέαση
 * επισκόπησης, εκεί όπου στέκονται.
 *
 * ⚠️ Το `'confirmed'` επιτρέπει ζουμ **κτιρίου** (18): εδώ οι πινέζες είναι διευθύνσεις του ανθρώπου, όχι
 * προτάσεις γεωκωδικοποιητή (γι' αυτό το ίδιο ταβάνι είναι `15` στους υποψηφίους) — ADR-847.
 */
function framePins(map: MapInstance, pins: readonly AddressMapPin[], intent: CameraIntent): FrameOutcome {
  const bounds = new LngLatBounds();
  pins.forEach((pin) => {
    if (pin.anchor !== 'unanchored') bounds.extend([pin.point.lng, pin.point.lat]);
  });
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, cameraFraming(intent, 'pin', 'confirmed'));
    return 'pins';
  }
  if (pins.length === 0) return 'none';
  map.flyTo({
    center: [DEFAULT_MAP_OVERVIEW.longitude, DEFAULT_MAP_OVERVIEW.latitude],
    zoom: DEFAULT_MAP_OVERVIEW.zoom,
    ...cameraFlight(intent),
  });
  return 'overview';
}

/** Φαίνεται το σημείο στην τρέχουσα οθόνη; */
function isInView(map: MapInstance, point: DragPosition): boolean {
  return map.getBounds().contains([point.lng, point.lat]);
}

/** Κλειδί όλου του συνόλου — η σκανδάλη ξανατρέχει μόνο όταν αλλάζει κάποια θέση, όχι σε κάθε νέα αναφορά πίνακα. */
function pinsKey(pins: readonly AddressMapPin[]): string {
  return pins.map((pin) => `${pin.id}@${pin.point.lat},${pin.point.lng}`).join('|');
}

interface UseAddressMapCameraParams {
  readonly pins: readonly AddressMapPin[];
  readonly draggableMarkers: boolean;
  readonly mapRef: React.RefObject<MapInstance | null>;
  readonly mapReady: boolean;
}

type FrameFn = (intent: CameraIntent) => FrameOutcome;

/** Χάρτης προβολής — καδράρει το σύνολο όποτε αλλάξει. Η πρώτη πραγματική εικόνα είναι άφιξη. */
function useViewFraming(frame: FrameFn, draggableMarkers: boolean): void {
  const hasFramedRef = useRef(false);
  useEffect(() => {
    if (draggableMarkers) {
      hasFramedRef.current = false;
      return;
    }
    if (frame(hasFramedRef.current ? 'travel' : 'arrive') === 'pins') hasFramedRef.current = true;
  }, [draggableMarkers, frame]);
}

interface EditRevealParams extends UseAddressMapCameraParams {
  readonly frame: FrameFn;
}

/** Χάρτης επεξεργασίας — άφιξη στην είσοδο, μετά «αποκάλυψε μόνο αν χρειάζεται». */
function useEditReveal({ frame, pins, draggableMarkers, mapRef, mapReady }: EditRevealParams): void {
  const hasArrivedRef = useRef(false);
  const seenPointsRef = useRef<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    if (!draggableMarkers) {
      hasArrivedRef.current = false;
      seenPointsRef.current = new Map();
      return;
    }
    if (!hasArrivedRef.current) {
      const outcome = frame('arrive');
      if (outcome === 'none') return;
      // Η άφιξη ολοκληρώνεται μόνο σε ΠΡΑΓΜΑΤΙΚΗ πινέζα — η επισκόπηση δεν είναι «από» που αξίζει πτήση.
      hasArrivedRef.current = outcome === 'pins';
      seenPointsRef.current = pinPointSnapshot(pins);
      return;
    }
    const moved = movedPins(seenPointsRef.current, pins);
    seenPointsRef.current = pinPointSnapshot(pins);
    const map = mapRef.current;
    if (moved.length === 0 || !map || !mapReady) return;
    if (moved.every((pin) => isInView(map, pin.point))) return;
    frame('travel');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggableMarkers, frame]);
}

export function useAddressMapCamera(params: UseAddressMapCameraParams): void {
  const { pins, draggableMarkers, mapRef, mapReady } = params;
  const key = pinsKey(pins);

  /** Η μία πόρτα προς την κάμερα — `none` όταν ο χάρτης δεν είναι έτοιμος (Β14). */
  const frame = useCallback((intent: CameraIntent): FrameOutcome => {
    const map = mapRef.current;
    if (!map || !mapReady) return 'none';
    try {
      return framePins(map, pins, intent);
    } catch (error) {
      logger.error('Address map framing failed', { error });
      return 'none';
    }
    // 🔑 Το κλειδί θέσεων, όχι η αναφορά του πίνακα: ίδιες θέσεις ⇒ ίδιο καδράρισμα.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, key]);

  useViewFraming(frame, draggableMarkers);
  useEditReveal({ ...params, frame });
}
