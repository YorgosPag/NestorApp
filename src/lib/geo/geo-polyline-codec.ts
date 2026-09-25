/**
 * # ΣΧΗΜΑ ΣΕ ΚΕΙΜΕΝΟ — ΤΟ GOOGLE ENCODED POLYLINE (ADR-885)
 *
 * Ένα σχήμα πρέπει να χωρά σε **σύνδεσμο**: να κοινοποιείται, να επιβιώνει το refresh, να
 * ανοίγει ίδιο σε άλλη συσκευή. Η ωμή λίστα `lat,lng` κοστίζει ~20 χαρακτήρες ανά κορυφή·
 * το **Encoded Polyline Algorithm Format** της Google κοστίζει ~4–6, επειδή γράφει
 * **διαφορές** από την προηγούμενη κορυφή σε μεταβλητό μήκος.
 *
 * 🏆 **Δεν είναι εφεύρεση μας**: είναι το ίδιο format που κουβαλά το Rightmove στο
 * `USERDEFINEDAREA^…`, που επιστρέφει κάθε Directions API, και που διαβάζει κάθε GIS
 * βιβλιοθήκη. Ένας σύνδεσμός μας είναι αναγνώσιμος από εργαλεία που δεν ξέρουν ότι
 * υπάρχουμε.
 * 📘 https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * 🔑 **Ακρίβεια 5 (10⁻⁵° ≈ 1,1 m)** — η αρχική της Google. Η 6 (≈ 11 cm, OSRM/Valhalla)
 * κοστίζει ~1 χαρακτήρα ανά κορυφή για ακρίβεια που καμία χειρονομία με δάχτυλο δεν έχει.
 *
 * 🔒 **Γενικό, όχι «αναζήτησης»**: δεν ξέρει τι είναι αγγελία ή φίλτρο. Εκεί ζει το
 * `lib/listings/listing-drawn-area.ts`.
 */

import type { GeoPoint } from '@/types/geo/coordinates';

/** Δεκαδικά ψηφία που διατηρεί ο κωδικοποιητής — ο ΕΝΑΣ αριθμός και για τις δύο κατευθύνσεις. */
export const POLYLINE_PRECISION = 5;

const FACTOR = 10 ** POLYLINE_PRECISION;

/** Κάθε χαρακτήρας κουβαλά 5 bit· προστίθεται 63 ώστε να είναι εκτυπώσιμος ASCII. */
const CHUNK_BITS = 5;
const CHUNK_MASK = 0x1f;
const CONTINUATION = 0x20;
const ASCII_OFFSET = 63;
/** Ο μεγαλύτερος χαρακτήρας που μπορεί να εμφανιστεί (`63 + 0x3f`). */
const MAX_CHAR_CODE = ASCII_OFFSET + CONTINUATION + CHUNK_MASK;

/**
 * **Η κβάντιση στο πλέγμα του κωδικοποιητή** — ό,τι θα έβγαινε από έναν γύρο
 * `encode → decode`, χωρίς να γίνει ο γύρος.
 *
 * 🔑 Υπάρχει ώστε το σχήμα στη **μνήμη** να είναι **ακριβώς** το σχήμα του **συνδέσμου**:
 * ό,τι κρίνεται πριν την Εφαρμογή κρίνεται και μετά το refresh.
 */
export function quantizeGeoPoint(point: GeoPoint): GeoPoint {
  return { lat: Math.round(point.lat * FACTOR) / FACTOR, lng: Math.round(point.lng * FACTOR) / FACTOR };
}

function encodeSigned(value: number): string {
  let bits = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (bits >= CONTINUATION) {
    out += String.fromCharCode((CONTINUATION | (bits & CHUNK_MASK)) + ASCII_OFFSET);
    bits >>= CHUNK_BITS;
  }
  return out + String.fromCharCode(bits + ASCII_OFFSET);
}

/** Κορυφές → κείμενο. Η σειρά είναι `lat` πριν `lng`, όπως ορίζει η Google. */
export function encodeGeoPolyline(points: readonly GeoPoint[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  for (const point of points) {
    const lat = Math.round(point.lat * FACTOR);
    const lng = Math.round(point.lng * FACTOR);
    out += encodeSigned(lat - lastLat) + encodeSigned(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

/** Ένας αριθμός από τη θέση `start`, ή `null` αν το κείμενο κόβεται στη μέση του. */
function decodeSigned(text: string, start: number): { value: number; next: number } | null {
  let result = 0;
  let shift = 0;
  let index = start;
  for (;;) {
    if (index >= text.length || shift > 30) return null;
    const code = text.charCodeAt(index) - ASCII_OFFSET;
    index += 1;
    result |= (code & CHUNK_MASK) << shift;
    shift += CHUNK_BITS;
    if (code < CONTINUATION) break;
  }
  return { value: result & 1 ? ~(result >> 1) : result >> 1, next: index };
}

/**
 * Κείμενο → κορυφές, ή `null`.
 *
 * ⚠️ **Fail-closed**: χαρακτήρας εκτός αλφαβήτου, κείμενο που κόβεται στη μέση ζεύγους,
 * ή συντεταγμένη εκτός γήινων ορίων ⇒ `null` **ολόκληρο**. Ένα μισό-αποκωδικοποιημένο
 * σχήμα δεν είναι μισό-σωστό· είναι άλλο σχήμα, που θα φιλτράριζε με σιγουριά.
 */
export function decodeGeoPolyline(text: string): readonly GeoPoint[] | null {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < ASCII_OFFSET || code > MAX_CHAR_CODE) return null;
  }

  const points: GeoPoint[] = [];
  let lat = 0;
  let lng = 0;
  let index = 0;
  while (index < text.length) {
    const dLat = decodeSigned(text, index);
    if (dLat === null) return null;
    const dLng = decodeSigned(text, dLat.next);
    if (dLng === null) return null;
    lat += dLat.value;
    lng += dLng.value;
    index = dLng.next;

    const point = { lat: lat / FACTOR, lng: lng / FACTOR };
    if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return null;
    points.push(point);
  }
  return points;
}
