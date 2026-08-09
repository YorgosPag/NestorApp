/**
 * «Τι βλέπω, άρα τι ζητάω» — η καθαρή απόφαση πλακιδίων. Μηδέν δίκτυο, μηδέν καμβάς.
 *
 * Δύο ερωτήματα, σκόπιμα χωρισμένα:
 *   1. **Ποιο επίπεδο λεπτομέρειας;** ({@link chooseZoomLevel}) — απαντιέται από την κλίμακα.
 *   2. **Ποια πλακίδια εκείνου του επιπέδου;** ({@link tilesForDisplayRect}) — από το ορατό.
 *
 * ## 🚦 Το ταβάνι πλήθους δεν είναι βελτιστοποίηση — είναι συμμόρφωση
 * Ο χρήστης μπορεί να κάνει zoom-out σε άδειο σχέδιο και να δει μισή Ελλάδα. Στο επίπεδο που
 * θα ζητούσε η κλίμακα, αυτό είναι **δεκάδες χιλιάδες** πλακίδια σε ένα καρέ — δηλαδή πλημμύρα
 * αιτημάτων προς εθελοντική υποδομή, ακριβώς η συμπεριφορά που η πολιτική του OSMF τιμωρεί με
 * αποκλεισμό *«without notice»*. Το {@link MAX_TILES_PER_FRAME} κατεβάζει το επίπεδο μέχρι να
 * χωρέσει: ο χρήστης βλέπει πιο χοντρό χάρτη αντί για **κανέναν** χάρτη και μια μπλοκαρισμένη
 * διεύθυνση.
 *
 * ⚠️ Η μείωση γίνεται στο **επίπεδο**, ποτέ με κόψιμο της λίστας. Ένα `slice(0, N)` θα άφηνε
 * τρύπες στο υπόβαθρο — μισός χάρτης ζωγραφισμένος, μισός λευκός, χωρίς κανένα σημάδι ότι κάτι
 * παραλείφθηκε. Χάρτης με τρύπες διαβάζεται ως «δεν υπάρχουν εκεί δεδομένα», που είναι ψέμα.
 */

import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import { unprojectRectToWorld } from '../topography/topo-display-frame';
import type { WorldRectMm } from '../topography/topo-grid-model';
import { worldMmToGeographic } from './basemap-projection';
import {
  geographicToTileFraction,
  groundResolutionM,
  isTileInWorld,
  tilesPerAxis,
  type TileId,
} from './web-mercator';
import type { BasemapSource } from './basemap-source';

/**
 * Ανώτατο πλήθος πλακιδίων ανά καρέ. Στα 256 px το πλακίδιο, **256** πλακίδια καλύπτουν οθόνη
 * 4096×4096 — δηλαδή με άνεση κάθε ρεαλιστικό παράθυρο, ακόμη και σε οθόνη υψηλής πυκνότητας.
 */
export const MAX_TILES_PER_FRAME = 256;

/** Το επίπεδο κάτω από το οποίο δεν έχει νόημα να κατέβουμε (όλος ο κόσμος σε ένα πλακίδιο). */
const MIN_ZOOM = 0;

export interface ZoomChoiceInput {
  /** Κλίμακα προβολής: εικονοστοιχεία CSS ανά mm σκηνής (το `scale` του `ViewTransform`). */
  readonly pixelsPerMm: number;
  /** Λόγος πυκνότητας οθόνης — ο καμβάς έχει backing store σε φυσικά εικονοστοιχεία. */
  readonly devicePixelRatio: number;
  /** Γεωγραφικό πλάτος του κέντρου του ορατού (η παραμόρφωση Mercator εξαρτάται από αυτό). */
  readonly latitude: number;
  readonly source: BasemapSource;
}

/**
 * Το επίπεδο του οποίου η ανάλυση εδάφους ταιριάζει καλύτερα με την τρέχουσα κλίμακα.
 *
 * Στρογγυλοποιεί **προς τα πάνω** (`ceil`): προτιμάται πλακίδιο ελαφρώς πιο λεπτομερές από
 * ό,τι χρειάζεται η οθόνη, γιατί η σμίκρυνσή του δίνει καθαρή εικόνα ενώ η μεγέθυνση ενός πιο
 * χοντρού δίνει θολή. Ίδια σύμβαση με κάθε μηχανή χαρτών.
 */
