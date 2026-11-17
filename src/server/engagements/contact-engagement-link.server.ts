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
  accountNameProposalOf,
  compareContactToAccount,
  type ContactPersonName,
} from '@/lib/engagements/contact-account-name-match';
import {
  acceptedAccountUidsOf,
  actsForOfficeOf,
  judgeCurrentPerSubject,
  latestDeclarationOf,
  linkStatusOf,
  shownStateOf,
  type JudgedEngagement,
} from '@/lib/engagements/contact-professional-link';
import { createModuleLogger } from '@/lib/telemetry';
import { readAccountIdentities, type AccountIdentity } from '@/server/auth/account-identities';
import type {
  ContactLinkedAccount,
  ContactProfessionalAssignment,
  ContactProfessionalLink,
} from '@/types/contact-professional-link';
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
    propertyId: line.propertyId,
    propertyName: line.propertyName,
    documentKind: line.documentKind,
  };
}

/**
 * ADR-915 §40.8 — **με ποια ταυτότητα** δουλεύει μαζί του: μόνο όνομα, μόνο αποδεκτοί λογαριασμοί, διαβασμένο από την
 * **πηγή** τη στιγμή της ανάγνωσης (`readAccountIdentities`) — καμία αντιγραφή στην επαφή. Ο `uid` **δεν** φεύγει.
 */
async function linkedAccountsOf(
  db: Firestore,
  judged: readonly JudgedEngagement[],
  contactName: ContactPersonName | null,
): Promise<readonly ContactLinkedAccount[]> {
  const uids = acceptedAccountUidsOf(judged);
  if (uids.length === 0) return [];
  const identities = await readAccountIdentities(db, uids);
  return uids.map((uid) => {
    const identity = identities.get(uid) ?? null;
    return {
      displayName: identity?.displayName ?? null,
      nameMatch: compareContactToAccount(contactName, identity),
      proposedName: accountNameProposalOf(identity),
    };
  });
}

/**
 * Ζητά ο καλών τους λογαριασμούς (ADR-915 §40.8); **Ρητό** σε κάθε σημείο κλήσης: η ανάγνωση ταυτοτήτων κοστίζει
 * κλήση στο Firebase Auth, και ο καλών που θέλει μόνο τη δήλωση (υιοθέτηση) δεν την πληρώνει.
 * `contactName` = από την επαφή που ο route **ήδη** φόρτωσε (`loadOwnedContact`) — `null` όταν δεν είναι φυσικό πρόσωπο.
 */
export type LinkedAccountsRequest =
  | { readonly read: true; readonly contactName: ContactPersonName | null }
  | { readonly read: false };

/** Οι τρέχουσες συμμετοχές της επαφής **σε αυτό** το γραφείο, κριμένες τώρα — η ΜΙΑ ανάγνωση και των δύο αναγνωστών. */
async function judgedOf(db: Firestore, hostCompanyId: string, contactId: string, nowMs: number): Promise<readonly JudgedEngagement[]> {
  const snapshot = await engagementsOfContactQuery(db, hostCompanyId, contactId).get();
  return judgeCurrentPerSubject(readableOf(snapshot.docs.map((doc) => doc.data()), contactId), nowMs);
}

/** Τι ξέρει **αυτό** το γραφείο για τον λογαριασμό πίσω από **αυτή** την επαφή του. */
export async function readContactProfessionalLink(
  db: Firestore,
  hostCompanyId: string,
  contactId: string,
  nowMs: number,
  accountsRequest: LinkedAccountsRequest,
): Promise<ContactProfessionalLinkRead> {
  try {
    const judged = await judgedOf(db, hostCompanyId, contactId, nowMs);
    const status = linkStatusOf(judged);
    const shown = status === 'none' ? [] : judged;
    const [assignments, accounts] = await Promise.all([
      Promise.all(shown.map((j) => assignmentOf(db, j))),
      accountsRequest.read ? linkedAccountsOf(db, judged, accountsRequest.contactName) : [],
    ]);
    return {
      outcome: 'ok',
      link: {
        status,
        assignments,
        accounts,
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

/**
 * ADR-915 §40.9 — **ο ΕΝΑΣ** λογαριασμός που αποδέχτηκε ως αυτή η επαφή, για την «Υιοθέτηση ονόματος». Μόνο server:
 * κρατά τον `uid`, που **δεν** φεύγει ποτέ στον πελάτη.
 * - `none`      — κανένας αποδεκτός λογαριασμός (η εικόνα του γραφείου είναι μπαγιάτικη)
 * - `ambiguous` — δύο ή περισσότεροι: **ποιανού** το όνομα; δεν διαλέγουμε
 * - `unknown`   — η ανάγνωση (συμμετοχών ή λογαριασμού) απέτυχε· ποτέ «κανένας»
 */
export type SoleAcceptedAccountRead =
  | { readonly outcome: 'ok'; readonly identity: AccountIdentity }
  | { readonly outcome: 'none' | 'ambiguous' | 'unknown' };

export async function readSoleAcceptedAccount(
  db: Firestore,
  hostCompanyId: string,
  contactId: string,
  nowMs: number,
): Promise<SoleAcceptedAccountRead> {
  try {
    const uids = acceptedAccountUidsOf(await judgedOf(db, hostCompanyId, contactId, nowMs));
    if (uids.length === 0) return { outcome: 'none' };
    if (uids.length > 1) return { outcome: 'ambiguous' };
    const identity = (await readAccountIdentities(db, uids)).get(uids[0]);
    return identity === undefined ? { outcome: 'unknown' } : { outcome: 'ok', identity };
  } catch (error) {
    logger.error('[CONTACT-LINK] Ο αποδεκτός λογαριασμός δεν διαβάστηκε — άγνωστος, όχι «κανένας»', {
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unknown' };
  }
}
