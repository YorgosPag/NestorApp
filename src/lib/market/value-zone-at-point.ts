/**
 * @fileoverview **ΣΕ ΠΟΙΑ ΖΩΝΗ ΑΝΤΙΚΕΙΜΕΝΙΚΗΣ ΑΞΙΑΣ ΠΕΦΤΕΙ ΑΥΤΗ Η ΘΕΣΗ;** — καθαρός κριτής, χωρίς I/O.
 * @related ADR-889 §10 · `value-zone-file.ts` (τα δεδομένα) · `services/market/value-zones.reader.ts` (η φόρτωση) ·
 *   `lib/geo/admin-area-of-point.ts` (ίδιο ήθος: ανοχή, «κοντά σε όριο», ποτέ ψευδής ακρίβεια)
 * @module lib/market/value-zone-at-point
 *
 * 🔑 **Ο ΚΑΝΟΝΑΣ ΤΗΣ ΠΗΓΗΣ** (ΠΟΛ.1149/1994): η τιμή **γραμμικής** ζώνης (μετώπου) ισχύει **μόνο** για ακίνητα με
 * **πρόσοψη** (άνοιγμα) στον δρόμο της· με προσόψεις σε περισσότερες ζώνες λαμβάνεται η **μεγαλύτερη**. Μια θέση **δεν**
 * αποδεικνύει πρόσοψη. Άρα:
 * - η **κυκλική** ζώνη που περιέχει το σημείο είναι η απάντηση,
 * - τα κοντινά **μέτωπα** επιστρέφονται **υπό όρο** («αν έχει πρόσοψη στη …») — και **μόνο** όσα είναι **ακριβότερα**
 *   από την κυκλική: ένα φθηνότερο μέτωπο δεν αλλάζει ποτέ το αποτέλεσμα (λαμβάνεται η μεγαλύτερη), άρα θα ήταν θόρυβος.
 *
 * 🔴 **Ποτέ ψευδής ακρίβεια**: ζώνη = οικοδομικό τετράγωνο. Σημείο geocoder `approximate`/`center` μπορεί να πέσει
 * στο διπλανό τετράγωνο ⇒ `imprecise`, όχι λάθος τιμή με βεβαιότητα.
 */

import { isAddressPrecisePosition } from '@/lib/geo/admin-area-of-point';
import { distanceToPolylineMetres } from '@/lib/geo/geo-line';
import { geoRingsNearestEdgeMetres, isPointInGeoRings } from '@/lib/geo/geo-ring';
import type { GeoBoundingBox, GeoPoint } from '@/types/geo/coordinates';
import type { PlacePosition } from '@/types/geo/public-place';

import type { ValueFront, ValueZone, ValueZoneArea } from './value-zone-file';

/** Πόσο μακριά από το μέτωπο μπορεί να είναι η θέση ενός ακινήτου με πρόσοψη εκεί: βάθος κτιρίου + μισός δρόμος. */
export const FRONT_REACH_M = 35;

/** Πόσα μέτωπα δείχνονται — γωνιακό οικόπεδο σε σταυροδρόμι έχει έως τρία ρεαλιστικά. */
const MAX_FRONTS = 3;

/** Σφάλμα θέσης ακόμη και σε «ακριβή» διεύθυνση (είσοδος ≠ κέντρο κτιρίου) — προστίθεται στην ανοχή του ορίου. */
const POSITION_SLACK_M = 10;

export interface ValueZoneFigure {
  readonly id: number;
  readonly name: string;
  /** €/τ.μ. */
  readonly price: number;
  readonly validFrom: string;
}

export interface ValueZoneFrontCandidate extends ValueZoneFigure {
  readonly street: string;
  readonly distanceM: number;
}

export type ValueZoneVerdict =
  /** Η θέση δεν είναι η ίδια η διεύθυνση (ή είναι άγνωστη) — δεν κρίνεται σε κλίμακα τετραγώνου. */
  | { readonly kind: 'imprecise' }
  /** Καμία ζώνη στη θέση: εκτός του συστήματος αντικειμενικών αξιών (π.χ. εκτός σχεδίου) — γεγονός, όχι σφάλμα. */
  | { readonly kind: 'outside' }
  /** Τα αρχεία δεν διαβάστηκαν — «δεν ξέρω», ποτέ «εκτός». */
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'ready';
      readonly zone: ValueZoneFigure;
      /** Πιο κοντά σε όριο ζώνης από όσο κρίνει με βεβαιότητα η θέση ⇒ η οθόνη το λέει. */
      readonly nearEdge: boolean;
      /** Ακριβότερα κοντινά μέτωπα, **υπό όρο πρόσοψης**, πλησιέστερο πρώτο. */
      readonly fronts: readonly ValueZoneFrontCandidate[];
    };

