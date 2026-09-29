/**
 * @fileoverview **ΠΟΙΑ PIXEL ΑΝΗΚΟΥΝ ΣΤΟΝ ΧΩΡΟ ΟΠΟΥ ΠΑΤΗΣΕΣ** — σφράγισμα πορτών, ετικέτες χώρων, ανταγωνιστική
 * αναγέννηση (ADR-884 §4.14 Γ3). Καθαρό.
 * @module lib/spatial-tour/space-detect/space-region
 *
 * 🏆 **Όπως η ρομποτική χαρτογράφηση** (ROS `ipa_room_segmentation`, «morphological segmentation»):
 * 1. **Πυρήνες**: ο ελεύθερος χώρος **διαβρώνεται** κατά ακτίνα = μισό άνοιγμα πόρτας (ισοδύναμα: οι τοίχοι
 *    διαστέλλονται) ⇒ κάθε άνοιγμα στενότερο από την πόρτα **εξαφανίζεται** και οι χώροι αποσυνδέονται.
 * 2. **Ετικέτα** κάθε πυρήνα (όλοι οι χώροι, όχι μόνο ο δικός μας).
 * 3. **Ανταγωνιστική αναγέννηση**: όλοι οι πυρήνες μεγαλώνουν **ταυτόχρονα** (BFS) πίσω στον **αρχικό** ελεύθερο χώρο.
 *    Γωνίες και παρειές επανέρχονται (εκεί δεν φτάνει κανείς άλλος)· στην πόρτα τα δύο μέτωπα **συναντιούνται στη μέση**
 *    της ⇒ το όριο είναι ευθεία μέσα στο άνοιγμα. Μια σκέτη διαστολή θα περνούσε την πόρτα και θα έτρωγε τον διπλανό.
 *
 * 🔴 **ΜΗΝ το γυρίσεις σε «κλείσιμο (closing) των τοίχων»** (ήταν το αρχικό σχέδιο — ΜΕΤΡΗΘΗΚΕ λάθος, 2026-09-28):
 * το κλείσιμο σφραγίζει άνοιγμα `g` σε τοίχο πάχους `T` μόνο όταν `g ≤ 2·√(r·T − T²/4)`. Τοίχος 20 cm, `r` = 45 cm ⇒
 * σφραγίζονται ανοίγματα ως **0,57 m**, όχι 0,9 m· σε σκέτη γραμμή (T → 0) **κανένα**. Η διάβρωση του ελεύθερου
 * χώρου δεν εξαρτάται από το πάχος του τοίχου.
 */

import { forEachNeighbour, labelComponents, NEIGHBOURS_4 } from '@/lib/geometry/raster/flood-fill';
import { dilate } from '@/lib/geometry/raster/morphology';

/**
 * Βάθος αναγέννησης (βήματα 4-γειτονιάς) σε πολλαπλάσια της ακτίνας: η πιο μακρινή περιοχή που έσβησε η διάβρωση
 * είναι η γωνία ενός δωματίου, σε ευκλείδεια απόσταση `r·√2` από τον πυρήνα ⇒ ως `2r` βήματα «Manhattan».
 */
const REGROW_DEPTH_FACTOR = 2;

export interface SpaceRegion {
  /** `1` = pixel του χώρου. */
  readonly region: Uint8Array;
  /** Pixel εκκίνησης (ίσως μετατοπισμένο από το κλικ, αν εκείνο έπεσε σε γραμμή). */
  readonly seedIndex: number;
}

/**
 * Το πλησιέστερο **ελεύθερο** pixel στο `seedIndex` μέσα σε ακτίνα `maxPx` — ή `null`. Ένα κλικ πάνω στο όνομα του
 * χώρου ή σε γραμμή επίπλου δεν πρέπει να αποτυγχάνει.
 */
function nearestFree(
  free: Uint8Array, cols: number, rows: number, seedIndex: number, maxPx: number,
): number | null {
  if (free[seedIndex] === 1) return seedIndex;
  const sc = seedIndex % cols, sr = (seedIndex - sc) / cols;
  const reach = Math.ceil(maxPx);
  let best: number | null = null;
  let bestD2 = maxPx * maxPx;
  for (let r = Math.max(0, sr - reach); r <= Math.min(rows - 1, sr + reach); r++) {
    for (let c = Math.max(0, sc - reach); c <= Math.min(cols - 1, sc + reach); c++) {
      const d2 = (c - sc) ** 2 + (r - sr) ** 2;
      if (free[r * cols + c] === 1 && d2 <= bestD2) { bestD2 = d2; best = r * cols + c; }
    }
  }
  return best;
}

