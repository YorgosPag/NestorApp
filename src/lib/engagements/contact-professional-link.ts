/**
 * @fileoverview **Η ΣΥΝΟΨΗ «ΕΠΑΦΗ ↔ ΛΟΓΑΡΙΑΣΜΟΣ»** — καθαρές συναρτήσεις πάνω στο ιστορικό συμμετοχών μιας επαφής.
 * @related ADR-915 §40 · `server/engagements/contact-engagement-link.server.ts` (η ανάγνωση)
 * @module lib/engagements/contact-professional-link
 *
 * 🔑 **Καμία δεύτερη κρίση**: η τρέχουσα συμμετοχή ανά υπόθεση = `selectCurrentEngagement`· το «ισχύει τώρα;» =
 *    `decideEngagement`. Εδώ μόνο συνοψίζονται οι ετυμηγορίες τους.
 * Καμία κλήση Firestore (σύγχρονο, ελέγξιμο χωρίς βάση)· μόνο server — το `selectCurrentEngagement` ζει σε
 * `server-only` αρχείο, και η σύνοψη δεν χρειάζεται στον πελάτη (ο πελάτης παίρνει το έτοιμο `ContactProfessionalLink`).
 */

import { actingWorkspaceOf } from '@/lib/auth/acting-workspace';
import { decideEngagement } from '@/lib/auth/engagement-judge';
import { selectCurrentEngagement } from '@/lib/auth/engagement-read';
import { subjectKeyOf } from '@/lib/auth/engagement-subject';
import type { ContactDeclaredCredential, ContactLinkStatus } from '@/types/contact-professional-link';
import { SCOPE_OF_SUBJECT, type Engagement, type EngagementState, type EngagementVerdict } from '@/types/engagement';

/** Μία υπόθεση της επαφής: η τρέχουσα συμμετοχή της και η ετυμηγορία της **τώρα**. */
export interface JudgedEngagement {
  readonly engagement: Engagement;
  readonly verdict: EngagementVerdict;
}

/** Ετυμηγορίες που σημαίνουν «ο άνθρωπος αποδέχτηκε με δικό του λογαριασμό». */
const ACCEPTED_VERDICTS: readonly EngagementVerdict[] = ['engaged', 'completed'];

function isAccepted(judged: JudgedEngagement): boolean {
  return ACCEPTED_VERDICTS.includes(judged.verdict);
}

/**
 * Η τρέχουσα συμμετοχή **ανά υπόθεση**, κριμένη τώρα. Υπόθεση με δύο ζωντανές (`ambiguous`) **παραλείπεται** —
 * ο γραφέας το κάνει αδύνατο· αν συμβεί, δεν διαλέγουμε (ίδιο δόγμα με τον αναγνώστη).
 */
export function judgeCurrentPerSubject(engagements: readonly Engagement[], nowMs: number): readonly JudgedEngagement[] {
  const bySubject = new Map<string, Engagement[]>();
  for (const e of engagements) {
    const key = subjectKeyOf(e.subject);
    bySubject.set(key, [...(bySubject.get(key) ?? []), e]);
  }
  const current = [...bySubject.values()]
    .map((group) => selectCurrentEngagement(group))
    .flatMap((selected) => (selected.engagement === null ? [] : [selected.engagement]));
  return current
    .map((engagement) => ({
      engagement,
      verdict: decideEngagement({
        engagement, uid: engagement.uid, subject: engagement.subject, scope: SCOPE_OF_SUBJECT[engagement.subject.kind], nowMs,
      }).verdict,
    }))
    .sort((a, b) => b.engagement.offeredAt.localeCompare(a.engagement.offeredAt));
}

/** `linked` αν έστω μία αποδεκτή · `offered` αν μόνο προτάσεις σε αναμονή · αλλιώς `none`. */
export function linkStatusOf(judged: readonly JudgedEngagement[]): ContactLinkStatus {
  if (judged.some(isAccepted)) return 'linked';
  return judged.some((j) => j.verdict === 'offered') ? 'offered' : 'none';
}

/** Η πιο πρόσφατη δήλωση ιδιότητας του ίδιου — **μόνο** από συμμετοχή που ισχύει τώρα (`engaged`). */
export function latestDeclarationOf(judged: readonly JudgedEngagement[]): ContactDeclaredCredential | null {
  const latest = judged
    .filter((j) => j.verdict === 'engaged')
    .flatMap((j) => (j.engagement.declaredCredential ? [{ declared: j.engagement.declaredCredential, engagementId: j.engagement.id }] : []))
    .sort((a, b) => b.declared.declaredAt.localeCompare(a.declared.declaredAt))[0];
  if (!latest) return null;
  const { declared, engagementId } = latest;
  return { authority: declared.authority, number: declared.number, chapter: declared.chapter, declaredAt: declared.declaredAt, engagementId };
}

/** Ανέλαβε έστω μία φορά για λογαριασμό **γραφείου** (νομικό πρόσωπο); — μόνο μέσω του `actingWorkspaceOf`. */
export function actsForOfficeOf(judged: readonly JudgedEngagement[]): boolean {
  return judged.filter(isAccepted).some((j) => actingWorkspaceOf(j.engagement).kind === 'org');
}

/**
 * Η κατάσταση που **δείχνεται** στο γραφείο: η ετυμηγορία κερδίζει όπου λέει κάτι που η αποθηκευμένη κατάσταση δεν
 * ξέρει ακόμη (ενεργή αλλά **ληγμένη** ή **ανακλημένη** ⇒ `expired` / `revoked`).
 */
export function shownStateOf(judged: JudgedEngagement): EngagementState {
  return judged.verdict === 'expired' || judged.verdict === 'revoked' ? judged.verdict : judged.engagement.state;
}
