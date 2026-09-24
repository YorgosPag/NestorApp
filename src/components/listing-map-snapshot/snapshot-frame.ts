/**
 * @fileoverview **Το κουτί του στιγμιότυπου** — ένας αριθμός για την αριθμητική, μία κλάση για τη διάταξη.
 * @related ADR-777 §8.70 (Φάση 2) · §8.80 · lib/maps/map-snapshot-camera · search-results/listing-card-frame
 * @module components/listing-map-snapshot/snapshot-frame
 *
 * ⚠️ **Οι δύο τιμές λένε το ΙΔΙΟ πράγμα σε δύο γλώσσες** (TS για το ζουμ, Tailwind για τον
 * καμβά): αν αποκλίνουν, η σκίαση δεν πιάνει πια το ποσοστό που υπολογίστηκε. Η άγκυρα
 * `snapshot-frame.test.ts` τις κρατά ίσες.
 *
 * 🔑 **Ο λόγος ΔΕΝ είναι δικός του** (§8.80): είναι ο {@link LISTING_CARD_ASPECT} της κάρτας, γιατί
 * το στιγμιότυπο **γεμίζει το πλαίσιο της φωτογραφίας** όταν φωτογραφία δεν υπάρχει. Ένα 4:3
 * στιγμιότυπο σε 3:2 πλαίσιο θα έκοβε τη σκιασμένη περιοχή που το ζουμ υπολόγισε να χωρά. Ένα
 * κουτί εξυπηρετεί και την κάρτα αποτελεσμάτων (~23rem) και την κάρτα κατόχου (176px): τα pixel
 * **μικραίνουν** χωρίς απώλεια, ενώ δεύτερο κουτί θα σήμαινε δεύτερη λήψη ανά αγγελία.
 */

import type { SnapshotViewport } from '@/lib/maps/map-snapshot-camera';
import { LISTING_CARD_ASPECT } from '@/components/search-results/listing-card-frame';

const SNAPSHOT_WIDTH_PX = 360;

export const SNAPSHOT_VIEWPORT: SnapshotViewport = {
  widthPx: SNAPSHOT_WIDTH_PX,
  heightPx: (SNAPSHOT_WIDTH_PX * LISTING_CARD_ASPECT.h) / LISTING_CARD_ASPECT.w,
};
/** ⚠️ Στατικό literal (το Tailwind δεν εκτελεί κώδικα) — η άγκυρα το συγκρίνει με το {@link SNAPSHOT_VIEWPORT}. */
export const STAGE_FRAME = 'h-[240px] w-[360px]';
