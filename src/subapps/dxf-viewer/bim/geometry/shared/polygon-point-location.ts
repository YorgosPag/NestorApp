/**
 * ADR-730 — «μέσα στο πολύγωνο»: **ΜΙΑ** θέση, **ΤΡΕΙΣ** τιμές, **ρητή φυσική ανοχή**.
 *
 * ── Το σφάλμα που λύνει ─────────────────────────────────────────────────────────────────────
 * Το `pointInPolygon` του `polygon-utils` είναι σκέτο crossing-number ray-casting. Επιστρέφει
 * **boolean**, άρα είναι δομικά ανίκανο να πει «το σημείο είναι **ΠΑΝΩ** στη γραμμή» — και για
 * τέτοιο σημείο η απάντησή του είναι **αυθαίρετη** (εξαρτάται από τη φορά της ακμής και από το
 * ποια πλευρά του half-open κανόνα `yi > y !== yj > y` πέφτει η κορυφή). Επί ~4 χρόνια το σχόλιό
 * του **υποσχόταν** «μέσα ή στην ακμή» χωρίς να ελέγχει καμία ακμή, και το ψέμα **διαδόθηκε**
 * αυτούσιο στον καταναλωτή `check-boundary-elevation-coverage` («εντός/επί του ορίου»).
 *
 * 🔴 **Δεν είναι ακαδημαϊκό.** Στο πραγματικό εργοτάξιο του ADR-725, **10** βολές κάθονται πάνω
 * στη γραμμή του οικοπέδου (≤5 cm) και **2** από αυτές έχουν υψόμετρο. Οικόπεδο του οποίου οι
 * μόνες βολές είναι **οι κορυφές του** — απολύτως συνηθισμένο σε αστικό τεμάχιο — μπορεί να
 * ταξινομηθεί «0 μετρημένα σημεία εντός» και να πάρει **ψευδές `high`** (ADR-725 §3.4), δηλαδή
 * ακριβώς η παραβίαση του «μηδέν ψευδώς θετικά» που ο έλεγχος χτίστηκε για να αποφύγει.
 *
 * ── Τι κάνουν οι μεγάλοι (έρευνα 2026-07-29, όχι γνώση εκπαίδευσης) ─────────────────────────
 *
 * **Σχολή Α — OGC / JTS / GEOS / PostGIS: τριαδική θέση, ΜΗΔΕΝ ανοχή.**
 * Το `RayCrossingCounter` του JTS **δεν** επιστρέφει boolean: επιστρέφει `Location` ∈
 * {`INTERIOR`, `BOUNDARY`, `EXTERIOR`}, με ρητό `isOnSegment()` που ανιχνεύεται **μέσα στον ίδιο
 * βρόχο** και **βραχυκυκλώνει** («no further segments need be supplied»). Τα `within` / `covers` /
 * `contains` **δεν είναι αλγόριθμοι** — είναι *παράγωγα κατηγορήματα* πάνω σε αυτόν τον ΕΝΑ
 * υπολογισμό. Το PostGIS συνιστά ρητά `ST_CoveredBy` **αντί** `ST_Within`, «γιατί δεν έχει το
 * κόλπο ότι τα σύνορα δεν είναι εντός του σχήματός τους». Κόστος: το JTS χρησιμοποιεί
 * extended-precision orientation test και **δεν έχει καμία παράμετρο ανοχής**.
 *
 * **Σχολή Β — ESRI / ArcGIS: φυσική ανοχή.**
 * Κάθε geodataset φέρει **XY tolerance με προεπιλογή 0,001 m = 1 mm** (και για non-geodatabase
 * δεδομένα η τιμή αυτή **δεν αλλάζει**). Είναι **χιλιοστά εδάφους**, όχι epsilon μηχανής.
 *
 * ── 🎯 Γιατί εδώ πάμε πιο πέρα και από τους δύο ─────────────────────────────────────────────
 * Η σχολή Α είναι **άχρηστη για δεδομένα DXF/CSV**: το JTS λέει `BOUNDARY` μόνο όταν το σημείο
 * είναι *ακριβώς* επί του τμήματος· βολή τοπογράφου στα 3 mm από τη γραμμή δεν είναι **ποτέ**
 * «ακριβώς». Η σχολή Β έχει την ανοχή αλλά την **κρύβει** στο spatial reference — ο καταναλωτής
 * δεν ξέρει ποια ισχύει και δεν μπορεί να τη διαφοροποιήσει ανά ερώτημα.
 *
 * Εδώ: **τριαδική θέση κατά JTS** + **ανοχή ως ρητή παράμετρο υπογραφής σε mm**, σε **ένα
 * πέρασμα** με φθηνή απόρριψη bbox. Και μια ιδιότητα που δίνει την πλήρη γέφυρα ανάμεσα στις δύο
 * σχολές: **`boundaryToleranceMm: 0` εκφυλίζεται ακριβώς στη σημασιολογία του JTS** (μόνο ακριβές
 * σημείο επί ακμής μετράει ως σύνορο). Μία συνάρτηση, και οι δύο κόσμοι, μηδέν κρυφή τιμή.
 *
 * ── ⚠️ Πότε ΔΕΝ χρησιμοποιείται αυτό ────────────────────────────────────────────────────────
 * Ο **κανόνας γεμίσματος even-odd** (hatch islands, image fill, clipping) απαιτεί **ΩΜΟ**
 * crossing-number: εκεί το σύνορο είναι *σύμβαση απόδοσης*, και ανοχή θα **πάχαινε** τα νησιά
 * και θα χαλούσε το γέμισμα. Αυτοί οι καταναλωτές μένουν στο {@link pointInPolygon} — που γι'
 * αυτόν ακριβώς τον λόγο **διατηρείται αμετάβλητο** ως γρήγορο μονοπάτι, όχι από αδράνεια.
 *
 * ── Μονάδες ─────────────────────────────────────────────────────────────────────────────────
 * Η ανοχή είναι σε **canonical mm** και προϋποθέτει ότι σημείο + πολύγωνο είναι στο **ίδιο**
 * mm frame (world ή LOCAL — το `worldToLocal` είναι καθαρή αφαίρεση origin, οι μονάδες μένουν
 * mm). Καταναλωτής σε **canvas units** ΔΕΝ πρέπει να περάσει ανοχή σε mm (ADR-716).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-730-polygon-point-location-semantics.md
 * @see ./polygon-utils — `pointInPolygon` (ωμό crossing-number, fill rules)
 */

