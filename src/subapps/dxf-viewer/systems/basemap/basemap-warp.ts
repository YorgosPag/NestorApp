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

/**
 * Η **ετυμηγορία** του πλέγματος: τα κατάφερε, και με πόσο υπόλοιπο.
 *
 * ## 🔴 Γιατί υπάρχει (ADR-782 §27.9) — CHECK 3.45 αυτούσιο
 * Το {@link chooseDivisions} κάνει `Math.min(MAX_DIVISIONS, needed)`. Όταν το `needed` ξεπερνά το
 * ταβάνι, η υπόσχεση «κάτω από {@link WARP_TOLERANCE_PX}» **αθετείται** — και η συνάρτηση
 * **επιστρέφει πλέγμα**, δηλαδή *απαντά και κανείς δεν ρωτά αν πέτυχε*. Είναι το ίδιο σχήμα με
 * την `adaptColorToBackground` που γέννησε το CHECK 3.45: `if (contrast < min) return target;`.
 *
 * Μετρημένο ζωντανά: σε οθόνη **4K** με πλήρες zoom-out ο προϋπολογισμός πλακιδίων κατεβάζει το
 * επίπεδο, **16 από τα 234** πλακίδια αθετούν, και η **ίδια όψη σε 1200×800 δεν αθετεί κανένα**.
 * Δηλαδή η βλάβη εξαρτάται από το μέγεθος της οθόνης και **καμία** άγκυρα δεν την έβλεπε.
 */
export interface TileWarpVerdict {
  /** Πλήθος κελιών ανά πλευρά που επιλέχθηκε — `MAX_DIVISIONS` σημαίνει «κόλλησε στο ταβάνι». */
  readonly divisions: number;
  /**
   * Το **μετρημένο** υπόλοιπο σφάλμα του **χειρότερου** κελιού, σε εικονοστοιχεία οθόνης.
   *
   * ⚠️ **Μετρημένο, ΟΧΙ εκτιμημένο από τον κλειστό τύπο** της {@link chooseDivisions}. Εκείνος
   * υποθέτει τετραγωνική πτώση· η υπόθεση **καταρρέει** ακριβώς εκεί που μας ενδιαφέρει, και
   * μετρήθηκε πόσο: σε πλακίδιο επιπέδου 1 ο τύπος λέει **9,3 px** ενώ το πραγματικό κελί δίνει
   * **541 px** — υποεκτίμηση **58×**. Μια ετυμηγορία χτισμένη στον τύπο θα έλεγε «σχεδόν εντάξει»
   * για πλακίδιο που είναι αγνώριστο.
   */
  readonly residualPx: number;
  /** `false` = η υπόσχεση αθετήθηκε· το πλακίδιο **δεν** μπορεί να αποδοθεί πιστά σε αυτή την όψη. */
  readonly withinTolerance: boolean;
}

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
 * Η **μία** διαδρομή «γωνίες → απόκλιση → υποδιαίρεση», με την απόκλιση **διατηρημένη**.
 *
 * Την καλούν και το {@link buildTileWarpMesh} (που χτίζει) και το {@link assessTileWarp} (που
 * κρίνει). Όσο ήταν ξεδιπλωμένη στο πρώτο, το δεύτερο θα την ξανάγραφε.
 *
 * ⚠️ Επιστρέφει **και** την απόκλιση, όχι μόνο τις υποδιαιρέσεις: όταν `divisions === 1` εκείνη
 * **είναι** το τελικό υπόλοιπο (δες {@link assessTileWarp}), και το να την πετάξουμε θα σήμαινε
 * να ξαναπροβάλουμε τα ίδια πέντε σημεία — διπλάσιο κόστος στο **κοινό** μονοπάτι.
 */
function measureTile(
  tile: TileId,
  projector: WorldToDisplayProjector | null,
  pixelsPerMm: number,
): {
  readonly divisions: number;
  readonly deviationMm: number;
  /** `true` όταν το πλακίδιο ζήτησε **περισσότερες** υποδιαιρέσεις απ' όσες επιτρέπει το ταβάνι. */
  readonly exceedsCeiling: boolean;
} {
  const corners = [
    projectTilePoint(tile, 0, 0, projector),
    projectTilePoint(tile, 1, 0, projector),
    projectTilePoint(tile, 1, 1, projector),
    projectTilePoint(tile, 0, 1, projector),
  ];
  const deviationMm = centreDeviationMm(tile, projector, corners);
  const deviationPx = deviationMm * pixelsPerMm;
  const needed =
    !Number.isFinite(deviationPx) || deviationPx <= WARP_TOLERANCE_PX
      ? 1
      : Math.ceil(Math.sqrt(deviationPx / WARP_TOLERANCE_PX));
  return {
    divisions: chooseDivisions(deviationMm, pixelsPerMm),
    deviationMm,
    exceedsCeiling: !Number.isFinite(deviationPx) || needed > MAX_DIVISIONS,
  };
}

