/**
 * ADR-736 — `IMAGE` → το **υπάρχον** `ImageEntity` (ADR-651 Φάση Ε).
 *
 * 🔴 **Δεν δημιουργείται νέος τύπος οντότητας.** Το `'image'` είναι ήδη πλήρες πολίτης:
 * `RENDERABLE_ENTITY_TYPES`, `ImageRenderer`, λαβές (`image-grips`), hit-test, `scaleEntity`,
 * και **εξαγωγή** ως native `IMAGE`/`IMAGEDEF` (ADR-643 Φ5b / ADR-651). Έλειπε **μόνο** η
 * εισαγωγή — δηλαδή αυτό το αρχείο κλείνει τον κύκλο: ό,τι εξάγει ο ΝΕΣΤΩΡ, τώρα το ξαναδιαβάζει.
 * Συνέπεια: **κανένα capability anchor δεν κουνιέται** (CHECK 5C ήσυχο).
 *
 * **Η γεωμετρία ενός DXF `IMAGE` δεν έχει «πλάτος» ούτε «γωνία».** Έχει δύο **διανύσματα
 * pixel** — και όλα παράγονται από αυτά:
 *
 *   codes 10/20  → `position`  : κάτω-αριστερή γωνία (WCS)   ← ίδια σύμβαση με το `ImageEntity`
 *   codes 11/21  → `u`         : το διάνυσμα ΕΝΟΣ pixel κατά U
 *   codes 12/22  → `v`         : το διάνυσμα ΕΝΟΣ pixel κατά V
 *   codes 13/23  → μέγεθος σε pixels (U, V)
 *
 *       width    = |u| × pixelsU
 *       height   = |v| × pixelsV
 *       rotation = atan2(u.y, u.x)
 *
 * Δηλαδή η περιστροφή είναι η **κατεύθυνση** του u-διανύσματος και η κλίμακα το **μήκος** του.
 * Δεν υπάρχει group γωνίας· όποιος ψάξει για «code 50» δεν θα βρει τίποτα και θα συμπεράνει
 * λανθασμένα ότι οι εικόνες δεν περιστρέφονται.
 *
 * ⚠️ **Το `url` γεννιέται ΚΕΝΟ.** Το DXF κρατά διαδρομή, όχι περιεχόμενο· το πραγματικό αρχείο
 * (αν υπάρχει) το βρίσκει ο client resolver αργότερα. Το `externalRefId` (group **340**) είναι ο
 * σύνδεσμος προς τη `DxfExternalReference` που κρατά τη διαδρομή. Ο `ImageRenderer` ζωγραφίζει
 * πλαίσιο-κράτημα όσο το `url` λείπει — ώστε ο χρήστης να βλέπει **πού** ανήκει το υπόβαθρο.
 *
 * @see utils/dxf-external-reference-reader.ts — από πού έρχεται το `IMAGEDEF` (η διαδρομή)
 * @see types/image.ts — το `ImageEntity` (position = κάτω-αριστερά, y-up)
 */

import type { AnySceneEntity } from '../types/scene';
import { dwarn } from '../debug';

/** Ελάχιστο μήκος διανύσματος pixel για να θεωρηθεί έγκυρο (κάτω από αυτό → εκφυλισμένη εικόνα). */
const MIN_PIXEL_VECTOR_LENGTH = 1e-12;

/**
 * Μετατρέπει `IMAGE` → `ImageEntity`, ή `null` όταν η γεωμετρία είναι αδιάβαστη.
 *
 * Επιστρέφει `null` **μόνο** για πραγματικά χαλασμένη γεωμετρία (NaN θέση, μηδενικά διανύσματα
 * pixel) — ποτέ επειδή λείπει το αρχείο. Το «λείπει το αρχείο» είναι **φυσιολογική κατάσταση**
 * και ταξιδεύει στην αναφορά, όχι σε αποτυχία μετατροπής.
 */
