/**
 * @fileoverview **Ο ΚΙΝΗΤΗΡΑΣ ΤΟΥ ΑΥΤΟΜΑΤΟΥ ΣΗΜΕΙΟΥ ΕΣΤΙΑΣΗΣ** — `sharp` στρατηγική `attention` (ADR-880).
 * @related ADR-880 · public-shelf-sanitise · lib/listings/photo-focal-point
 * @module services/listings/public-shelf-focal-point
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΠΑΓΙΔΕΣ ΤΟΥ `attentionX/Y` — ΜΕΤΡΗΜΕΝΕΣ (sharp 0.35.3 · libvips 8.18.3, 2026-09-24)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `info` του `toBuffer` δίνει όντως `attentionX/attentionY` *(«the focal point of the cropped
 * region»)*. Η αφελής χρήση όμως **λέει ψέματα** με τρεις τρόπους:
 *
 * 1. **JPEG ≠ PNG.** Με shrink-on-load οι συντεταγμένες βγαίνουν σε **άλλο** σύστημα από το
 *    κλιμακωμένο: ίδια εικόνα 1774×887, στόχος 128² → `864` σε JPEG, `216` σε PNG. Κανονικοποίηση
 *    με το «αναμενόμενο» μέγεθος θα έδινε `x = 1,69` — **έξω από την εικόνα**.
 * 2. **Επίπεδη εικόνα ⇒ `(0,0)`** — η πάνω-αριστερή γωνία, όχι «κανένα σήμα».
 * 3. **Καμία περικοπή ⇒ κανένα `attention`**: αν ο στόχος έχει την αναλογία της εικόνας, το πεδίο λείπει.
 *
 * ✅ **Η μέθοδος**: αποκωδικοποίηση σε **ωμό** buffer γνωστού μεγέθους (≤512 — καμία συμπίεση
 * ⇒ κανένα shrink-on-load στο δεύτερο βήμα), και `attention` σε στόχο **W × H/2** (πάντα περικοπή).
 * Το libvips υπολογίζει το σημείο **σε όλη την εικόνα** (μέγιστο θολωμένου χάρτη προσοχής), άρα η
 * περικοπή του ύψους **δεν** περιορίζει το `x`. Επαληθευμένο: JPEG ≡ PNG · κάθετη (0,69·0,19 για
 * θέμα στο 0,70·0,20) · τετράγωνη · οριζόντια · πραγματικός ήρωας → πάνω στο κτίριο.
 *
 * ⚠️ **ΔΕΝ ΠΕΤΑ ΠΟΤΕ.** Το σημείο εστίασης είναι **βελτίωση** της παρουσίασης· αποτυχία του δεν
 * επιτρέπεται να εμποδίσει τη δημοσίευση μιας φωτογραφίας που καθαρίστηκε σωστά. `null` ⇒ κέντρο.
 *
 * ⚠️ **SERVER-ONLY** (`sharp` εγγενές).
 */

import sharp from 'sharp';

import { createModuleLogger } from '@/lib/telemetry';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

const logger = createModuleLogger('public-shelf-focal-point');

/**
 * **Η ακμή του ωμού αντιγράφου εργασίας.** Το libvips δουλεύει τον χάρτη προσοχής σε ~1/8
 * ⇒ στα 512 η ανάλυση είναι ~1/64 της εικόνας — πολύ πιο λεπτή από το βήμα 5% της απόδοσης.
 * Και το κόστος είναι ~1MB μνήμης, όσο κι αν είναι μεγάλο το πρωτότυπο του χρήστη.
 */
const WORKING_EDGE_PX = 512;

/** Κάτω από αυτό δεν υπάρχει περιθώριο περικοπής — ούτε νόημα εστίασης. */
const MIN_WORKING_EDGE_PX = 8;

/** Τρία δεκαδικά: σταθερό μεταδεδομένο (ντετερμινισμός) και ακρίβεια 0,1% — άφθονη. */
const PRECISION = 1000;

/**
 * **Το σημείο προσοχής ενός αγωγού ΗΔΗ στραμμένου** (`.rotate()` έχει εφαρμοστεί).
 *
 * 🔑 Δέχεται **αγωγό**, όχι bytes, ώστε ο καθαριστής να το ρωτήσει πάνω στην **ίδια**
 * αποκωδικοποίηση που θα κωδικοποιήσει — το ακριβότερο βήμα της διαδρομής πληρώνεται μία φορά.
 */
export async function detectFocalPoint(pipeline: sharp.Sharp): Promise<PhotoFocalPoint | null> {
  try {
    const { data, info } = await pipeline
      .clone()
      .resize({ width: WORKING_EDGE_PX, height: WORKING_EDGE_PX, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .toColourspace('srgb')
      .raw({ depth: 'uchar' })
      .toBuffer({ resolveWithObject: true });

    if (info.width < MIN_WORKING_EDGE_PX || info.height < MIN_WORKING_EDGE_PX) return null;
    return await attentionOfRaw(data, info.width, info.height, info.channels);
  } catch (error) {
    logger.debug('Το σημείο προσοχής δεν υπολογίστηκε — η φωτογραφία μένει στο κέντρο', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * **Το σημείο προσοχής από bytes** — για ό,τι δεν περνά από τον καθαριστή (αυτοθεραπεία του
 * ραφιού, πρόταση του επεξεργαστή). Στρέφει κατά EXIF εδώ, **μία** φορά.
 */
export async function detectFocalPointInBytes(bytes: Buffer): Promise<PhotoFocalPoint | null> {
  if (bytes.length === 0) return null;
  try {
    return await detectFocalPoint(sharp(bytes, { failOn: 'error' }).rotate());
  } catch {
    return null;
  }
}

/** Το δεύτερο βήμα: περικοπή W × H/2 πάνω στο ωμό αντίγραφο ⇒ `attentionX/Y` στο **δικό του** σύστημα. */
async function attentionOfRaw(
  data: Buffer,
  width: number,
  height: number,
  channels: 1 | 2 | 3 | 4,
): Promise<PhotoFocalPoint | null> {
  const { info } = await sharp(data, { raw: { width, height, channels } })
    .resize(width, Math.floor(height / 2), { fit: 'cover', position: 'attention' })
    .toBuffer({ resolveWithObject: true });

  const { attentionX, attentionY } = info;
  if (attentionX === undefined || attentionY === undefined) return null;
  // Παγίδα 2: ο χάρτης προσοχής δεν βρήκε τίποτα ⇒ η γωνία. «Κανένα σήμα», όχι «πάνω αριστερά».
  if (attentionX === 0 && attentionY === 0) return null;

  return { x: normalised(attentionX, width), y: normalised(attentionY, height) };
}

function normalised(value: number, extent: number): number {
  const fraction = Math.min(1, Math.max(0, value / extent));
  return Math.round(fraction * PRECISION) / PRECISION;
}
