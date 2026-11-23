/**
 * @fileoverview **Πού στέκεται κάθε πινέζα του χάρτη διευθύνσεων** — μία απάντηση, δύο αναγνώστες
 * (ADR-948 §8.7.3 · ADR-332 D27 Β12).
 * @module components/shared/addresses/address-map-pins
 *
 * 🔴 **Η βλάβη που το γέννησε**: ο `AddressMap` ζωγράφιζε τις πινέζες με έναν κανόνα και το
 *    `runFitBounds` καδράριζε με **άλλον**. Ο κανόνας του καδραρίσματος παρέλειπε την εφεδρική
 *    πινέζα που εμφανίζεται όταν ο χάρτης επεξεργασίας **αδειάσει** — έτσι, μετά την «Αναίρεση» της
 *    πρότασης έδρας, η μόνη πινέζα που μπορούσε να πιάσει ο άνθρωπος βρισκόταν εκτός οθόνης, ενώ η
 *    κάμερα έμενε πάνω σε διεύθυνση που δεν υπήρχε πια. Οι δύο κανόνες απέκλιναν και αλλού: η ζωγραφική
 *    διάβαζε το σημείο του γονιού (`displayedPosition`), το καδράρισμα μόνο τη γεωκωδικοποίηση.
 *
 * 🔑 Τώρα **ένας** υπολογισμός, και η ζωγραφική και η κάμερα διαβάζουν τον ίδιο πίνακα.
 *
 * 🔑 Κάθε πινέζα δηλώνει **πόσο ξέρουμε** για τη θέση της (`anchor`), επειδή η κάμερα δεν πρέπει να
 *    ζουμάρει σε επίπεδο κτιρίου πάνω σε σημείο που κανείς δεν ισχυρίστηκε:
 *    - `located`: η θέση είναι γνωστή (χειρονομία · σημείο του γονιού · γεωκωδικοποίηση οθόνης).
 *    - `beside`: θέση αναμονής, τοποθετημένη **δίπλα** σε γνωστή πινέζα — ανήκει στο ίδιο κάδρο.
 *    - `unanchored`: θέση αναμονής χωρίς καμία γνωστή πινέζα κοντά — στέκεται στο κέντρο της
 *      θέασης «δεν ξέρουμε ακόμη πού» (`DEFAULT_MAP_OVERVIEW`).
 */

import { DEFAULT_MAP_OVERVIEW } from '@/config/geographic-config';
import { DRAFT_ENTITY_ID } from '@/lib/draft-entity-id';
import type { GeocodingServiceResult } from '@/lib/geocoding/geocoding-service';
import type { ProjectAddress } from '@/types/project/addresses';
import type { DragPosition } from '@/components/shared/addresses/address-map-config';
import { displayedPosition } from '@/components/shared/addresses/useAddressMapGeocoding.helpers';

/** Απόσταση (μοίρες) ανάμεσα σε διαδοχικές θέσεις αναμονής — ώστε να μην πέφτουν η μία πάνω στην άλλη. */
const PLACEHOLDER_STEP_DEG = 0.003;

export type AddressMapPinAnchor = 'located' | 'beside' | 'unanchored';

export interface AddressMapPin {
  /** Το id της διεύθυνσης, ή `DRAFT_ENTITY_ID` για την εφεδρική πινέζα του άδειου χάρτη (τη δέχεται το `handleDragEnd`). */
  readonly id: string;
  readonly point: DragPosition;
  readonly anchor: AddressMapPinAnchor;
  /** Η διεύθυνση — `null` μόνο για την εφεδρική πινέζα. */
  readonly address: ProjectAddress | null;
  /** Η θέση στη λίστα του γονιού (αυτή φτάνει στο `onAddressDragUpdate`). */
  readonly index: number;
  /** Συρόμενη (χάρτης επεξεργασίας, όχι παράγωγη διεύθυνση μόνο-για-ανάγνωση). */
  readonly draggable: boolean;
}

export interface AddressMapPinsInput {
  readonly addresses: readonly ProjectAddress[];
  readonly draggableMarkers: boolean;
  readonly dragPositions: ReadonlyMap<string, DragPosition>;
  readonly geocodedAddresses: ReadonlyMap<string, GeocodingServiceResult>;
  readonly readOnlyAddressIds?: ReadonlySet<string>;
}

const OVERVIEW_CENTER: DragPosition = {
  lng: DEFAULT_MAP_OVERVIEW.longitude,
  lat: DEFAULT_MAP_OVERVIEW.latitude,
};

