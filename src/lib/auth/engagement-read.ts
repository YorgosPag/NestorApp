/**
 * =============================================================================
 * Ο ΑΝΑΓΝΩΣΤΗΣ ΤΗΣ ΣΥΜΜΕΤΟΧΗΣ (ADR-862 Φ1) — «ποιο έγγραφο ισχύει;», όχι «επιτρέπεται;»
 * =============================================================================
 *
 * ⚠️ **ΜΗΝ φέρεις εδώ κρίση.** Ο αναγνώστης βρίσκει **την τρέχουσα** συμμετοχή· το «επιτρέπεται;»
 *    το απαντά **μόνο** ο `decideEngagement` (`engagement-judge.ts`) — ίδιος διαχωρισμός με το
 *    `resource-lookups.ts` ↔ `checkPermission` (ADR-801 §2.8).
 *
 * 🔑 **Τέσσερις εκβάσεις, ποτέ δύο** (μάθημα `project-member-read.ts`): «δεν υπάρχει» ≠ «δεν
 *    καταλαβαίνω το έγγραφο» ≠ «δεν μπόρεσα να ρωτήσω». Ένα 503 δεν μεταμφιέζεται σε «δεν συμμετέχεις».
 *
 * @module lib/auth/engagement-read
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import { parseEngagement } from './engagement-schema';
import { engagementsCollection, engagementsOfUserForSubjectQuery, engagementsOfUserQuery } from './engagement-ref';
import { LIVE_ENGAGEMENT_STATES, type Engagement, type EngagementSubject } from '@/types/engagement';

const logger = createModuleLogger('engagement-read');

export type EngagementRead =
  /** Η τρέχουσα συμμετοχή (ζωντανή, αλλιώς η πιο πρόσφατη ιστορική) — ή `null` αν δεν υπήρξε ποτέ. */
  | { readonly outcome: 'found'; readonly engagement: Engagement | null }
  /** Έγγραφο που δεν περνά το σχήμα, ή **δύο** ζωντανές για το ίδιο ζεύγος ⇒ fail-closed. */
  | { readonly outcome: 'unreadable'; readonly why: string }
  /** Δεν μπορέσαμε να ρωτήσουμε — **ποτέ** «δεν συμμετέχεις». */
  | { readonly outcome: 'unknown'; readonly why: string };

/**
 * **Η ΜΙΑ επιλογή** της τρέχουσας συμμετοχής ανάμεσα στην ιστορία ενός ζεύγους `(uid, υπόθεση)`.
 *
 * - **μία** ζωντανή (`offered`/`active`) ⇒ αυτή
 * - **καμία** ζωντανή ⇒ η πιο πρόσφατη ιστορική (ώστε η άρνηση να έχει **όνομα**: revoked/expired/…)
 * - **δύο** ζωντανές ⇒ `null` + `ambiguous` — ο γραφέας το κάνει αδύνατο· αν συμβεί, **δεν διαλέγουμε**.
 */
export function selectCurrentEngagement(
  engagements: readonly Engagement[],
): { readonly engagement: Engagement | null; readonly ambiguous: boolean } {
  const live = engagements.filter((e) => LIVE_ENGAGEMENT_STATES.includes(e.state));
  if (live.length > 1) return { engagement: null, ambiguous: true };
  if (live.length === 1) return { engagement: live[0], ambiguous: false };
  const latest = [...engagements].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return { engagement: latest ?? null, ambiguous: false };
}

/** Ωμά έγγραφα → συμμετοχές· αν **έστω ένα** δεν διαβάζεται, ολόκληρη η απάντηση είναι μη αναγνώσιμη. */
function parseAll(raws: readonly unknown[]): readonly Engagement[] | null {
  const parsed = raws.map(parseEngagement);
  return parsed.every((e): e is Engagement => e !== null) ? parsed : null;
}

export interface EngagementLookup {
  readonly hostCompanyId: string;
  readonly projectId: string;
  readonly uid: string;
  readonly subject: EngagementSubject;
}

/** Η τρέχουσα συμμετοχή ενός ανθρώπου σε **μία** υπόθεση του χώρου-οικοδεσπότη. */
export async function readEngagementForSubject(db: Firestore, lookup: EngagementLookup): Promise<EngagementRead> {
  try {
    const collection = engagementsCollection(db, lookup.hostCompanyId, lookup.projectId);
    const snapshot = await engagementsOfUserForSubjectQuery(collection, lookup.uid, lookup.subject).get();
    const engagements = parseAll(snapshot.docs.map((doc) => doc.data()));
    if (!engagements) return { outcome: 'unreadable', why: 'schema' };
    const current = selectCurrentEngagement(engagements);
    if (current.ambiguous) return { outcome: 'unreadable', why: 'ambiguous-live-engagements' };
    return { outcome: 'found', engagement: current.engagement };
  } catch (error) {
    logger.error('[ENGAGEMENT] Η ανάγνωση συμμετοχής απέτυχε — άγνωστο, όχι κενό', {
      uid: lookup.uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unknown', why: 'query-failed' };
  }
}

export type EngagementList =
  | { readonly outcome: 'ok'; readonly engagements: readonly Engagement[] }
  | { readonly outcome: 'unknown'; readonly why: string };

/**
 * Όλες οι συμμετοχές ενός ανθρώπου, σε **όλους** τους χώρους («Κοινόχρηστα μαζί μου»).
 * ⚠️ Μη αναγνώσιμο έγγραφο **παραλείπεται με ίχνος** — εδώ είναι λίστα για την οθόνη, όχι κρίση·
 *    η πρόσβαση κρίνεται ξανά ανά υπόθεση από τον `decideEngagement`.
 */
export async function listEngagementsOfUser(db: Firestore, uid: string): Promise<EngagementList> {
  try {
    const snapshot = await engagementsOfUserQuery(db, uid).get();
    const engagements = snapshot.docs.map((doc) => parseEngagement(doc.data()));
    const readable = engagements.filter((e): e is Engagement => e !== null);
    if (readable.length !== engagements.length) {
      logger.warn('[ENGAGEMENT] Παραλείφθηκαν μη αναγνώσιμες συμμετοχές', { uid, skipped: engagements.length - readable.length });
    }
    return { outcome: 'ok', engagements: readable };
  } catch (error) {
    logger.error('[ENGAGEMENT] Η λίστα συμμετοχών απέτυχε — άγνωστο, όχι κενό', {
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unknown', why: 'query-failed' };
  }
}
