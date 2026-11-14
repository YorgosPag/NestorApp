import 'server-only';

/**
 * @fileoverview **Η ΕΠΑΦΗ ΤΟΥ ΓΡΑΦΕΙΟΥ ↔ Ο ΛΟΓΑΡΙΑΣΜΟΣ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ** — ο αναγνώστης (ADR-915 §40).
 * @related ADR-862 §5.3.11 (μητρώο οικοδεσποτών) · `lib/engagements/contact-professional-link.ts` (η σύνοψη)
 * @module server/engagements/contact-engagement-link.server
 *
 * 🔑 **Καμία νέα εγγραφή**: ο δεσμός ζει στη συμμετοχή (`origin.contactId` + `uid`), που τη γράφει ο ΕΝΑΣ γραφέας.
 * 🔑 **Τέσσερις εκβάσεις, ποτέ δύο** (δόγμα `engagement-read.ts`): «δεν μπόρεσα να ρωτήσω» ⇒ `unknown`, ποτέ ψεύτικο
 *    «δεν είναι συνδεδεμένος» (θα έσπρωχνε το γραφείο σε περιττή νέα πρόσκληση).
 * ⛔ Ο μισθωτής έρχεται **μόνο** από το υπογεγραμμένο token του καλούντα (`ctx.companyId`) — ποτέ από το αίτημα.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { engagementsOfContactQuery } from '@/lib/auth/engagement-ref';
import { parseEngagement } from '@/lib/auth/engagement-schema';
import {
  actsForOfficeOf,
  judgeCurrentPerSubject,
  latestDeclarationOf,
  linkStatusOf,
  shownStateOf,
  type JudgedEngagement,
} from '@/lib/engagements/contact-professional-link';
import { createModuleLogger } from '@/lib/telemetry';
import type { ContactProfessionalAssignment, ContactProfessionalLink } from '@/types/contact-professional-link';
import type { Engagement } from '@/types/engagement';
import { hostLineOf } from './engagement-hosts';

const logger = createModuleLogger('contact-engagement-link');

export type ContactProfessionalLinkRead =
  | { readonly outcome: 'ok'; readonly link: ContactProfessionalLink }
  | { readonly outcome: 'unknown' };

/** Ωμά έγγραφα → συμμετοχές· μη αναγνώσιμο **παραλείπεται με ίχνος** (λίστα για την οθόνη, όχι κρίση πρόσβασης). */
function readableOf(raws: readonly unknown[], contactId: string): readonly Engagement[] {
  const parsed = raws.map(parseEngagement);
  const readable = parsed.filter((e): e is Engagement => e !== null);
  if (readable.length !== parsed.length) {
    logger.warn('[CONTACT-LINK] Παραλείφθηκαν μη αναγνώσιμες συμμετοχές', { contactId, skipped: parsed.length - readable.length });
  }
  return readable;
}

/** Μία γραμμή «Ανέλαβε» — ακίνητο/έγγραφο από τον οικοδεσπότη του είδους. */
async function assignmentOf(db: Firestore, judged: JudgedEngagement): Promise<ContactProfessionalAssignment> {
  const { engagement } = judged;
  const line = await hostLineOf(db, engagement);
  return {
    engagementId: engagement.id,
    kind: engagement.subject.kind,
    role: engagement.role,
    state: shownStateOf(judged),
    offeredAt: engagement.offeredAt,
    propertyName: line.propertyName,
    documentKind: line.documentKind,
  };
}

/** Τι ξέρει **αυτό** το γραφείο για τον λογαριασμό πίσω από **αυτή** την επαφή του. */
export async function readContactProfessionalLink(
  db: Firestore,
  hostCompanyId: string,
  contactId: string,
  nowMs: number,
): Promise<ContactProfessionalLinkRead> {
  try {
    const snapshot = await engagementsOfContactQuery(db, hostCompanyId, contactId).get();
    const judged = judgeCurrentPerSubject(readableOf(snapshot.docs.map((doc) => doc.data()), contactId), nowMs);
    const status = linkStatusOf(judged);
    const shown = status === 'none' ? [] : judged;
    return {
      outcome: 'ok',
      link: {
        status,
        assignments: await Promise.all(shown.map((j) => assignmentOf(db, j))),
        declared: latestDeclarationOf(judged),
        actingForOffice: actsForOfficeOf(judged),
      },
    };
  } catch (error) {
    logger.error('[CONTACT-LINK] Η ανάγνωση απέτυχε — άγνωστο, όχι «μη συνδεδεμένος»', {
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unknown' };
  }
}