import { pointToSegmentDistance } from '../../../systems/guides';

/** Ελάχιστο read-only επίπεδο σημείο — ό,τι εκθέτει `x`/`y` (Point2D, Point3D, κορυφή, λαβή). */
export interface PlanarPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Τοπολογική θέση σημείου ως προς πολύγωνο — το ισοδύναμο του JTS `Location`.
 * Τα κατηγορήματα `within` / `covers` **παράγονται** από αυτό, δεν το ξαναϋπολογίζουν.
 */
export type PolygonPointLocation = 'interior' | 'boundary' | 'exterior';

/**
 * Προεπιλεγμένη ανοχή συνόρου, σε **canonical mm**.
 *
 * **1 mm** = η προεπιλεγμένη XY tolerance του ArcGIS (0,001 m) — de facto πρότυπο του κλάδου για
 * γεωχωρικά δεδομένα, όχι αυθαίρετο νούμερο και όχι νούμερο ενός εργοταξίου. Καταναλωτής που
 * χρειάζεται άλλη τιμή (π.χ. ανοχή επιλογής σε pixels-to-mm) την περνά **ρητά**.
 */
export const DEFAULT_BOUNDARY_TOLERANCE_MM = 1;

export interface PolygonLocationOptions {
  /**
   * Ανοχή συνόρου σε **canonical mm**. Παράλειψη ⇒ {@link DEFAULT_BOUNDARY_TOLERANCE_MM}.
   * Ρητό `0` (ή μη πεπερασμένη/αρνητική τιμή) ⇒ **ακριβής** έλεγχος, δηλαδή η σημασιολογία
   * του JTS: μόνο σημείο *ακριβώς* επί της ακμής χαρακτηρίζεται `'boundary'`.
   */
  readonly boundaryToleranceMm?: number;
}

