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
import type { MyEngagementCard } from '@/types/my-engagements';

import type { EngagedViewOutcome } from './engagement-host-adapter';
import { engagedViewFor, engagementCardsOf } from './engagement-hosts';

export type MyEngagementsOutcome = { readonly ok: true; readonly cards: readonly MyEngagementCard[] } | { readonly ok: false };

/** Οι κάρτες **όσων φαίνονται στον χώρο της σελίδας**, νεότερη πρώτη — ή «δεν φορτώθηκε», ποτέ μισή λίστα. */
export async function listMyEngagements(db: Firestore, viewer: CasesViewer, nowMs: number): Promise<MyEngagementsOutcome> {
  const list = await listEngagementsOfUser(db, viewer.uid);
  if (list.outcome === 'unknown') return { ok: false };
  const cards = await engagementCardsOf(db, viewer, list.engagements, nowMs);
  return cards === 'unknown' ? { ok: false } : { ok: true, cards };
}

/** Ο χώρος μέσω της **δικής του** συμμετοχής, όποιου είδους — ο οικοδεσπότης κρίνει πρόσβαση και θέση. */
export async function getEngagedView(db: Firestore, viewer: CasesViewer, engagementId: string, nowMs: number): Promise<EngagedViewOutcome> {
  const list = await listEngagementsOfUser(db, viewer.uid);
  if (list.outcome === 'unknown') return { ok: false, rejection: 'unknown' };
  const own = list.engagements.find((engagement) => engagement.id === engagementId);
  if (!own) return { ok: false, rejection: 'not-found' };
  return engagedViewFor(db, viewer, own, nowMs);
}