export function convertImage(
  data: Record<string, string>,
  layer: string,
  index: number,
): AnySceneEntity | null {
  const x = parseFloat(data['10']);
  const y = parseFloat(data['20']);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    dwarn('EntityConverter', `⚠️ Skipping IMAGE ${index}: invalid insertion point`, { x, y });
    return null;
  }

  const u = readVector(data, '11', '21');
  const v = readVector(data, '12', '22');
  const pixelsU = parseFloat(data['13']);
  const pixelsV = parseFloat(data['23']);

  const size = resolveSize(u, v, pixelsU, pixelsV);
  if (!size) {
    dwarn('EntityConverter', `⚠️ Skipping IMAGE ${index}: degenerate pixel vectors`, { u, v });
    return null;
  }

  const imageDefHandle = data['340'];
  return {
    id: `image_${index}`,
    type: 'image',
    layerId: layer,
    visible: true,
    position: { x, y },
    width: size.width,
    height: size.height,
    // Ο ΝΕΣΤΩΡ ξέρει το εγγενές μέγεθος από το ίδιο το σχέδιο ⇒ το «Επαναφορά Διαστάσεων»
    // (ADR-654) δουλεύει σε εισαγόμενη εικόνα χωρίς να χρειαστεί να φορτωθεί το raster.
    intrinsicWidth: size.width,
    intrinsicHeight: size.height,
    // 🔴 ΚΕΝΟ σκοπίμως: το DXF κρατά διαδρομή, όχι bytes. Το γεμίζει ο resolver.
    url: '',
    ...(size.rotation !== 0 ? { rotation: size.rotation } : {}),
    ...(imageDefHandle ? { externalRefId: imageDefHandle } : {}),
  };
}

/** Ένα διάνυσμα από δύο κωδικούς· μη αναγνώσιμο → `null` (ο καλών αποφασίζει τι σημαίνει). */
function readVector(
  data: Record<string, string>,
  xCode: string,
  yCode: string,
): { x: number; y: number } | null {
  const x = parseFloat(data[xCode]);
  const y = parseFloat(data[yCode]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * Πλάτος/ύψος/γωνία από τα διανύσματα pixel και το μέγεθος σε pixels.
 *
 * ⚠️ **Fallback όταν λείπουν τα διανύσματα:** παλιότερα/μερικώς γραμμένα αρχεία μπορεί να μην
 * έχουν 11/21. Τότε πέφτουμε σε **1 μονάδα ανά pixel χωρίς περιστροφή**, που είναι λάθος κλίμακα
 * αλλά **ορατή** εικόνα στη σωστή θέση — προτιμότερο από σιωπηλή απόρριψη. Πλήρης έλλειψη και
 * διανυσμάτων και μεγέθους σε pixels είναι πραγματικά αδιάβαστη ⇒ `null`.
 */
function resolveSize(
  u: { x: number; y: number } | null,
  v: { x: number; y: number } | null,
  pixelsU: number,
  pixelsV: number,
): { width: number; height: number; rotation: number } | null {
  if (!Number.isFinite(pixelsU) || !Number.isFinite(pixelsV) || pixelsU <= 0 || pixelsV <= 0) {
    return null;
  }
  const uLen = u ? Math.hypot(u.x, u.y) : 1;
  const vLen = v ? Math.hypot(v.x, v.y) : 1;
  if (uLen < MIN_PIXEL_VECTOR_LENGTH || vLen < MIN_PIXEL_VECTOR_LENGTH) return null;

  // Η γωνία είναι η κατεύθυνση του u — ΟΧΙ κάποιο group 50 (δεν υπάρχει τέτοιο στο IMAGE).
  const rotationDeg = u ? (Math.atan2(u.y, u.x) * 180) / Math.PI : 0;
  return {
    width: uLen * pixelsU,
    height: vLen * pixelsV,
    // Καθαρό 0 αντί για -0 / 1e-15, ώστε το entity να μη φέρει άχρηστο `rotation`.
    rotation: Math.abs(rotationDeg) < 1e-9 ? 0 : rotationDeg,
  };
}
