import 'server-only';

/**
 * @fileoverview **«ΟΙ ΥΠΟΘΕΣΕΙΣ ΜΟΥ» — ΟΛΑ ΤΑ ΕΙΔΗ, ΜΙΑ ΛΙΣΤΑ, ΕΝΑ URL** (ADR-862 §5.3.11 · ADR-915 §39).
 * @related `engagement-hosts.ts` (ο οικοδεσπότης κάθε είδους) · `api/engagements` · `api/engagements/[id]/case`
 * @module server/engagements/my-engagements.server
 *
 * 🔑 **Ένα ερώτημα** (collection-group στο `uid`, Admin SDK) για όλες τις συμμετοχές του ανθρώπου· κάθε είδος το
 *    κρίνει και το δείχνει ο **δικός του** οικοδεσπότης. Ο επαγγελματίας έχει **ένα** σπίτι για κάθε συνεργασία
 *    (μοτίβο Procore «My Projects»), όχι μία λίστα ανά προϊόν.
 * 🔑 **Ο χώρος δεν έρχεται ποτέ από το αίτημα**: η συμμετοχή βρίσκεται **ανάμεσα στις δικές του** (`uid` από το token)·
 *    ξένη και ανύπαρκτη απαντούν το **ίδιο** `not-found`.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { listEngagementsOfUser } from '@/lib/auth/engagement-read';
import type { CasesViewer } from '@/services/conveyance/conveyance-engagement-access.service';
import type { EngagementOpenItem, MyEngagementCard } from '@/types/my-engagements';

import type { EngagedViewOutcome } from './engagement-host-adapter';
import { engagedViewFor, engagementCardsOf, engagementOpenItemsOf } from './engagement-hosts';

/**
 * `openItems: null` ⇒ οι εκκρεμότητες δεν διαβάστηκαν — χωριστά από τις κάρτες: η μία αποτυχία δεν κρύβει την άλλη, και
 * καμία δεν λέει ψευδώς «τίποτα» (ADR-787 §2.7).
 */
export type MyEngagementsOutcome =
  | { readonly ok: true; readonly cards: readonly MyEngagementCard[]; readonly openItems: readonly EngagementOpenItem[] | null }
  | { readonly ok: false };

export type MyOpenItemsOutcome = { readonly ok: true; readonly openItems: readonly EngagementOpenItem[] } | { readonly ok: false };

/**
 * Οι κάρτες **όσων φαίνονται στον χώρο της σελίδας**, νεότερη πρώτη — ή «δεν φορτώθηκε», ποτέ μισή λίστα. Μαζί, από το
 * **ίδιο** ερώτημα, οι εκκρεμότητές του από **όλα** τα γραφεία (ADR-915 §45.19 Φ6β).
 */
export async function listMyEngagements(db: Firestore, viewer: CasesViewer, nowMs: number): Promise<MyEngagementsOutcome> {
  const list = await listEngagementsOfUser(db, viewer.uid);
  if (list.outcome === 'unknown') return { ok: false };
  const [cards, openItems] = await Promise.all([
    engagementCardsOf(db, viewer, list.engagements, nowMs),
    engagementOpenItemsOf(db, viewer.uid, list.engagements, nowMs),
  ]);
  if (cards === 'unknown') return { ok: false };
  return { ok: true, cards, openItems: openItems === 'unknown' ? null : openItems };
}

/** §45.19 Φ6β — **μόνο** οι εκκρεμότητες (το ημερολόγιο CRM): καμία κάρτα, κανένας κατάλογος υπόθεσης. */
export async function listMyOpenItems(db: Firestore, uid: string, nowMs: number): Promise<MyOpenItemsOutcome> {
  const list = await listEngagementsOfUser(db, uid);
  if (list.outcome === 'unknown') return { ok: false };
  const openItems = await engagementOpenItemsOf(db, uid, list.engagements, nowMs);
  return openItems === 'unknown' ? { ok: false } : { ok: true, openItems };
}

/** Ο χώρος μέσω της **δικής του** συμμετοχής, όποιου είδους — ο οικοδεσπότης κρίνει πρόσβαση και θέση. */
export async function getEngagedView(db: Firestore, viewer: CasesViewer, engagementId: string, nowMs: number): Promise<EngagedViewOutcome> {
  const list = await listEngagementsOfUser(db, viewer.uid);
  if (list.outcome === 'unknown') return { ok: false, rejection: 'unknown' };
  const own = list.engagements.find((engagement) => engagement.id === engagementId);
  if (!own) return { ok: false, rejection: 'not-found' };
  return engagedViewFor(db, viewer, own, nowMs);
}
