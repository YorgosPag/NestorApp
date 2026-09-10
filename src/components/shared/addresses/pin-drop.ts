/**
 * @fileoverview **ΤΟ ΣΥΡΣΙΜΟ ΔΙΝΕΙ ΠΑΝΤΑ ΘΕΣΗ — ΚΑΙ ΠΡΟΑΙΡΕΤΙΚΑ ΚΕΙΜΕΝΟ.** ADR-332 D27 Βήμα Β.
 * @related components/shared/addresses/useAddressMapGeocoding (`handleDragEnd`)
 * @related components/shared/addresses/editor/components/AddressDragConfirmDialog
 *
 * 🔴 Ως τις 2026-09-10 ο χάρτης ειδοποιούσε τον γονιό **μόνο** όταν η αντίστροφη
 * γεωκωδικοποίηση έβρισκε κείμενο. Σε 404 / timeout / όριο ρυθμού η πινέζα **έμενε στην
 * οθόνη** εκεί που την άφησε το χέρι, και ο γονιός **δεν μάθαινε τίποτα**: η οθόνη έδειχνε
 * κάτι που δεν θα αποθηκευόταν ποτέ (Β6).
 *
 * 🔑 Το «σημείο χωρίς διεύθυνση» είναι **κανονική κατάσταση**, όχι σφάλμα: η Google το λέει
 * `ZERO_RESULTS` / «Dropped pin», και το Revit γράφει lat/long όταν σέρνεις την πινέζα και
 * λύνει κείμενο **μόνο** με ρητό «Search». Γι' αυτό ο τύπος εδώ **δεν επιτρέπει** σύρσιμο
 * χωρίς σημείο, ενώ το κείμενο είναι μία από τρεις εκβάσεις.
 *
 * ⚠️ Το σημείο εμφανίζεται **δύο φορές** (`point` και `address.coordinates`) και τα δύο
 * γεννιούνται από την **ίδια** μεταβλητή μέσα στο {@link resolvePinDrop} — δεν μπορούν να
 * αποκλίνουν. Το `address.coordinates` μένει επειδή το `reverseResultToAddress` είναι ο SSoT
 * «κείμενο από τη μηχανή, θέση από το χέρι» και έχει ζωντανούς καταναλωτές (`applyDraggedPin`).
 */

import type { GeoPoint } from '@/types/geo/coordinates';
import type { PartialProjectAddress, ProjectAddress } from '@/types/project/addresses';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { reverseGeocodeDetailed } from '@/lib/geocoding/geocoding-service';
import { reverseResultToAddress } from './useAddressMapGeocoding.helpers';

/** Τι είπε η μηχανή για το σημείο αφής. Τρεις εκβάσεις και μία αναμονή, καμία σιωπή. */
export type PinDropText<T> =
  | { readonly kind: 'resolved'; readonly address: T }
  /**
   * Ρωτήθηκε — η απάντηση **δεν ήρθε ακόμα** (ADR-332 D27 Β13). Google «Dropped pin»: το σημείο
   * φαίνεται **αμέσως**, η διεύθυνση όταν έρθει. Ο διάλογος ανοίγει με «Μόνο η θέση» διαθέσιμο.
   */
  | { readonly kind: 'pending' }
  /** Ρωτήθηκε — σε αυτό το σημείο δεν γράφει τίποτα (404). */
  | { readonly kind: 'not-found' }
  /** Δεν μπόρεσε να ρωτηθεί (timeout · 429 · σφάλμα διακομιστή). */
  | { readonly kind: 'unavailable' };

/**
 * Οι εκβάσεις **χωρίς** κείμενο — ονομασμένες, ώστε όποιος τις δείχνει να τις απαριθμεί εξαντλητικά.
 *
 * ⚠️ **Ρητά, όχι `Exclude<…, 'resolved'>`**: το `pending` δεν είναι έκβαση, είναι αναμονή — με
 * `Exclude` θα ζητούσε κλειδί «δεν βρέθηκε κείμενο» για κάτι που απλώς δεν έφτασε ακόμα.
 */
export type PinDropNoText = 'not-found' | 'unavailable';

/**
 * Τι λέμε στον άνθρωπο για κάθε έκβαση χωρίς κείμενο (namespace `addresses`).
 *
 * `Record` και όχι `switch` με `default`: νέα έκβαση **σταματά τη μεταγλώττιση** εδώ. Ζει
 * **μία** φορά επειδή τη δείχνουν δύο επιφάνειες (ο διάλογος συρσίματος και οι επαφές).
 */
export const PIN_DROP_NO_TEXT_I18N_KEY: Readonly<Record<PinDropNoText, string>> = {
  'not-found': 'editor.dragConfirm.noText.notFound',
  unavailable: 'editor.dragConfirm.noText.unavailable',
};

