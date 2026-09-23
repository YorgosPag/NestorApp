/**
 * @fileoverview **Το κουτί του στιγμιότυπου** — ένας αριθμός για την αριθμητική, μία κλάση για τη διάταξη.
 * @related ADR-777 §8.70 (Φάση 2) · lib/maps/map-snapshot-camera · owner-property/OwnerPropertyCardCover
 * @module components/listing-map-snapshot/snapshot-frame
 *
 * ⚠️ **Οι δύο τιμές λένε το ΙΔΙΟ πράγμα σε δύο γλώσσες** (TS για το ζουμ, Tailwind για τον
 * καμβά): αν αποκλίνουν, η σκίαση δεν πιάνει πια το ποσοστό που υπολογίστηκε. Η άγκυρα
 * `snapshot-frame.test.ts` τις κρατά ίσες. Το μέγεθος είναι η στήλη `sm:w-44` (176) της κάρτας σε 4:3.
 */

import type { SnapshotViewport } from '@/lib/maps/map-snapshot-camera';

export const SNAPSHOT_VIEWPORT: SnapshotViewport = { widthPx: 176, heightPx: 132 };
export const STAGE_FRAME = 'h-[132px] w-[176px]';
