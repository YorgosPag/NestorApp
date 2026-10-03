/**
 * =============================================================================
 * «Ποιος είναι στην υπόθεση;» — η όψη των ΣΥΜΜΕΤΕΧΟΝΤΩΝ για τον επαγγελματία (ADR-901 Φ4 §5.4 καρτέλα 3)
 * =============================================================================
 *
 * Η δηλωμένη ιδιότητα (Ε-4) φαίνεται στα **άλλα** μέρη: ο συμβολαιογράφος βλέπει τον ΑΜ του δικηγόρου και
 * το αντίστροφο, πάντα ως «(δηλωμένο)».
 *
 * 🔑 **Ρητή προβολή, ποτέ spread** (ελαχιστοποίηση ΓΚΠΔ §5.10): ρόλος · όνομα · δηλωμένη ιδιότητα. **Κανένα**
 *    email, uid, συναίνεση ή ιστορία, γιατί αυτά ανήκουν στο βιβλίο του οικοδεσπότη. Άγκυρα Α18.
 * 🔑 **Μόνο όσοι συμμετέχουν ΤΩΡΑ**: κάθε συμμετοχή περνά από τον ίδιο κριτή (`decideEngagement`), άρα μια
 *    ληγμένη ή ανακλημένη δεν εμφανίζεται, ακόμη κι αν το έγγραφο λέει ακόμη `active`.
 *
 * @module services/conveyance/conveyance-case-participants.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { decideEngagement, isEngaged } from '@/lib/auth/engagement-judge';
import { LEGAL_ENGAGEMENT_ROLES, type Engagement } from '@/types/engagement';
import type { CaseParticipantView } from '@/types/conveyance-case';
import { resolveUserDisplayName } from '@/services/entity-audit.service';
import { listCaseEngagements } from './conveyance-engagement-support';

/** Συμμετέχει τώρα; — η **ίδια** κρίση με κάθε ανάγνωση της υπόθεσης. */
function engagedNow(engagement: Engagement, nowMs: number): boolean {
  const decision = decideEngagement({ engagement, uid: engagement.uid, subject: engagement.subject, scope: 'conveyance:case:view', nowMs });
  return isEngaged(decision.verdict);
}

/** Η σειρά της λίστας: η σειρά των θέσεων (πωλητή · αγοραστή · συμβολαιογράφος), ποτέ τυχαία. */
function byRoleOrder(a: CaseParticipantView, b: CaseParticipantView): number {
  return LEGAL_ENGAGEMENT_ROLES.indexOf(a.role) - LEGAL_ENGAGEMENT_ROLES.indexOf(b.role);
}

async function toParticipant(engagement: Engagement, viewerEngagementId: string): Promise<CaseParticipantView> {
  return {
    role: engagement.role,
    // Χωρίς όνομα ⇒ `null` (το UI δείχνει μόνο τον ρόλο). ⛔ ΠΟΤΕ εφεδρεία στο email.
    displayName: await resolveUserDisplayName(engagement.uid, null),
    declaredCredential: engagement.declaredCredential ?? null,
    isViewer: engagement.id === viewerEngagementId,
  };
}

/** Οι επαγγελματίες που συμμετέχουν **τώρα** στην υπόθεση του θεατή, μαζί με τον ίδιο (σημειωμένο). */
export async function listCaseParticipants(db: Firestore, viewer: Engagement, nowMs: number): Promise<CaseParticipantView[]> {
  const all = await listCaseEngagements(db, viewer.hostCompanyId, viewer.projectId, viewer.subject.caseId);
  const current = all.filter((engagement) => engagementNowVisible(engagement, nowMs));
  const participants = await Promise.all(current.map((engagement) => toParticipant(engagement, viewer.id)));
  return participants.sort(byRoleOrder);
}

/** Ενεργή **και** κρίνεται ενεργή τώρα. Η πρόταση `offered` δεν είναι ακόμη μέρος της υπόθεσης. */
function engagementNowVisible(engagement: Engagement, nowMs: number): boolean {
  return engagement.state === 'active' && engagedNow(engagement, nowMs);
}