/** Χάρτης προβολής: μόνο ό,τι γεωκωδικοποιήθηκε — καμία θέση αναμονής. */
function viewPins(input: AddressMapPinsInput): AddressMapPin[] {
  const pins: AddressMapPin[] = [];
  input.addresses.forEach((address, index) => {
    const geocoded = input.geocodedAddresses.get(address.id);
    if (!geocoded) return;
    pins.push({
      id: address.id,
      point: { lng: geocoded.lng, lat: geocoded.lat },
      anchor: 'located',
      address,
      index,
      draggable: false,
    });
  });
  return pins;
}

/** Θέση αναμονής: δίπλα στη γνωστή πινέζα αναφοράς, αλλιώς στο κέντρο της επισκόπησης — κλιμακωτά, ώστε να μην επικαλύπτονται. */
function placeholderPin(address: ProjectAddress, index: number, reference: DragPosition | null): AddressMapPin {
  const origin = reference ?? OVERVIEW_CENTER;
  return {
    id: address.id,
    point: { lng: origin.lng - PLACEHOLDER_STEP_DEG * index, lat: origin.lat + PLACEHOLDER_STEP_DEG * index },
    anchor: reference ? 'beside' : 'unanchored',
    address,
    index,
    draggable: true,
  };
}

/** Χάρτης επεξεργασίας: κάθε διεύθυνση έχει πινέζα να πιαστεί — και ο άδειος χάρτης μία εφεδρική. */
function editPins(input: AddressMapPinsInput): AddressMapPin[] {
  const { addresses, dragPositions, geocodedAddresses, readOnlyAddressIds } = input;
  if (addresses.length === 0) {
    return [{
      id: DRAFT_ENTITY_ID,
      point: OVERVIEW_CENTER,
      anchor: 'unanchored',
      address: null,
      index: 0,
      draggable: true,
    }];
  }

  // ADR-318: οι παράγωγες μόνο-για-ανάγνωση θέλουν ΠΡΑΓΜΑΤΙΚΗ θέση — ποτέ αναμονή.
  // Β12: χειρονομία σε εξέλιξη → σημείο του γονιού → γεωκωδικοποίηση οθόνης.
  const shownPoints = addresses.map((address) => {
    const readOnly = readOnlyAddressIds?.has(address.id) === true;
    const dragPos = readOnly ? undefined : dragPositions.get(address.id);
    return { readOnly, shown: displayedPosition(address, dragPos, geocodedAddresses.get(address.id)) };
  });
  // Οι θέσεις αναμονής στέκονται δίπλα στην πρώτη ΓΝΩΣΤΗ πινέζα — με τον ίδιο κανόνα θέσης που ζωγραφίζεται.
  const reference = shownPoints.find((entry) => entry.shown !== null)?.shown ?? null;
  const pins: AddressMapPin[] = [];
  addresses.forEach((address, index) => {
    const { readOnly, shown } = shownPoints[index]!;
    if (shown) {
      pins.push({ id: address.id, point: shown, anchor: 'located', address, index, draggable: !readOnly });
      return;
    }
    if (!readOnly) pins.push(placeholderPin(address, index, reference));
  });
  return pins;
}

/** **Όλες** οι πινέζες που ζωγραφίζει ο χάρτης, με τη θέση τους — η μία πηγή για ζωγραφική και κάμερα. */
export function addressMapPins(input: AddressMapPinsInput): AddressMapPin[] {
  return input.draggableMarkers ? editPins(input) : viewPins(input);
}

/** Κλειδί σύγκρισης θέσης — αλλάζει μόνο όταν αλλάζει το σημείο. */
function pinPointKey(pin: AddressMapPin): string {
  return `${pin.point.lat},${pin.point.lng}`;
}

/** Στιγμιότυπο «id → θέση» για τη σύγκριση της επόμενης απόδοσης. */
export function pinPointSnapshot(pins: readonly AddressMapPin[]): ReadonlyMap<string, string> {
  return new Map(pins.map((pin) => [pin.id, pinPointKey(pin)] as const));
}

/**
 * Οι πινέζες που **εμφανίστηκαν ή μετακινήθηκαν** σε σχέση με το προηγούμενο στιγμιότυπο.
 * Όσες χάθηκαν δεν μετρούν: μια διαγραμμένη πινέζα δεν έχει τίποτα να δείξει.
 */
export function movedPins(
  previous: ReadonlyMap<string, string>,
  pins: readonly AddressMapPin[],
): AddressMapPin[] {
  return pins.filter((pin) => previous.get(pin.id) !== pinPointKey(pin));
}
