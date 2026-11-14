import 'server-only';

/**
 * @fileoverview ADR-915 §39 — **Η ΓΕΦΥΡΑ**: «Αναλαμβάνω» στον σύνδεσμο χωρίς λογαριασμό ⇒ πρόσκληση σε λογαριασμό, στον
 *   **χώρο της ανάθεσης** (συμμετοχή `document_issuance`, ADR-862 §5.3.10–§5.3.11).
 * @related issuance-invitation-answer.ts (ο καλών) · server/engagement-invitations/engagement-invitation-issue.ts (η ΜΙΑ
 *   μηχανή πρόσκλησης) · services/document-registry/issuance-engagement-host-adapter.ts (ο οικοδεσπότης)
 * @module server/issuance-invitations/issuance-space-bridge
 *
 * 🔑 **Γρήγορη απάντηση χωρίς λογαριασμό, συνεργασία με λογαριασμό** (μοτίβο Thumbtack/Upwork πριν τη σύμβαση): ο
 *    σύνδεσμος μένει για το «Αναλαμβάνω/Αρνούμαι»· ό,τι ακολουθεί (ίχνος · ταυτότητα · ειδοποιήσεις) ζει σε λογαριασμό.
 * 🔑 **Ατομικά, στην ΙΔΙΑ συναλλαγή** με την απάντηση: «ανέλαβε» χωρίς πρόσκληση ή πρόσκληση χωρίς «ανέλαβε» δεν
 *    υπάρχουν. Οι αναγνώσεις του σχεδίου (ακίνητο → έργο) γίνονται **πριν**· το token κόβεται πριν (καθαρή κρυπτογραφία).
 * 🔑 **Ιδεμποτία**: ο σύνδεσμος σφραγίζεται στην ίδια συναλλαγή (δεύτερο κλικ ⇒ `already-used`)· το `Idempotency-Key`
 *    της πόρτας επιστρέφει την **ίδια** απάντηση στην επανάληψη· νέα έκδοση (επαναποστολή) ανακαλεί την παλιά (supersede).
 * 🔒 **Δεμένη στη διεύθυνση της ανάθεσης** (`inviteeEmail`): ανοίγει μόνο με λογαριασμό με **αυτό** το email (φρουρός
 *    παραλήπτη + απόδειξη γραμματοκιβωτίου) — ο προωθημένος σύνδεσμος δεν δίνει τίποτα.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { qualificationRegistryAuthority, type IssuerQualification } from '@/config/document-validity/document-issuers';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { caseInvitationHref } from '@/lib/conveyance/conveyance-routes';
import { publicUrl } from '@/lib/http/public-origin';
import {
  stageEngagementInvitation,
  type IssueEngagementInvitationInput,
} from '@/server/engagement-invitations/engagement-invitation-issue';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import type { IssuanceSpaceLink } from '@/services/email-templates/issuance-invitation-email';
import type { IssuanceSpaceView } from '@/types/issuance-invitation';

/** Ποιος, πού, για τι — ό,τι ξέρει ήδη η ανάθεση· **ποτέ** από το αίτημα του πελάτη. */
export interface IssuanceSpaceSubject {
  readonly companyId: string;
  readonly propertyId: string;
  readonly assignmentId: string;
  readonly documentKind: DocumentKind;
  readonly contactId: string;
  readonly inviteeEmail: string;
  readonly qualification: IssuerQualification;
  readonly registryNumber: string | null;
  /** Ο άνθρωπος του γραφείου στο όνομα του οποίου φεύγει η πρόσκληση (ο αποστολέας της ανάθεσης). */
  readonly actorUid: string;
}

/** Το σχέδιο — κρίνεται **πριν** από τη συναλλαγή, από αναγνώσεις που δεν αλλάζουν την απόφαση μέσα της. */
export type IssuanceSpacePlan =
  | { readonly kind: 'ready'; readonly input: IssueEngagementInvitationInput }
  | { readonly kind: 'no-project' }
  | { readonly kind: 'no-authority' };

