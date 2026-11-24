/**
 * @fileoverview **ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΔΙΕΥΘΥΝΣΗ;** — επαλήθευση της διεύθυνσης ενός εγγράφου **ως συνόλου** (ADR-950 §8.2).
 * @module server/files/evidence-address-verification
 *
 * 🔴 2026-11-23 (ζωντανός έλεγχος): η AI διάβασε «Σαμοφράκης» στη σφραγίδα «ΣΑΜΟΘΡΑΚΗΣ 16 … Τ.Κ. 563 34» με δηλωμένη
 * εμπιστοσύνη 0.95. Το όνομα οδού είναι ελεύθερο κείμενο — κανένας ντετερμινιστικός ελεγκτής δεν το πιάνει. Το πιάνει
 * μόνο **ο κόσμος**: υπάρχει τέτοια οδός σε αυτόν τον Τ.Κ.;
 *
 * Πρότυπο: Google Address Validation (`verdict` + `spellCorrected`). Εξυπνότερο σε δύο σημεία:
 * 1. η διόρθωση χρειάζεται **δύο ανεξάρτητες αποδείξεις** — υπαρκτό όνομα οδού στη γειτονιά του Τ.Κ. **και**
 *    επιβεβαίωση οδός+Τ.Κ. από τον γεωκωδικοποιητή (Nominatim) — και πρέπει να είναι **μοναδική**·
 * 2. η ομοιότητα μετρά **μετά** το δίπλωμα των τάξεων μορφής OCR (Θ/Φ/Ο… κοστίζουν 0), με όριο λαθών AUTO
 *    (`closestUnderOcrConfusion`, §8.13) — πιάνει και γράμματα **κρυμμένα** από υπογραφή («ΣΑΜΟΓΡΑΦΗΣ»).
 *
 * 🔴 §8.13 (2026-11-24): τα ονόματα οδών έρχονται **πρώτα από το δικό μας αρχείο OSM** (`findArchiveStreetNamesNear`)·
 *    ο δημόσιος Overpass ήταν πεσμένος (502 / timeout) και το σιωπηλό `[]` του έλεγε «καμία οδός». Ο Overpass μένει
 *    εφεδρεία φρεσκάδας, **αυστηρά**: «δεν απάντησε κανείς» ⇒ `unavailable`, ποτέ `unverified`.
 *
 * Καμία δεύτερη μηχανή: ο ΕΝΑΣ γεωκωδικοποιητής (`geocodeWithVerdict`, μνήμη + σκάλα), το ΕΝΑ αρχείο OSM, ο ΕΝΑΣ πελάτης
 * Overpass, η ΜΙΑ σύγκριση πεδίου (`compareAddressField`). Τρέχει στη **λωρίδα παρασκηνίου** (ρυθμός Nominatim).
 */

import 'server-only';

import { geocodeWithVerdict, type GeocodeVerdict } from '@/app/api/geocoding/geocoding-engine';
import { inBackgroundGeocodingLane } from '@/app/api/geocoding/nominatim-pacer';
import { toGeocodingRequest } from '@/lib/geocoding/address-geocoding-query';
import { compareAddressField } from '@/lib/geocoding/field-match';
import type { GeocodingApiResponse } from '@/lib/geocoding/geocoding-types';
import { findArchiveStreetNamesNear } from '@/lib/geo/osm/osm-archive';
import { overpassQuerySeconds, runOverpassQueryStrict } from '@/lib/geo/osm/overpass-client';
import { closestUnderOcrConfusion } from '@/lib/string/ocr-glyph-fold';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import type { EvidenceAddressVerification } from '@/schemas/ai-analysis';

const logger = createModuleLogger('evidence-address-verification');

/** Ακτίνα αναζήτησης ονομάτων οδών γύρω από το σημείο του Τ.Κ. — ένας αστικός Τ.Κ. καλύπτει ~1–2 χλμ. */
const STREET_SEARCH_RADIUS_METERS = 1500;

/** Η διεύθυνση όπως **γειώθηκε** (κάθε μέρος ήδη πέρασε τον ελεγκτή του). */
export interface EvidenceAddressReading {
  readonly street: string;
  readonly number: string | null;
  readonly postalCode: string;
  readonly city: string | null;
}

function geocode(reading: EvidenceAddressReading, street: string | null): Promise<GeocodeVerdict> {
  return geocodeWithVerdict(toGeocodingRequest({
    street: street ?? undefined,
    number: street === null ? undefined : reading.number ?? undefined,
    postalCode: reading.postalCode,
    city: street === null ? reading.city ?? undefined : undefined,
  }));
}

/**
 * Η απάντηση επιβεβαιώνει την οδό **και δεν διαψεύδει** τον Τ.Κ.; (το OSM συχνά δεν έχει Τ.Κ. στην οδό ⇒ `unknown`·
 * το ερώτημα όμως τον περιείχε, και η σκάλα δέχεται χαλάρωση μόνο αποδεικνύοντας τον Τ.Κ. — ADR-332 D28)
 */
