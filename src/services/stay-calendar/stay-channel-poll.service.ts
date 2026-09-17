/**
 * @fileoverview **ΠΟΙΕΣ ΠΗΓΕΣ ΟΦΕΙΛΟΝΤΑΙ ΤΩΡΑ** — το πέρασμα της δημοσκόπησης.
 * @related ADR-835 §22 (Στάδιο Γ) · ADR-740 (cron στο Netcup) ·
 *   services/stay-calendar/stay-channel-import.service.ts · lib/cron/cron-lease.ts
 * @module services/stay-calendar/stay-channel-poll.service
 *
 * 🔑 **Το ερώτημα είναι ΕΝΑ πεδίο**: `nextPollAt <= now` πάνω στο έγγραφο καναλιών
 * (το **ελάχιστο** των πηγών του). Χωρίς αυτό, το cron θα σάρωνε **κάθε** κατάλυμα σε
 * κάθε πέρασμα — δηλαδή κόστος που μεγαλώνει με τον κατάλογο, όχι με τη δουλειά.
 *
 * ⚠️ **Το `limit` ΔΕΝ είναι διακοσμητικό**: κάθε πηγή είναι ένα εξωτερικό αίτημα με
 * 15″ όριο. Ένα απεριόριστο πέρασμα θα ξεπερνούσε το `maxDuration` της διαδρομής και θα
 * σκοτωνόταν **στη μέση**, αφήνοντας μισές πηγές δημοσκοπημένες και καμία ένδειξη γιατί.
 * Οι υπόλοιπες μένουν οφειλόμενες και πιάνονται στο επόμενο πέρασμα (5′ μετά).
 */

import 'server-only';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { stayChannelsFromDocument } from '@/lib/stay/stay-calendar-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import type { StayChannelFeed } from '@/types/stay-channels';

import { importStayChannelFeed } from './stay-channel-import.service';

const logger = createModuleLogger('stay-channel-poll');

/** Πόσα ακίνητα ανά πέρασμα. Με παλμό 5′ και δημοσκόπηση 30′, 25 φτάνουν για 150 καταλύματα. */
export const STAY_CHANNEL_POLL_PROPERTY_LIMIT = 25;

export interface StayChannelPollReport {
  readonly properties: number;
  readonly feeds: number;
  readonly created: number;
  readonly updated: number;
  readonly deleted: number;
  readonly failed: number;
  /** Έγγραφα καναλιών που **δεν διαβάστηκαν** — δικό μας χρέος, μετρημένο. */
  readonly unreadable: number;
  /** `true` αν έμειναν οφειλόμενα ακίνητα για το επόμενο πέρασμα. */
  readonly truncated: boolean;
}

const EMPTY: StayChannelPollReport = {
  properties: 0, feeds: 0, created: 0, updated: 0, deleted: 0, failed: 0, unreadable: 0, truncated: false,
};

function dueFeeds(feeds: readonly StayChannelFeed[], now: string): readonly StayChannelFeed[] {
  return feeds.filter((feed) => feed.status.nextPollAt <= now);
}

/**
 * **Ένα πέρασμα δημοσκόπησης.**
 *
 * ⚠️ Οι πηγές ενός ακινήτου τρέχουν **σειριακά**: κάθε εισαγωγή ανοίγει συναλλαγή στην
 * **ίδια** κεφαλή, και δύο παράλληλες θα ξαναέπαιζαν η μία την άλλη χωρίς κέρδος.
 * Διαφορετικά ακίνητα δεν μοιράζονται κεφαλή, αλλά μένουν επίσης σειριακά ώστε ένα
 * πέρασμα να μην ανοίγει 25 ταυτόχρονες εξωτερικές συνδέσεις.
 */
export async function pollStayChannels(adminDb: AdminFirestore): Promise<StayChannelPollReport> {
  const now = nowISO();
  // tenant-scope-exempt: μηχανή→μηχανή σάρωση **κάθε** μισθωτή, όπως όλα τα cron του
  // ADR-740: η ερώτηση είναι «ποιες πηγές οφείλονται;», και ένας άξονας μισθωτή εδώ θα
  // σήμαινε ότι τα καταλύματα κάποιου **δεν** δημοσκοπούνται ποτέ. Καμία απάντηση δεν
  // φεύγει προς πελάτη: το πέρασμα γράφει blocks και κατάσταση πηγών.
  const snapshot = await adminDb
    .collection(COLLECTIONS.STAY_CHANNELS)
    .where('nextPollAt', '<=', now)
    .orderBy('nextPollAt')
    .limit(STAY_CHANNEL_POLL_PROPERTY_LIMIT + 1)
    .get();

  const docs = snapshot.docs.slice(0, STAY_CHANNEL_POLL_PROPERTY_LIMIT);
  let report = { ...EMPTY, truncated: snapshot.docs.length > STAY_CHANNEL_POLL_PROPERTY_LIMIT };

  for (const doc of docs) {
    const channels = stayChannelsFromDocument(doc.data(), doc.id);
    if (channels === null) {
      // 🔴 Δεν «παραλείπεται»: μετριέται. Έγγραφο που δεν διαβάζεται σημαίνει κατάλυμα
      //    του οποίου τα κανάλια **δεν** δημοσκοπούνται — και το ημερολόγιό του είναι
      //    ήδη `unreadable` για τον επισκέπτη (§6.4).
      logger.error('Έγγραφο καναλιών δεν διαβάζεται', { data: { propertyId: doc.id } });
      report = { ...report, unreadable: report.unreadable + 1 };
      continue;
    }
    report = { ...report, properties: report.properties + 1 };
    for (const feed of dueFeeds(channels.feeds, now)) {
      const outcome = await importStayChannelFeed(adminDb, channels.propertyId, feed);
      report = {
        ...report,
        feeds: report.feeds + 1,
        created: report.created + outcome.created,
        updated: report.updated + outcome.updated,
        deleted: report.deleted + outcome.deleted,
        failed: report.failed + (outcome.failure === null ? 0 : 1),
      };
    }
  }
  return report;
}
