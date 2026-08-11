/**
 * Το **πλέγμα παραμόρφωσης** ενός πλακιδίου: πώς κάθεται μια εικόνα Web Mercator πάνω σε χαρτί
 * ΕΓΣΑ'87 **χωρίς** να υποτεθεί ότι παραμένει ορθογώνιο.
 *
 * ## Το σφάλμα που κλείνει αυτό το αρχείο
 * Ένα πλακίδιο είναι τετράγωνο **στο Web Mercator**. Στο ΕΓΣΑ'87 δεν είναι: οι δύο προβολές
 * διαφέρουν σε κλίμακα και σε διεύθυνση, οπότε το τετράγωνο γίνεται ελαφρώς **καμπύλο
 * τετράπλευρο**. Η AutoCAD — ο μόνος από τους μεγάλους που έχει καν ζωντανό υπόβαθρο — το
 * τοποθετεί ως ορθογώνιο και ζει με το υπόλοιπο σφάλμα.
 *
 * Δεν το εφευρίσκουμε αυτό: είναι ακριβώς ο μηχανισμός που το **OpenLayers** τεκμηριώνει για
 * επαναπροβολή raster — *«the target raster is divided into a limited number of triangles with
 * vertices transformed using projection capabilities»*. Εδώ εφαρμόζεται στην ίδια δουλειά.
 *
 * ## Πόσες υποδιαιρέσεις — **μετρημένα**, όχι επιλεγμένα
 * Ένας σταθερός αριθμός θα ήταν λάθος και στις δύο κατευθύνσεις: υπερβολικός σε πλακίδιο που
 * καλύπτει είκοσι εικονοστοιχεία, ανεπαρκής σε πλακίδιο που γεμίζει την οθόνη. Το
 * {@link buildTileWarpMesh} **μετρά** το σφάλμα — συγκρίνει την αληθινή θέση του κέντρου με
 * εκείνη που θα έδινε γραμμική παρεμβολή των γωνιών — και υποδιαιρεί μέχρι να πέσει κάτω από
 * ανοχή εκφρασμένη σε **εικονοστοιχεία οθόνης**. Δηλαδή το κριτήριο είναι «το βλέπει το μάτι;»,
 * που είναι το μόνο κριτήριο με νόημα εδώ.
 *
 * Καθαρό module — μηδέν καμβάς, μηδέν δίκτυο.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import { geographicToDisplayMm } from './basemap-projection';
import { tileFractionToGeographic, type TileId } from './web-mercator';

/**
 * Ανοχή σε εικονοστοιχεία οθόνης. Το μισό εικονοστοιχείο είναι το κατώφλι κάτω από το οποίο η
 * παραμόρφωση δεν μπορεί να γίνει ορατή — αυστηρότερο θα ξόδευε τρίγωνα για το τίποτα.
 *
 * ⚠️ **Εξαγόμενη επίτηδες**: είναι η **υπόσχεση** που ελέγχει η άγκυρα `Ψ6` του ζωγράφου (ADR-782
 * §27.7). Αντιγραμμένο `0.5` μέσα σε test θα ήταν **δεύτερη αυθεντία** — χαλάρωση εδώ θα άφηνε
 * την άγκυρα πράσινη πάνω σε πλέγμα που δεν εγγυάται πια τίποτα.
 */
export const WARP_TOLERANCE_PX = 0.5;

/** Το ταβάνι υποδιαίρεσης: 8×8 = 128 τρίγωνα ανά πλακίδιο, ήδη υπερβολικό για γήινες κλίμακες. */
const MAX_DIVISIONS = 8;

/** Κορυφή του πλέγματος: πού βρίσκεται στην **εικόνα** και πού πέφτει στο **χαρτί**. */
export interface WarpVertex {
  /** Οριζόντια θέση μέσα στο πλακίδιο, 0 … 1. */
  readonly u: number;
  /** Κατακόρυφη θέση μέσα στο πλακίδιο, 0 … 1 (0 = βόρειο άκρο, όπως η εικόνα). */
  readonly v: number;
  /** Η θέση της στο χαρτί, σε τοπικά mm. */
  readonly display: Point2D;
}