function provesStreet(result: GeocodingApiResponse, street: string, postalCode: string): boolean {
  const fields = result.resolvedFields;
  return compareAddressField('street', street, fields) === 'match' && compareAddressField('postalCode', postalCode, fields) !== 'mismatch';
}

function placesOf(result: GeocodingApiResponse): string[] {
  const { city, county, region, neighborhood } = result.resolvedFields;
  return [neighborhood, city, county, region].filter((place): place is string => typeof place === 'string' && place.trim() !== '');
}

type StreetNames = { readonly kind: 'ok'; readonly names: readonly string[] } | { readonly kind: 'unavailable' };

/** Τα ονόματα οδών γύρω από ένα σημείο από τον **Overpass** — αυστηρά: «δεν απάντησε» ≠ «καμία οδός». */
async function overpassStreetNames(lat: number, lon: number): Promise<StreetNames> {
  const query = `[out:json][timeout:${overpassQuerySeconds()}];way["highway"]["name"](around:${STREET_SEARCH_RADIUS_METERS},${lat},${lon});out tags;`;
  const outcome = await runOverpassQueryStrict(query);
  if (!outcome.ok) return { kind: 'unavailable' };
  const names = outcome.elements.map((element) => element.tags?.name).filter((name): name is string => typeof name === 'string');
  return { kind: 'ok', names: [...new Set(names)] };
}

/**
 * **Ο υποψήφιος «Μήπως…»** (ADR-950 §8.13). Πρώτα το **δικό μας** αρχείο (ντετερμινιστικό, ίδιο build με τον χάρτη)·
 * ο Overpass μόνο όταν το αρχείο δεν απάντησε ή δεν βρήκε κάτι (φρεσκάδα: οδός νεότερη από το build).
 * `unavailable` ⇒ **καμία** πηγή δεν απάντησε — ποτέ «δεν υπάρχει».
 */
async function streetCandidate(printed: string, lat: number, lng: number): Promise<{ readonly kind: 'ok'; readonly street: string | null } | { readonly kind: 'unavailable' }> {
  const archive = await findArchiveStreetNamesNear({ lat, lng });
  const fromArchive = archive.kind === 'ok' ? closestUnderOcrConfusion(printed, archive.names) : null;
  if (fromArchive !== null) return { kind: 'ok', street: fromArchive };
  const overpass = await overpassStreetNames(lat, lng);
  if (overpass.kind === 'ok') return { kind: 'ok', street: closestUnderOcrConfusion(printed, overpass.names) };
  return archive.kind === 'ok' ? { kind: 'ok', street: null } : { kind: 'unavailable' };
}

const stamp = (verdict: EvidenceAddressVerification['verdict'], extra: Partial<EvidenceAddressVerification> = {}): EvidenceAddressVerification => ({
  verdict,
  verifiedAt: nowISO(),
  ...extra,
});

/** Το σημείο αναφοράς του Τ.Κ. — από την πρώτη απάντηση αν υπάρχει, αλλιώς από αναζήτηση μόνο του Τ.Κ. */
async function postalAnchor(reading: EvidenceAddressReading, first: GeocodeVerdict): Promise<GeocodingApiResponse | null> {
  if (first.kind === 'hit') return first.result;
  const anchor = await geocode(reading, null);
  return anchor.kind === 'hit' ? anchor.result : null;
}

async function verify(reading: EvidenceAddressReading): Promise<EvidenceAddressVerification> {
  const first = await geocode(reading, reading.street);
  if (first.kind === 'unavailable') return stamp('unavailable');
  if (first.kind === 'hit' && provesStreet(first.result, reading.street, reading.postalCode)) {
    return stamp('confirmed', { places: placesOf(first.result) });
  }
  const anchor = await postalAnchor(reading, first);
  if (anchor === null) return stamp('unverified');
  const lookup = await streetCandidate(reading.street, anchor.lat, anchor.lng);
  if (lookup.kind === 'unavailable') return stamp('unavailable', { places: placesOf(anchor) });
  const candidate = lookup.street;
  if (candidate === null) return stamp('unverified', { places: placesOf(anchor) });
  const second = await geocode(reading, candidate);
  if (second.kind === 'hit' && provesStreet(second.result, candidate, reading.postalCode)) {
    return stamp('corrected', { correctedStreet: candidate, places: placesOf(second.result) });
  }
  return stamp(second.kind === 'unavailable' ? 'unavailable' : 'unverified', { places: placesOf(anchor) });
}

/**
 * **Η επαλήθευση.** Ποτέ δεν πετά: αποτυχία ⇒ `unavailable` (καμία κρίση), ώστε η ανάγνωση να μη χαθεί εξαιτίας του χάρτη.
 */
export async function verifyEvidenceAddress(reading: EvidenceAddressReading): Promise<EvidenceAddressVerification> {
  try {
    return await inBackgroundGeocodingLane(() => verify(reading));
  } catch (cause: unknown) {
    logger.warn('Address verification failed — no verdict', { cause });
    return stamp('unavailable');
  }
}