/** Τι έγινε — το ωμό token **μόνο** εδώ, για τη σελίδα και το email· στη βάση ζει μόνο το `sha256` του nonce. */
export type IssuanceSpaceOutcome =
  | { readonly kind: 'invited'; readonly token: string; readonly expiresAt: string }
  | { readonly kind: 'no-project' }
  | { readonly kind: 'no-authority' }
  | { readonly kind: 'none' };

/**
 * **Το σχέδιο του χώρου**: το έργο του ακινήτου (εκεί ζει η συμμετοχή, ADR-862 §5.3.1) και το μητρώο της ιδιότητας
 * (προσόν → άδεια → αρχή). Ακίνητο χωρίς έργο ⇒ `no-project`, όπως στη μεταβίβαση (απόφαση Giorgio 2026-11-13).
 */
export async function planIssuanceSpace(db: Firestore, subject: IssuanceSpaceSubject, nowMs: number): Promise<IssuanceSpacePlan> {
  if (qualificationRegistryAuthority(subject.qualification) === null) return { kind: 'no-authority' };
  const context = await loadConveyanceSubject(db, subject.companyId, subject.propertyId);
  const projectId = context?.projectId ?? null;
  if (projectId === null) return { kind: 'no-project' };
  return {
    kind: 'ready',
    input: {
      hostCompanyId: subject.companyId,
      projectId,
      propertyId: subject.propertyId,
      subject: { kind: 'document_issuance', assignmentId: subject.assignmentId },
      role: 'document_issuer',
      documentKind: subject.documentKind,
      qualification: subject.qualification,
      contactId: subject.contactId,
      email: subject.inviteeEmail,
      // Η ανάθεση έκδοσης δεν ανοίγει έγγραφα μερών ⇒ καμία συναίνεση Ε-3 (το πρότυπο `issuer` βλέπει μόνο ό,τι εκδόθηκε).
      consents: [],
      // Ο αριθμός που κατέγραψε το γραφείο — **προσυμπλήρωση**, ποτέ δήλωση (Ε-4). Εθνικό μητρώο ⇒ χωρίς σύλλογο.
      credentialHint: { number: subject.registryNumber, chapter: null },
      actorUid: subject.actorUid,
      nowMs,
    },
  };
}

/** **Μέσα** στη συναλλαγή της απάντησης: διαβάζει τις ζωντανές της θέσης, και γράφει στο `commit()`. */
export async function stageIssuanceSpace(
  db: Firestore,
  tx: Transaction,
  plan: IssuanceSpacePlan,
): Promise<{ readonly outcome: IssuanceSpaceOutcome; commit(): void }> {
  if (plan.kind !== 'ready') return { outcome: plan, commit: () => undefined };
  const staged = await stageEngagementInvitation(db, tx, plan.input);
  const { invitation, token } = staged.issued;
  return { outcome: { kind: 'invited', token, expiresAt: invitation.expiresAt }, commit: staged.commit };
}

/** Η όψη για τη σελίδα του συνδέσμου — **σχετική** διεύθυνση (ο browser είναι ήδη στο σωστό origin). */
export function issuanceSpaceViewOf(outcome: IssuanceSpaceOutcome): IssuanceSpaceView {
  return outcome.kind === 'invited' ? { kind: 'invited', href: caseInvitationHref(outcome.token) } : outcome;
}

/** Ο σύνδεσμος για το email — **απόλυτος**· χωρίς δημόσια διεύθυνση ⇒ `null` (ποτέ σύνδεσμος που δεν οδηγεί πουθενά). */
export function issuanceSpaceLinkOf(outcome: IssuanceSpaceOutcome): IssuanceSpaceLink | null {
  if (outcome.kind !== 'invited') return null;
  const link = publicUrl(caseInvitationHref(outcome.token));
  return link === null ? null : { link, expiresAt: outcome.expiresAt };
}