const METRES_PER_DEGREE_LAT = 111_320;

/** Το bbox διευρυμένο κατά `metres` — φθηνός αποκλεισμός πριν από κάθε γεωμετρία. */
export function bboxWithin(point: GeoPoint, box: GeoBoundingBox, metres: number): boolean {
  const marginLat = metres / METRES_PER_DEGREE_LAT;
  const marginLng = marginLat / Math.max(Math.cos((point.lat * Math.PI) / 180), 0.01);
  return (
    point.lat >= box.south - marginLat && point.lat <= box.north + marginLat &&
    point.lng >= box.west - marginLng && point.lng <= box.east + marginLng
  );
}

function figureOf(zone: ValueZone | ValueFront): ValueZoneFigure {
  return { id: zone.id, name: zone.name, price: zone.price, validFrom: zone.validFrom };
}

interface ZoneHit {
  readonly zone: ValueZone;
  readonly inside: boolean;
  readonly edgeM: number;
  readonly toleranceM: number;
}

/** Όπως ο κριτής περιοχής: περιέχουσα με το σημείο **βαθύτερα**· αλλιώς η πλησιέστερη εντός ανοχής. */
function chooseZone(hits: readonly ZoneHit[]): ZoneHit | null {
  let best: ZoneHit | null = null;
  for (const hit of hits) {
    if (hit.inside && (best === null || hit.edgeM > best.edgeM)) best = hit;
  }
  if (best !== null) return best;
  for (const hit of hits) {
    if (hit.edgeM <= hit.toleranceM && (best === null || hit.edgeM < best.edgeM)) best = hit;
  }
  return best;
}

function zoneHits(point: GeoPoint, areas: readonly ValueZoneArea[]): ZoneHit[] {
  const hits: ZoneHit[] = [];
  for (const area of areas) {
    for (const zone of area.zones) {
      if (!bboxWithin(point, zone.bbox, area.toleranceM)) continue;
      const edgeM = geoRingsNearestEdgeMetres(point, zone.rings);
      hits.push({ zone, inside: isPointInGeoRings(point, zone.rings), edgeM, toleranceM: area.toleranceM });
    }
  }
  return hits;
}

/** Κοντινά μέτωπα **ακριβότερα** από την κυκλική ζώνη — ένα ανά (ζώνη, δρόμο), πλησιέστερο πρώτο. */
function frontCandidates(point: GeoPoint, areas: readonly ValueZoneArea[], zonePrice: number): ValueZoneFrontCandidate[] {
  const byKey = new Map<string, ValueZoneFrontCandidate>();
  for (const area of areas) {
    for (const front of area.fronts) {
      if (front.price <= zonePrice || !bboxWithin(point, front.bbox, FRONT_REACH_M)) continue;
      const distanceM = Math.min(...front.lines.map((line) => distanceToPolylineMetres(point, line)));
      const key = `${front.id}|${front.street}`;
      const existing = byKey.get(key);
      if (distanceM <= FRONT_REACH_M && (existing === undefined || distanceM < existing.distanceM)) {
        byKey.set(key, { ...figureOf(front), street: front.street, distanceM: Math.round(distanceM) });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.distanceM - b.distanceM || b.price - a.price).slice(0, MAX_FRONTS);
}

/**
 * **Το σημείο που κρίνεται** — ή `null` όταν η θέση δεν είναι η ίδια η διεύθυνση (τότε η απάντηση είναι `imprecise`,
 * χωρίς να διαβαστεί κανένα αρχείο).
 */
export function valueZonePointOf(position: PlacePosition): GeoPoint | null {
  return position.kind === 'known' && isAddressPrecisePosition(position) ? position.point : null;
}

/**
 * **Η ζώνη στο σημείο.** `areas` = τα αρχεία που **διαβάστηκαν** για αυτό το σημείο (ο καλών τα διαλέγει με bbox)·
 * `null` = η ανάγνωση απέτυχε.
 */
export function valueZoneAtPoint(point: GeoPoint, areas: readonly ValueZoneArea[] | null): ValueZoneVerdict {
  if (areas === null) return { kind: 'unavailable' };
  const chosen = chooseZone(zoneHits(point, areas));
  if (chosen === null) return { kind: 'outside' };

  return {
    kind: 'ready',
    zone: figureOf(chosen.zone),
    nearEdge: chosen.edgeM <= chosen.toleranceM + POSITION_SLACK_M,
    fronts: frontCandidates(point, areas, chosen.zone.price),
  };
}