export interface TileWarpMesh {
  /** Πλήθος κελιών ανά πλευρά· οι κορυφές είναι `(divisions + 1)²`. */
  readonly divisions: number;
  /** Κορυφές κατά γραμμές (σειρά `v`, μετά `u`) — η σειρά είναι συμβόλαιο του ζωγράφου. */
  readonly vertices: readonly WarpVertex[];
}

/** Η θέση ενός σημείου `(u, v)` του πλακιδίου πάνω στο χαρτί, με ακριβή προβολή. */
function projectTilePoint(
  tile: TileId,
  u: number,
  v: number,
  projector: WorldToDisplayProjector | null,
): Point2D {
  const geo = tileFractionToGeographic(tile.x + u, tile.y + v, tile.z);
  return geographicToDisplayMm(geo.lat, geo.lon, projector);
}

/**
 * Πόσο αστοχεί η γραμμική παρεμβολή στο κέντρο ενός τετραπλεύρου, σε **mm χαρτιού**.
 *
 * Το κέντρο είναι το σημείο μέγιστης απόκλισης μιας διγραμμικής προσέγγισης από την πραγματική
 * καμπύλη — γι' αυτό ελέγχεται αυτό και όχι τυχαίο δείγμα.
 */
function centreDeviationMm(
  tile: TileId,
  projector: WorldToDisplayProjector | null,
  corners: readonly Point2D[],
): number {
  const exact = projectTilePoint(tile, 0.5, 0.5, projector);
  const interpolated = {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
  };
  return Math.hypot(exact.x - interpolated.x, exact.y - interpolated.y);
}

/**
 * Οι υποδιαιρέσεις που χρειάζεται αυτό το πλακίδιο σε αυτή την κλίμακα.
 *
 * Το σφάλμα μιας διγραμμικής προσέγγισης πέφτει **τετραγωνικά** με την υποδιαίρεση, οπότε ο
 * απαιτούμενος αριθμός βγαίνει κλειστά από τη μία μέτρηση — χωρίς επαναληπτικό βρόχο που θα
 * ξαναπρόβαλλε σημεία σε κάθε γύρο.
 */
function chooseDivisions(deviationMm: number, pixelsPerMm: number): number {
  const deviationPx = deviationMm * pixelsPerMm;
  if (!Number.isFinite(deviationPx) || deviationPx <= WARP_TOLERANCE_PX) return 1;
  const needed = Math.ceil(Math.sqrt(deviationPx / WARP_TOLERANCE_PX));
  return Math.min(MAX_DIVISIONS, Math.max(1, needed));
}

/**
 * Το πλέγμα παραμόρφωσης του πλακιδίου.
 *
 * `projector === null` (μη γεωαναφερμένο έργο) **δεν** συντομεύει τη διαδρομή: η καμπυλότητα
 * προέρχεται από τη διαφορά Mercator ↔ ΕΓΣΑ'87 και υπάρχει ακόμη κι όταν χαρτί και κόσμος
 * ταυτίζονται. Μια συντόμευση εκεί θα έδινε σωστό αποτέλεσμα σε γεωαναφερμένα έργα και σιωπηλά
 * λάθος σε όλα τα υπόλοιπα — δηλαδή το σφάλμα θα εμφανιζόταν μόνο εκεί που κανείς δεν το ελέγχει.
 */
export function buildTileWarpMesh(
  tile: TileId,
  projector: WorldToDisplayProjector | null,
  pixelsPerMm: number,
): TileWarpMesh {
  const corners = [
    projectTilePoint(tile, 0, 0, projector),
    projectTilePoint(tile, 1, 0, projector),
    projectTilePoint(tile, 1, 1, projector),
    projectTilePoint(tile, 0, 1, projector),
  ];
  const divisions = chooseDivisions(centreDeviationMm(tile, projector, corners), pixelsPerMm);

  const vertices: WarpVertex[] = [];
  for (let row = 0; row <= divisions; row += 1) {
    const v = row / divisions;
    for (let col = 0; col <= divisions; col += 1) {
      const u = col / divisions;
      vertices.push({ u, v, display: projectTilePoint(tile, u, v, projector) });
    }
  }
  return { divisions, vertices };
}

/** Η κορυφή στη θέση `(row, col)` του πλέγματος. */
export function meshVertex(mesh: TileWarpMesh, row: number, col: number): WarpVertex {
  return mesh.vertices[row * (mesh.divisions + 1) + col];
}