/**
 * Ταυτόχρονη BFS (4-γειτονιά) όλων των ετικετών μέσα στο `free`, ως βάθος `maxDepth`. Κάθε pixel παίρνει την ετικέτα
 * που το έφτασε **πρώτη** (ισοβαθμία: όποια βγήκε πρώτη από την ουρά — ντετερμινιστικό).
 */
function regrowCompetitive(
  labels: Int32Array, free: Uint8Array, cols: number, rows: number, maxDepth: number,
): Int32Array {
  const grown = Int32Array.from(labels);
  const depth = new Int32Array(labels.length);
  const queue = new Int32Array(labels.length);
  let head = 0, tail = 0;
  for (let i = 0; i < labels.length; i++) if (labels[i] !== 0) queue[tail++] = i;
  while (head < tail) {
    const i = queue[head++];
    if (depth[i] >= maxDepth) continue;
    forEachNeighbour(i, cols, rows, NEIGHBOURS_4, (n) => {
      if (free[n] !== 1 || grown[n] !== 0) return;
      grown[n] = grown[i];
      depth[n] = depth[i] + 1;
      queue[tail++] = n;
    });
  }
  return grown;
}

/**
 * Ο πρώτος πυρήνας που φτάνεται **περπατώντας** από το `start` μέσα στον ελεύθερο χώρο (BFS, 4-γειτονιά, ως
 * `maxSteps`). Όχι «πλησιέστερος σε ευθεία»: κλικ δίπλα σε λεπτό τοίχο θα διάλεγε τον πυρήνα του διπλανού δωματίου.
 */
function nearestReachable(
  free: Uint8Array, targets: Uint8Array, cols: number, rows: number, start: number, maxSteps: number,
): number | null {
  const depth = new Int32Array(free.length).fill(-1);
  const queue = [start];
  depth[start] = 0;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    if (targets[i] === 1) return i;
    if (depth[i] >= maxSteps) continue;
    forEachNeighbour(i, cols, rows, NEIGHBOURS_4, (n) => {
      if (free[n] === 1 && depth[n] < 0) { depth[n] = depth[i] + 1; queue.push(n); }
    });
  }
  return null;
}

/** `1` όπου το `mask` είναι `0`. */
export function complement(mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] === 1 ? 0 : 1;
  return out;
}

/**
 * Ο χώρος γύρω από το `seedIndex`: πυρήνες (διάβρωση κατά `doorRadiusPx`) ⇒ ετικέτες ⇒ ανταγωνιστική αναγέννηση.
 * Ο πυρήνας απέχει `doorRadiusPx` από κάθε τοίχο, άρα αναζητείται **περπατώντας** ως `2 × (ακτίνα + αναζήτηση)`.
 * `'on-wall'` = κανένα ελεύθερο pixel κοντά στο κλικ · `'no-core'` = ο χώρος είναι **στενότερος από την πόρτα**
 * (ντουλάπι, στενός διάδρομος) — ο καλών ξαναδοκιμάζει με μικρότερη ακτίνα.
 */
export function segmentSpace(
  walls: Uint8Array, cols: number, rows: number,
  seedIndex: number, doorRadiusPx: number, seedSearchPx: number,
): SpaceRegion | 'on-wall' | 'no-core' {
  const free = complement(walls);
  const start = nearestFree(free, cols, rows, seedIndex, seedSearchPx);
  if (start === null) return 'on-wall';
  const cores = complement(dilate(walls, cols, rows, doorRadiusPx));
  const seed = nearestReachable(free, cores, cols, rows, start, Math.ceil(2 * (doorRadiusPx + seedSearchPx)));
  if (seed === null) return 'no-core';
  const { labels } = labelComponents(cores, cols, rows, 4);
  const maxDepth = Math.ceil(doorRadiusPx * REGROW_DEPTH_FACTOR) + 2;
  const grown = regrowCompetitive(labels, free, cols, rows, maxDepth);
  const own = labels[seed];
  const region = new Uint8Array(grown.length);
  for (let i = 0; i < grown.length; i++) region[i] = grown[i] === own ? 1 : 0;
  return { region, seedIndex: seed };
}
