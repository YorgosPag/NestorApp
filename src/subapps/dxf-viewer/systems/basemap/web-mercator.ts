/**
 * Web Mercator (EPSG:3857) — το πλέγμα πλακιδίων που μιλούν **όλοι** οι πάροχοι χάρτη.
 *
 * ## Τι είναι — και τι ΔΕΝ επιτρέπεται να γίνει
 * Κάθε πάροχος (OpenStreetMap, Bing, Google, MapTiler, Protomaps) σερβίρει πλακίδια στο ίδιο
 * σχήμα `z/x/y`: ο κόσμος σε ένα τετράγωνο, διχοτομημένο `z` φορές. Αυτό το module είναι η
 * **μόνη** μετάφραση ανάμεσα σε εκείνο το σχήμα και σε γεωγραφικές συντεταγμένες.
 *
 * ⚠️ **Το Web Mercator ΔΕΝ γίνεται ποτέ το σύστημα του καμβά.** Ο συντελεστής κλίμακάς του είναι
 * `1/cos(φ)` — **~1,29× στην Ελλάδα** — και το ESRI το δηλώνει κατά λέξη: *«EPSG:3857 is for
 * rendering tiles, not for measuring»*. Ένα εργαλείο που βγάζει εμβαδά, όγκους και πίνακες
 * συντεταγμένων ΕΓΣΑ'87 δεν επιτρέπεται να ζωγραφίζει σε προβολή που η ίδια η βιομηχανία
 * δηλώνει ακατάλληλη για μέτρηση. Άρα η ροή είναι **μονόδρομη**:
 *
 *     πλακίδιο → Web Mercator → WGS84 → [μετάθεση datum] → ΕΓΣΑ'87 → κόσμος → σχέδιο
 *
 * Τα πλακίδια έρχονται στον κόσμο μας. Ο κόσμος μας δεν πάει ποτέ στα πλακίδια. Αυτό είναι
 * ακριβώς το πρότυπο του `GEOMAP` της AutoCAD, όπου το υπόβαθρο μπαίνει στον χώρο του μοντέλου
 * ενώ το σχέδιο μένει στο τοπικό προβολικό σύστημα.
 *
 * Καθαρό module — μηδέν React/DOM/δίκτυο/store, μοίρες παντού.
 *
 * @see ../geo-referencing/ggrs87-datum.ts — το επόμενο σκαλί (WGS84 ↔ ΕΓΣΑ'87)
 * @see ../geo-referencing/egsa87-projection.ts — και το τελευταίο (ελλειψοειδές ↔ κάνναβος)
 */

/** Θέση μέσα στο πλέγμα πλακιδίων ενός επιπέδου — **συνεχής**, όχι ακέραια. */
export interface TileFraction {
  /** Οριζόντια θέση σε μονάδες πλακιδίου (0 … 2^z). */
  readonly tx: number;
  /** Κατακόρυφη θέση σε μονάδες πλακιδίου (0 = βόρειο άκρο). */
  readonly ty: number;
}

/** Η ταυτότητα ενός πλακιδίου: επίπεδο + ακέραιες συντεταγμένες πλέγματος. */
export interface TileId {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

const DEG = Math.PI / 180;

/**
 * Το γεωγραφικό πλάτος πέρα από το οποίο το Web Mercator εκτείνεται στο άπειρο (±85,051129°).
 * Ο κόσμος κόβεται εκεί ώστε το πλέγμα να είναι τετράγωνο — σύμβαση όλων των παρόχων.
 */
export const MERCATOR_MAX_LATITUDE = 85.05112877980659;

/** Περίμετρος του ισημερινού (m) στη σφαίρα που χρησιμοποιεί το Web Mercator. */
const EQUATOR_CIRCUMFERENCE_M = 2 * Math.PI * 6_378_137;

/** Πλήθος πλακιδίων ανά πλευρά στο επίπεδο `z`. */
export function tilesPerAxis(z: number): number {
  return 2 ** z;
}

/** WGS84 (μοίρες) → συνεχής θέση στο πλέγμα του επιπέδου `z`. */
export function geographicToTileFraction(lat: number, lon: number, z: number): TileFraction {
  const n = tilesPerAxis(z);
  const clampedLat = Math.max(-MERCATOR_MAX_LATITUDE, Math.min(MERCATOR_MAX_LATITUDE, lat));
  const phi = clampedLat * DEG;
  return {
    tx: ((lon + 180) / 360) * n,
    ty: ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n,
  };
}

/** Συνεχής θέση στο πλέγμα του επιπέδου `z` → WGS84 (μοίρες). Ο ακριβής αντίστροφος. */
export function tileFractionToGeographic(tx: number, ty: number, z: number): { lat: number; lon: number } {
  const n = tilesPerAxis(z);
  return {
    lon: (tx / n) * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) / DEG,
  };
}

/**
 * Μέτρα εδάφους ανά εικονοστοιχείο πλακιδίου στο επίπεδο `z`, στο γεωγραφικό πλάτος `lat`.
 *
 * Ο όρος `cos(lat)` **δεν είναι λεπτομέρεια**: είναι ακριβώς η παραμόρφωση του Mercator, και
 * παραλείποντάς τον η επιλογή επιπέδου θα αστοχούσε κατά ~29% στην Ελλάδα — δηλαδή θα ζητούσε
 * σταθερά θολότερα πλακίδια απ' όσο χρειάζεται η οθόνη.
 */
export function groundResolutionM(lat: number, z: number, tileSizePx: number): number {
  return (EQUATOR_CIRCUMFERENCE_M * Math.cos(lat * DEG)) / (tilesPerAxis(z) * tileSizePx);
}

/** Το πλακίδιο που περιέχει μια συνεχή θέση (προς τα κάτω, όπως το ζητούν οι πάροχοι). */
export function tileFractionToTileId(f: TileFraction, z: number): TileId {
  return { z, x: Math.floor(f.tx), y: Math.floor(f.ty) };
}

/**
 * `true` όταν το πλακίδιο υπάρχει στο πλέγμα του επιπέδου του.
 *
 * Χρειάζεται γιατί το ορατό ορθογώνιο του καμβά μπορεί να εκτείνεται έξω από τον κόσμο (ο
 * χρήστης κάνει zoom-out σε άδειο σχέδιο). Ένα αίτημα για ανύπαρκτο πλακίδιο θα γύριζε 404 και
 * θα μετρούσε στο όριο κίνησης του παρόχου — δηλαδή θα ήταν αίτημα που **γνωρίζαμε** ότι θα
 * αποτύχει.
 */
export function isTileInWorld(tile: TileId): boolean {
  const n = tilesPerAxis(tile.z);
  return tile.x >= 0 && tile.x < n && tile.y >= 0 && tile.y < n;
}

// ADR-700 §4 (2026-08-24): tileCornersGeographic() ΔΙΑΓΡΑΦΗΚΕ — μηδέν καταναλωτές. Το
// συμβόλαιο σειράς που περιέγραφε (ΒΔ·ΒΑ·ΝΑ·ΝΔ) δεν καταναλώθηκε ποτέ από τον
// μετασχηματισμό υποβάθρου· το `tileFractionToGeographic` παραμένει και είναι ζωντανό.
