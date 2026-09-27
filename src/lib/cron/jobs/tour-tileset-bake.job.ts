import 'server-only';

/**
 * @fileoverview Cron: **το δίχτυ του ψήστη πλακιδίων** (ADR-884 Φ2α · §4.9).
 * @related server/spatial-tour/tour-tileset-baker.ts (η πράξη) · config/cron-schedule.ts ·
 *   app/api/spatial-tours/[kind]/[subjectId]/uploads/finalize/route.ts (το κύριο έναυσμα, `after`)
 * @module lib/cron/jobs/tour-tileset-bake.job
 *
 * 🔑 Το κύριο ψήσιμο γίνεται αμέσως μετά την ολοκλήρωση του ανεβάσματος. Αυτό πιάνει ό,τι έμεινε `pending` επειδή η
 * διεργασία σταμάτησε στη μέση (επανεκκίνηση, deploy) ή επειδή η αποθήκευση απέτυχε προσωρινά. Μόνο λήψεις
 * **παλαιότερες** από `STALE_AFTER_MS` — ώστε να μην ψήνει ταυτόχρονα με το `after` της ίδιας στιγμής.
 */

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { bakeTourTileset, type TourTilesetBakeOutcome } from '@/server/spatial-tour/tour-tileset-baker';
import type { CronJobResult } from '@/types/cron-schedule';

/** Πόσο περιμένει το δίχτυ πριν θεωρήσει μια λήψη ξεχασμένη. */
const STALE_AFTER_MS = 10 * 60 * 1000;
/** Όσες λήψεις ψήνονται ανά εκτέλεση — κάθε ψήσιμο είναι δευτερόλεπτα CPU. */
const BATCH_LIMIT = 5;

export async function runTourTilesetBake(): Promise<CronJobResult> {
  const db = getAdminFirestore();
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  // tenant-scope-exempt: εργασία συστήματος (cron) — το ψήσιμο εκκρεμών λήψεων αφορά **κάθε** κάτοχο με την ίδια
  // πολιτική· κανένα φίλτρο κατόχου δεν έχει νόημα εδώ (ADR-884 Φ2α).
  const snapshot = await db.collectionGroup(SUBCOLLECTIONS.TOUR_CAPTURES)
    .where('tileset.state', '==', 'pending')
    .where('createdAt', '<', cutoff)
    .limit(BATCH_LIMIT)
    .get();

  const outcomes: TourTilesetBakeOutcome[] = [];
  for (const doc of snapshot.docs) outcomes.push(await bakeTourTileset(db, doc.ref));
  const count = (kind: TourTilesetBakeOutcome['kind']) => outcomes.filter((o) => o.kind === kind).length;
  const metrics = { found: snapshot.size, baked: count('baked'), failed: count('failed'), deferred: count('deferred'), skipped: count('skipped') };
  return {
    summary: `pending ${metrics.found}: baked ${metrics.baked}, failed ${metrics.failed}, deferred ${metrics.deferred}, skipped ${metrics.skipped}`,
    metrics,
  };
}