/**
 * Το **χειρότερο** υπόλοιπο σφάλμα ανάμεσα σε **όλα** τα κελιά, σε εικονοστοιχεία.
 *
 * ## 🔴 Γιατί ΟΛΑ και όχι ένα δείγμα — μετρημένο, και η διαφορά είναι πέντε τάξεις μεγέθους
 * Η πρώτη γραφή ρωτούσε **ένα** κελί (πρώτα το ΒΔ, μετά το κεντρικό). Και τα δύο είναι
 * **αυθαίρετα δείγματα**, και μετρήθηκε πόσο: στο ΒΑ τεταρτημόριο του επιπέδου 1, το ΒΔ κελί
 * δίνει **0,0016 px** ενώ το χειρότερο κελί του **ίδιου** πλακιδίου δίνει **1.262 px** — λόγος
 * **791.000×**. Το κεντρικό κελί δίνει **0,26 px**, δηλαδή **κάτω** από την ανοχή: ένας κριτής
 * χτισμένος πάνω του θα **ενέκρινε** το χειρότερο πλακίδιο ολόκληρου του πλανήτη, και η άγκυρα
 * θα το επιβεβαίωνε.
 *
 * *Ένα δείγμα που το διαλέγει ο συγγραφέας δεν είναι μέτρηση — είναι επιβεβαίωση* (§27.7).
 *
 * ## Το κόστος είναι μοιρασμένο, όχι πολλαπλασιασμένο
 * Οι κορυφές ανήκουν σε **τέσσερα** γειτονικά κελιά, οπότε υπολογίζονται μία φορά: `(d+1)² + d²`
 * προβολές αντί για `5d²` — για `d = 8`, **145 αντί για 320**. Και για `d = 1`, που είναι **κάθε
 * ρεαλιστική κλίμακα** (μετρημένο: από επίπεδο 6 και πάνω το πλέγμα δεν υποδιαιρεί ποτέ), το
 * κόστος είναι **5 προβολές** — δηλαδή ακριβώς όσο θα κόστιζε το μονό δείγμα.
 */
function worstCellResidualPx(
  tile: TileId,
  projector: WorldToDisplayProjector | null,
  divisions: number,
  pixelsPerMm: number,
): number {
  const step = 1 / divisions;
  const span = divisions + 1;
  const grid: Point2D[] = [];
  for (let row = 0; row < span; row += 1) {
    for (let col = 0; col < span; col += 1) {
      grid.push(projectTilePoint(tile, col * step, row * step, projector));
    }
  }

  let worst = 0;
  for (let row = 0; row < divisions; row += 1) {
    for (let col = 0; col < divisions; col += 1) {
      const nw = grid[row * span + col];
      const ne = grid[row * span + col + 1];
      const sw = grid[(row + 1) * span + col];
      const se = grid[(row + 1) * span + col + 1];
      const exact = projectTilePoint(tile, (col + 0.5) * step, (row + 0.5) * step, projector);
      const residual = Math.hypot(
        exact.x - (nw.x + ne.x + se.x + sw.x) / 4,
        exact.y - (nw.y + ne.y + se.y + sw.y) / 4,
      ) * pixelsPerMm;
      // ⚠️ `Math.max` και **όχι** `if (residual > worst)`: το `NaN > x` είναι `false`, οπότε ένα
      // κελί που δεν παράγει αριθμό θα **προσπερνιόταν σιωπηλά** και το πλακίδιο θα έβγαινε
      // «εντός ανοχής» επειδή κανείς δεν μέτρησε — fail-open με τη μορφή σύγκρισης. Το
      // `Math.max(x, NaN)` είναι `NaN`, και `NaN <= ανοχή` είναι `false`: fail-closed **δωρεάν**.
      //
      // 🔶 **Δηλωμένο**: σήμερα καμία είσοδος δεν το πυροδοτεί (το Web Mercator κόβει στις
      // ±85,05°, όπου η Εγκάρσια Mercator παραμένει πεπερασμένη), άρα ένας *ξεχωριστός* φρουρός
      // εδώ θα ήταν αναπόδεικτος (ADR-749 §5). Αυτό δεν είναι φρουρός — είναι η φυσική γραφή του
      // μεγίστου, που τυχαίνει να μην έχει την τρύπα της σύγκρισης.
      worst = Math.max(worst, residual);
    }
  }
  return worst;
}

