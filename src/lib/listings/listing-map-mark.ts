/**
 * @fileoverview **Το σημάδι της αγγελίας στον χάρτη** — ό,τι ΒΛΕΠΕΙ ο κόσμος, όχι ό,τι ΞΕΡΟΥΜΕ.
 * @related ADR-777 §8.70 (Φάση 2) · lib/listings/listing-map-shape · lib/listings/listings-geojson
 * @module lib/listings/listing-map-mark
 *
 * 🔑 **Η θέση (`ListingPosition`) απαντά «πού είναι και ποιος το ξέρει»· το σημάδι απαντά «τι
 * ζωγραφίζεται».** Το σημάδι είναι η θέση **αφού** περάσει από τον έναν μεταφραστή
 * (`listingMapShape`): κρατά το σχήμα, το σημείο και —μόνο για `outline`— το αποθηκευμένο
 * περίγραμμα. Προέλευση, ακρίβεια γεωκωδικοποιητή, `osmRef` και χρόνος **πετιούνται**.
 *
 * 🔴 **ΓΙΑΤΙ ΑΥΤΟ ΚΑΙ ΟΧΙ Η ΘΕΣΗ ΣΤΟ ΕΓΓΡΑΦΟ ΤΟΥ ΚΑΤΟΧΟΥ.** Η κάρτα «Τα ακίνητά μου» δεν
 * επιτρέπεται να δείχνει **ακριβέστερη** θέση από τον δημόσιο χάρτη. Αν κουβαλούσε τη θέση, το
 * όριο θα ήταν πειθαρχία («θυμήσου να περάσεις από το `listingMapShape`»)· με το σημάδι είναι
 * **δομικό**: για μια «Θεσσαλονίκη» η κάρτα λαμβάνει `shaded-city` και **δεν υπάρχει** πεδίο από
 * το οποίο να ξαναβγάλει πινέζα.
 *
 * 🔑 **Ένας ζωγράφος για δύο καταναλωτές.** Ο δημόσιος χάρτης (`listingsToGeoJson`) και το
 * στιγμιότυπο της κάρτας χτίζουν το feature από **το ίδιο** σημάδι μέσω του
 * `listingFeature` — δύο δρόμοι προς το ίδιο σχήμα θα ήταν δύο ευκαιρίες να αποκλίνουν.
 */

import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';
import type { ListingPosition } from '@/types/public-listing';

import { LISTING_UNCERTAINTY_KM, listingMapShape, type ListingMapShape } from './listing-map-shape';

/** Κάθε σχήμα που **ζωγραφίζεται** — το `none` δεν έχει σημάδι, μπαίνει στον μετρητή (Α5 §4.1). */
export type MappedListingShape = Exclude<ListingMapShape, 'none'>;

export interface ListingMapMark {
  readonly shape: MappedListingShape;
  /** Το αντιπροσωπευτικό σημείο — το κέντρο της σκίασης όταν το σχήμα είναι περιοχή. */
  readonly point: GeoPoint;
  /** **Μόνο** όταν `shape === 'outline'` — το αποθηκευμένο (ποτέ OSM, ODbL) περίγραμμα. */
  readonly outline?: GeoOutline;
}

/** Τα σχήματα που ζωγραφίζονται, **παραγμένα** από τον πίνακα αβεβαιότητας (εξαντλητικό Record). */
const MAPPED_SHAPES: ReadonlySet<string> = new Set(
  Object.keys(LISTING_UNCERTAINTY_KM).filter((shape) => shape !== 'none'),
);

function copyPoint(point: GeoPoint): GeoPoint {
  return { lat: point.lat, lng: point.lng };
}

/**
 * **Γραφέας** — θέση → σημάδι, ή `null` όταν η αγγελία δεν έχει τίποτα να ζωγραφίσει.
 *
 * ⚠️ Χωρίς `liveOutline`, επίτηδες: το ζωντανό περίγραμμα OSM **δεν αποθηκεύεται** (ODbL, §13.4).
 */
export function listingMapMark(position: ListingPosition): ListingMapMark | null {
  if (position.kind !== 'known') return null;
  const shape = listingMapShape(position);
  if (shape === 'none') return null;

  const point = copyPoint(position.point);
  if (shape === 'outline' && position.outline && position.outline.length > 0) {
    return { shape, point, outline: position.outline.map(copyPoint) };
  }
  return { shape, point };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parsePoint(raw: unknown): GeoPoint | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  if (!isFiniteNumber(candidate.lat) || !isFiniteNumber(candidate.lng)) return null;
  if (Math.abs(candidate.lat) > 90 || Math.abs(candidate.lng) > 180) return null;
  return { lat: candidate.lat, lng: candidate.lng };
}

function isMappedShape(value: unknown): value is MappedListingShape {
  return typeof value === 'string' && MAPPED_SHAPES.has(value);
}

/**
 * **Αναγνώστης** — σημάδι από τον δίσκο, ή `null`.
 *
 * ⚠️ Ελέγχει το σχήμα: το έγγραφο απλώνεται αυτούσιο, άρα ό,τι βρίσκεται στον δίσκο φτάνει εδώ
 * **χωρίς εγγύηση**. Σκουπίδι ⇒ `null` ⇒ δηλωμένη απουσία, ποτέ χάρτης στη λάθος θέση.
 * Περίγραμμα με έστω ένα άκυρο σημείο **απορρίπτεται ολόκληρο** — μισό πολύγωνο είναι ψέμα.
 */
export function parseListingMapMark(raw: unknown): ListingMapMark | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  if (!isMappedShape(candidate.shape)) return null;
  const point = parsePoint(candidate.point);
  if (point === null) return null;

  if (candidate.shape !== 'outline') return { shape: candidate.shape, point };
  if (!Array.isArray(candidate.outline) || candidate.outline.length < 3) return null;
  const outline = candidate.outline.map(parsePoint);
  if (outline.some((vertex) => vertex === null)) return null;
  return { shape: 'outline', point, outline: outline.filter((vertex): vertex is GeoPoint => vertex !== null) };
}