export function chooseZoomLevel(input: ZoomChoiceInput): number {
  const { pixelsPerMm, devicePixelRatio, latitude, source } = input;
  if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) return MIN_ZOOM;
  // mm ανά φυσικό εικονοστοιχείο → μέτρα ανά φυσικό εικονοστοιχείο.
  const metresPerPixel = 1 / (pixelsPerMm * devicePixelRatio) / 1000;
  if (!Number.isFinite(metresPerPixel) || metresPerPixel <= 0) return source.maxZoom;
  // Λύση του groundResolutionM(...) === metresPerPixel ως προς z.
  const resolutionAtZoomZero = groundResolutionM(latitude, 0, source.tileSizePx);
  const exact = Math.log2(resolutionAtZoomZero / metresPerPixel);
  return clampZoom(Math.ceil(exact), source);
}

/** Περιορισμός στο εύρος που όντως σερβίρει ο πάροχος. */
function clampZoom(z: number, source: BasemapSource): number {
  if (!Number.isFinite(z)) return MIN_ZOOM;
  return Math.max(MIN_ZOOM, Math.min(source.maxZoom, Math.trunc(z)));
}

/** Ορθογώνιο στο πλέγμα πλακιδίων ενός επιπέδου (ακέραιο, κλειστό διάστημα). */
interface TileRange {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Πόσα πλακίδια περιέχει ένα εύρος. */
function tileCount(range: TileRange): number {
  return (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);
}

/**
 * Το εύρος πλακιδίων που καλύπτει ένα **world** ορθογώνιο (ΕΓΣΑ mm) στο επίπεδο `z`.
 *
 * Το ορθογώνιο μετατρέπεται σε γεωγραφικές από τις **τέσσερις** γωνίες του, όχι από δύο: σε
 * γεωαναφορά με στροφή το world AABB δεν είναι ευθυγραμμισμένο με τους μεσημβρινούς, οπότε δύο
 * αντιδιαμετρικές γωνίες θα άφηναν λωρίδα του ορατού χωρίς πλακίδια.
 */
function tileRangeForWorldRect(rect: WorldRectMm, z: number): TileRange {
  const corners = [
    worldMmToGeographic(rect.minX, rect.minY),
    worldMmToGeographic(rect.maxX, rect.minY),
    worldMmToGeographic(rect.minX, rect.maxY),
    worldMmToGeographic(rect.maxX, rect.maxY),
  ];
  const fractions = corners.map((c) => geographicToTileFraction(c.lat, c.lon, z));
  const n = tilesPerAxis(z);
  const txs = fractions.map((f) => f.tx);
  const tys = fractions.map((f) => f.ty);
  return {
    minX: Math.max(0, Math.floor(Math.min(...txs))),
    maxX: Math.min(n - 1, Math.floor(Math.max(...txs))),
    minY: Math.max(0, Math.floor(Math.min(...tys))),
    maxY: Math.min(n - 1, Math.floor(Math.max(...tys))),
  };
}

export interface TileSelection {
  /** Το επίπεδο που τελικά χρησιμοποιήθηκε — **μπορεί** να είναι χαμηλότερο από το ζητούμενο. */
  readonly zoom: number;
  readonly tiles: readonly TileId[];
  /** `true` όταν το επίπεδο κατέβηκε για να τηρηθεί το {@link MAX_TILES_PER_FRAME}. */
  readonly reducedForBudget: boolean;
}

/**
 * Τα πλακίδια που χρειάζεται το ορατό **display** ορθογώνιο (τοπικά mm του σχεδίου).
 *
 * Ξεκινά από το `preferredZoom` και **κατεβαίνει** όσο χρειάζεται ώστε το πλήθος να χωρά στο
 * ταβάνι· κάθε βήμα προς τα κάτω τετραπλασιάζει την κάλυψη ανά πλακίδιο, οπότε η σύγκλιση είναι
 * ταχύτατη. Επιστρέφει **κενή** λίστα όταν το ορατό δεν τέμνει τον κόσμο.
 */
export function tilesForDisplayRect(
  displayRect: WorldRectMm,
  preferredZoom: number,
  projector: WorldToDisplayProjector | null,
): TileSelection {
  const worldRect = unprojectRectToWorld(displayRect, projector);
  let zoom = Math.max(MIN_ZOOM, preferredZoom);
  let range = tileRangeForWorldRect(worldRect, zoom);
  let reduced = false;

  while (zoom > MIN_ZOOM && tileCount(range) > MAX_TILES_PER_FRAME) {
    zoom -= 1;
    range = tileRangeForWorldRect(worldRect, zoom);
    reduced = true;
  }

  const tiles: TileId[] = [];
  for (let y = range.minY; y <= range.maxY; y += 1) {
    for (let x = range.minX; x <= range.maxX; x += 1) {
      const tile: TileId = { z: zoom, x, y };
      if (isTileInWorld(tile)) tiles.push(tile);
    }
  }
  return { zoom, tiles, reducedForBudget: reduced };
}