/**
 * «Μπορεί το πλέγμα να αποδώσει **αυτό** το πλακίδιο σε **αυτή** την όψη, εντός ανοχής;»
 *
 * Καθαρή συνάρτηση, **~10 προβολές** — δεν χτίζει κορυφές. Γι' αυτό μπορεί να ρωτηθεί για κάθε
 * υποψήφιο πλακίδιο **πριν** το δίκτυο: πλακίδιο που δεν πρόκειται να ζωγραφιστεί δεν κατεβαίνει.
 *
 * ⚠️ Το «πόσες υποδιαιρέσεις» το απαντά η **ίδια** {@link divisionsFor} που καλεί και το
 * {@link buildTileWarpMesh} — ένα ερώτημα, μία απάντηση. Δεύτερη γραφή του κριτηρίου στον
 * επιλογέα πλακιδίων θα ήταν δύο αλήθειες που αποκλίνουν στην πρώτη αλλαγή ανοχής (ADR-749).
 */
export function assessTileWarp(
  tile: TileId,
  projector: WorldToDisplayProjector | null,
  pixelsPerMm: number,
): TileWarpVerdict {
  const { divisions, deviationMm, exceedsCeiling } = measureTile(tile, projector, pixelsPerMm);

  // 🔑 **Δύο συντομεύσεις, καμία απώλεια ακρίβειας** — και οι δύο βγήκαν από μέτρηση κόστους.
  //
  // (α) Με **μία** υποδιαίρεση το «κελί» είναι ολόκληρο το πλακίδιο και το κέντρο του κελιού
  //     είναι το κέντρο του πλακιδίου: η απόκλιση που μόλις μετρήθηκε **είναι** το υπόλοιπο.
  //     Κοινό μονοπάτι (από επίπεδο 6 και πάνω το πλέγμα δεν υποδιαιρεί ποτέ) ⇒ 5 προβολές.
  //
  // (β) Όταν το πλακίδιο ζητά **περισσότερες** υποδιαιρέσεις απ' όσες υπάρχουν, η υπόσχεση είναι
  //     ήδη αθετημένη και **καμία μέτρηση δεν μπορεί να το ανατρέψει**: ο κλειστός τύπος
  //     *υποεκτιμά* (μετρημένο 58×), οπότε αν ακόμη κι αυτός δηλώνει αδυναμία, η πραγματικότητα
  //     είναι χειρότερη. Fail-closed με μηδέν επιπλέον προβολές — και είναι ακριβώς η περίπτωση
  //     του πλήρους zoom-out, όπου αλλιώς θα σαρώναμε 64 κελιά για να μάθουμε το ήδη γνωστό.
  if (exceedsCeiling) {
    return { divisions, residualPx: Number.POSITIVE_INFINITY, withinTolerance: false };
  }
  const residualPx =
    divisions === 1
      ? deviationMm * pixelsPerMm
      : worstCellResidualPx(tile, projector, divisions, pixelsPerMm);
  // ⚠️ Καμία επιπλέον `Number.isFinite` εδώ, **επίτηδες**: το `NaN` είναι ήδη **αδύνατο** —
  // στον πρώτο κλάδο θα είχε κάνει το `exceedsCeiling` αληθές, στον δεύτερο το
  // `worstCellResidualPx` το μετατρέπει ρητά σε `Infinity`. Και το `Infinity <= ανοχή` είναι
  // `false` από τη φύση της σύγκρισης. Ένας τρίτος έλεγχος θα ήταν φρουρός που **δεν μπορεί να
  // πυροδοτήσει** — και τα φαντάσματα δεν φυλάνε τίποτα (ADR-749 §5).
  return { divisions, residualPx, withinTolerance: residualPx <= WARP_TOLERANCE_PX };
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
  const { divisions } = measureTile(tile, projector, pixelsPerMm);

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