/** `undefined` ⇒ προεπιλογή· μη-πεπερασμένη/αρνητική ⇒ 0 (ακριβής έλεγχος, ποτέ σιωπηλό NaN). */
function normalizeToleranceMm(raw: number | undefined): number {
  if (raw === undefined) return DEFAULT_BOUNDARY_TOLERANCE_MM;
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/**
 * Φθηνή απόρριψη πριν την τετραγωνική ρίζα: σημείο έξω από το bbox της ακμής **διογκωμένο κατά
 * `tol`** δεν μπορεί να απέχει ≤ `tol` από αυτήν. Απαλείφει το `Math.sqrt` για τη συντριπτική
 * πλειονότητα των ακμών, ώστε η επαναχρησιμοποίηση του SSoT `pointToSegmentDistance` (N.12 —
 * μηδέν δεύτερη υλοποίηση απόστασης) να μη γίνει κόστος.
 */
function withinEdgeBbox(p: PlanarPoint, a: PlanarPoint, b: PlanarPoint, tol: number): boolean {
  if (p.x < Math.min(a.x, b.x) - tol || p.x > Math.max(a.x, b.x) + tol) return false;
  if (p.y < Math.min(a.y, b.y) - tol || p.y > Math.max(a.y, b.y) + tol) return false;
  return true;
}

/**
 * Θέση σημείου ως προς κλειστό πολύγωνο (XY plane, z αγνοείται) — **ένα πέρασμα**.
 *
 * Ο έλεγχος συνόρου γίνεται **μέσα στον ίδιο βρόχο** με το crossing-number και **βραχυκυκλώνει**
 * μόλις βρεθεί ακμή σε απόσταση ≤ ανοχής (ίδια στρατηγική με το `RayCrossingCounter.isOnSegment()`
 * του JTS: μόλις είναι επί του συνόρου, καμία επόμενη ακμή δεν μπορεί να αλλάξει το αποτέλεσμα).
 *
 * Πολύγωνο με < 3 κορυφές ⇒ `'exterior'` (εκφυλισμένο· ίδια σύμβαση με το `pointInPolygon`).
 */
export function locatePointInPolygon(
  point: PlanarPoint,
  vertices: readonly PlanarPoint[],
  options?: PolygonLocationOptions,
): PolygonPointLocation {
  const n = vertices.length;
  if (n < 3) return 'exterior';
  const tol = normalizeToleranceMm(options?.boundaryToleranceMm);
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];
    if (withinEdgeBbox(point, vi, vj, tol) && pointToSegmentDistance(point, vi, vj) <= tol) {
      return 'boundary';
    }
    const crosses =
      vi.y > point.y !== vj.y > point.y &&
      point.x < ((vj.x - vi.x) * (point.y - vi.y)) / (vj.y - vi.y) + vi.x;
    if (crosses) inside = !inside;
  }
  return inside ? 'interior' : 'exterior';
}

/**
 * OGC **`covers`**: το σημείο είναι εντός **ή επί** του συνόρου (εντός ανοχής).
 *
 * Αυτό θέλει κάθε ερώτημα **μέτρησης/QA** πάνω σε αποτύπωση: βολή πάνω στη γραμμή του οικοπέδου
 * **στηρίζει** το οικόπεδο. Ισοδύναμο του PostGIS `ST_CoveredBy`, που η ίδια η τεκμηρίωσή του
 * συνιστά **αντί** του `ST_Within` για ακριβώς αυτόν τον λόγο.
 */
export function pointInPolygonCovers(
  point: PlanarPoint,
  vertices: readonly PlanarPoint[],
  options?: PolygonLocationOptions,
): boolean {
  return locatePointInPolygon(point, vertices, options) !== 'exterior';
}

/**
 * OGC **`within`**: **γνήσια** εντός — σημείο επί του συνόρου (εντός ανοχής) ⇒ `false`.
 *
 * ⚠️ **ΔΕΝ** ταυτίζεται με το {@link pointInPolygon}: εκείνο δεν έχει ανοχή και για σημείο επί
 * ακμής απαντά **αυθαίρετα**. Αυτό απαντά **ντετερμινιστικά** `false`. Χρήση όταν το σύνορο
 * πρέπει να **αποκλείεται ρητά** (π.χ. «διάλεξε σημείο γνήσια στο εσωτερικό»).
 */
export function pointInPolygonWithin(
  point: PlanarPoint,
  vertices: readonly PlanarPoint[],
  options?: PolygonLocationOptions,
): boolean {
  return locatePointInPolygon(point, vertices, options) === 'interior';
}