/** Ένα σύρσιμο: **πάντα** σημείο, η ταυτότητα της χειρονομίας, και ό,τι είπε η μηχανή. */
export interface PinDrop<T = Partial<PartialProjectAddress>> {
  readonly point: GeoPoint;
  /**
   * Ποια χειρονομία — η **ίδια** φτάνει δύο φορές (`pending` → τελική έκβαση). Με αυτήν ο παραλήπτης
   * αγνοεί απάντηση για χειρονομία που **έκλεισε** ήδη (`usePinDropGate`).
   */
  readonly gesture: number;
  readonly text: PinDropText<T>;
}

let lastGesture = 0;

/**
 * Νέα ταυτότητα χειρονομίας — **μονότονη σε όλη τη σελίδα**, όχι ανά χάρτη: ο χάρτης και ο editor
 * που τη λαμβάνει προσαρτώνται και αποπροσαρτώνται **χωριστά**, και ένας μετρητής ανά χάρτη θα
 * ξανάρχιζε από το 1 κάτω από έναν φύλακα που θυμάται ήδη μεγαλύτερο αριθμό.
 */
export function nextPinGesture(): number {
  lastGesture += 1;
  return lastGesture;
}

/**
 * Τα πεδία με τα οποία μια διεύθυνση **δηλώνει** ότι το σημείο της το έβαλε άνθρωπος.
 *
 * 🔑 **ΕΝΑ σημείο για κάθε γραφέα του πελάτη** (`applyDraggedPin`, φόρμες προσθήκης /
 * επεξεργασίας, κτίρια): η δήλωση `source: 'dragged'` γράφεται **μόνο εδώ**. Είναι **αίτημα,
 * όχι ισχυρισμός** — την αποθηκευμένη προέλευση την αποφασίζει ο διακομιστής
 * (`lib/geocoding/address-position`, κανόνας 1).
 */
export interface HumanPlacedPatch {
  readonly coordinates: { lat: number; lng: number };
  readonly source: 'dragged';
}

export function humanPlacedPatch(point: GeoPoint): HumanPlacedPatch {
  return { coordinates: { lat: point.lat, lng: point.lng }, source: 'dragged' };
}

/**
 * Μια πινέζα **σε αναμονή**, ως διεύθυνση του χάρτη — μόνο θέση, κανένα κείμενο.
 *
 * ⚠️ **ΔΕΝ είναι δεδομένο.** Υπάρχει ώστε ο `AddressMap` να ζωγραφίζει την πινέζα **εκεί που θα
 * αποθηκευτεί** (φόρμα προσθήκης έργου, νέα διεύθυνση κτιρίου). Ζει μία φορά: τη χρειάζονται δύο φόρμες.
 *
 * 🔑 Ο τύπος έρχεται **από τη φόρμα** (ADR-332 D27): η πινέζα έγραφε «Εργοτάξιο» ενώ η φόρμα
 * έλεγε «Είσοδος» — η ετικέτα στον χάρτη διαφωνούσε με αυτό που θα αποθηκευόταν.
 */
export function pendingPinAddress(point: GeoPoint, id: string, type: ProjectAddress['type']): ProjectAddress {
  return {
    id,
    street: '',
    city: '',
    postalCode: '',
    country: GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
    type,
    isPrimary: false,
    coordinates: { lat: point.lat, lng: point.lng },
  };
}

/** Μετασχηματίζει **μόνο** το κείμενο — το σημείο και οι εκβάσεις χωρίς κείμενο περνούν αυτούσια. */
export function mapPinDropText<A, B>(drop: PinDrop<A>, toB: (address: A) => B): PinDrop<B> {
  const { point, gesture, text } = drop;
  if (text.kind !== 'resolved') return { point, gesture, text };
  return { point, gesture, text: { kind: 'resolved', address: toB(text.address) } };
}

/**
 * Σημείο αφής → `PinDrop`. **Δεν πετά ποτέ**: το `reverseGeocodeDetailed` μεταφράζει κάθε
 * αποτυχία σε έκβαση, και ο χάρτης οφείλει να ειδοποιήσει τον γονιό **σε κάθε** περίπτωση.
 *
 * @param signal ακύρωση από τον καλούντα (νεότερη χειρονομία · αποπροσάρτηση) — Β13.
 */
export async function resolvePinDrop(point: GeoPoint, gesture: number, signal?: AbortSignal): Promise<PinDrop> {
  const outcome = await reverseGeocodeDetailed(point.lat, point.lng, { signal });
  switch (outcome.kind) {
    case 'found':
      return {
        point,
        gesture,
        text: { kind: 'resolved', address: reverseResultToAddress(outcome.result, point) },
      };
    case 'not-found':
      return { point, gesture, text: { kind: 'not-found' } };
    case 'error':
      return { point, gesture, text: { kind: 'unavailable' } };
  }
}
