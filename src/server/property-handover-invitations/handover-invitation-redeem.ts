import 'server-only';

/**
 * @fileoverview **ΠΡΟΣΚΛΗΣΗ ΑΓΟΡΑΣΤΗ — Η ΠΛΕΥΡΑ ΤΟΥ ΑΓΟΡΑΣΤΗ**: αποδοχή (δένει τον λογαριασμό · γεννά τον φάκελο) · άρνηση.
 * @related ADR-916 Φ-Β · Δ7 · Δ10 · ADR-853 §20 (κοινός πυρήνας) · ADR-866 (ο φάκελος)
 * @module server/property-handover-invitations/handover-invitation-redeem
 *
 * 🔑 **Το είδος «παράδοση» πάνω στον κοινό πυρήνα.** Η κλειδαριά (υπογραφή · λήξη δύο φορές · nonce · δέσμευση στο email
 * **του Auth** · απόδειξη γραμματοκιβωτίου · συναλλαγή που ξαναρωτά τα πάντα) είναι η **ίδια** με κάθε άλλη πρόσκληση —
 * εκεί ακριβώς σπάει το Zillow «Claim this home»: ο αγοραστής **ονομάζεται από τον πωλητή** και **το γραμματοκιβώτιό του**
 * το επιβεβαιώνει. Εδώ ζει μόνο **τι γράφει η αποδοχή**, στην **ίδια** συναλλαγή με το `pending → accepted`:
 *   1. ο λογαριασμός **δένεται** στην παράδοση (`recipient`, μία φορά)·
 *   2. γεννιέται ο **φάκελος** του αγοραστή στη **δική του** θεματοφυλακή (ADR-866), με προέλευση — ο προορισμός της
 *      αντιγραφής (Φ-Γ). Ο αγοραστής βλέπει **αμέσως** το σπίτι του (Spaciable · Housebuilder Pro).
 * Πώληση που ακυρώθηκε, ή παράδοση που έχει ήδη παραλήπτη ⇒ `handover-closed`· η πρόσκληση μένει `pending`.
 *
 * ⛔ **Κανένας ρόλος χώρου, κανένα claim**: ο αγοραστής **δεν** γίνεται μέλος του γραφείου που πούλησε.
 */

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { handoverDossierIdOf } from '@/lib/property-handover/property-handover-id';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { propertyHandoverInvitationFromDocument } from '@/lib/property-handover/property-handover-invitation-schema';
import { createModuleLogger } from '@/lib/telemetry';
import {
  redeemInvitation,
  type InvitationAcceptance,
  type InvitationKind,
  type InvitationRedeemer,
  type InvitationRedeemOutcome,
  type InvitationResolution,
} from '@/server/invitations/invitation-redeem';
import { recordPropertyDossierWrite } from '@/services/property-dossier/property-dossier-audit';
import { stagePropertyDossierForListing } from '@/services/property-dossier/property-dossier-write.service';
import {
  recordHandoverWrite,
  stageHandoverInvitationDeclined,
  stageHandoverRecipient,
} from '@/services/property-handover/property-handover-write.service';
import type { InvitationDocumentCore } from '@/types/invitation-core';
import { propertyDossierLabelFrom, type PropertyDossier, type PropertyDossierOrigin } from '@/types/property-dossier';
import type { PropertyHandover } from '@/types/property-handover';
import type {
  PropertyHandoverInvitation,
  PropertyHandoverInvitationKindRefusal,
} from '@/types/property-handover-invitation';

import { announceHandoverInvitationAnswer } from './handover-invitation-answer-notifier';
import { describeHandoverInvitation, type HandoverInvitationDescription } from './handover-invitation-description';
import { PROPERTY_HANDOVER_INVITATION_LOCATOR } from './handover-invitation-kind';

const logger = createModuleLogger('handover-invitation-redeem');

/** «Δεν μπόρεσα»: λείπει το μυστικό **μας**, ή η παράδοση δεν διαβάζεται. Fail-closed — καμία γραφή. */
export type HandoverInvitationUnavailable = 'secret-missing' | 'handover-unreadable';

/** Ό,τι γέννησε η αποδοχή — για το ίχνος και για την οθόνη («άνοιξε τον φάκελό σου»). */
export interface HandoverAcceptance {
  readonly dossier: PropertyDossier;
  /** `false` ⇒ ο φάκελος υπήρχε ήδη (επανάληψη) — κανένα δεύτερο ίχνος γέννησης. */
  readonly dossierBorn: boolean;
  readonly before: PropertyHandover;
  readonly after: PropertyHandover;
}

export type HandoverRedeemOutcome = InvitationRedeemOutcome<
  PropertyHandoverInvitation,
  PropertyHandoverInvitationKindRefusal,
  HandoverInvitationUnavailable,
  HandoverAcceptance
>;

type Acceptance = InvitationAcceptance<PropertyHandoverInvitationKindRefusal, HandoverInvitationUnavailable, HandoverAcceptance>;

function handoverRef(db: Firestore, handoverId: string): DocumentReference {
  return db.collection(COLLECTIONS.PROPERTY_HANDOVERS).doc(handoverId);
}

/** Το έγγραφο στο σχήμα του είδους, με την επίλυση — `null` ⇒ `invitation-corrupt`, **πριν** από κάθε γραφή. */
function recordOf(stored: InvitationDocumentCore, resolution: InvitationResolution): PropertyHandoverInvitation | null {
  const record = propertyHandoverInvitationFromDocument({ ...stored, ...resolution }, stored.id);
  if (record === null) logger.error('Πρόσκληση αγοραστή που δεν διαβάζεται — δεν εξαργυρώνεται', { invitationId: stored.id });
  return record;
}

/**
 * **Δέχεται ακόμη παραλήπτη αυτή η παράδοση, για ΑΥΤΗ την πρόσκληση;** — ίδια κρίση πριν και μέσα στη συναλλαγή.
 * Η πρόσκληση πρέπει να είναι **η τρέχουσα** του κατόπτρου: μια παλιότερη ανακαλείται ατομικά με τη νεότερη, άρα εδώ
 * είναι η τελευταία γραμμή άμυνας, όχι η πρώτη.
 */
function isOpenFor(handover: PropertyHandover, record: PropertyHandoverInvitation): boolean {
  const link = handover.invitation;
  return handover.companyId === record.companyId
    && handover.lifecycle !== 'cancelled'
    && handover.recipient === null
    && link !== null && link.status === 'issued' && link.invitationId === record.id;
}

/** Ο φάκελος που γεννά η αποδοχή — όνομα από το σπίτι, προέλευση από την πώληση (στιγμιότυπο, Δ2). */
function dossierBirthOf(handover: PropertyHandover, description: HandoverInvitationDescription, acceptedAt: string) {
  const origin: PropertyDossierOrigin = {
    kind: 'handover', handoverId: handover.id, issuerCompanyId: handover.companyId, issuerName: description.issuerName,
    acceptedAt, handoverLifecycle: handover.lifecycle, fileDelivery: null, protocol: null, appurtenanceOf: null,
  };
  // Το σπίτι έχει πάντα όνομα στο γραφείο· η εφεδρεία υπάρχει γιατί ο φάκελος **δεν** γεννιέται χωρίς όνομα.
  const label = propertyDossierLabelFrom(description.propertyLabel ?? '') || propertyDossierLabelFrom(description.issuerName ?? '') || handover.propertyId;
  return { origin, draft: { label, type: null } } as const;
}

/** **Η αποδοχή, μέσα στη συναλλαγή** — αναγνώσεις πρώτα· γραφή του φακέλου **μόνο** αφού κριθούν όλα. */
async function stageAcceptance(
  db: Firestore,
  tx: Transaction,
  record: PropertyHandoverInvitation,
  identity: InvitationRedeemer,
): Promise<Acceptance> {
  const ref = handoverRef(db, record.handoverId);
  const handover = propertyHandoverFromDocument((await tx.get(ref)).data(), ref.id);
  if (handover === null) return { kind: 'unavailable', reason: 'handover-unreadable' };
  if (!isOpenFor(handover, record)) return { kind: 'refused', reason: 'handover-closed' };

  const acceptedAt = record.resolvedAt ?? nowISO();
  const { origin, draft } = dossierBirthOf(handover, await describeHandoverInvitation(db, record), acceptedAt);
  const dossierId = handoverDossierIdOf(handover.id);
  const staged = await stagePropertyDossierForListing(tx, db, { id: dossierId, userId: identity.uid }, draft, acceptedAt, origin);
  // Ξένος φάκελος με το ντετερμινιστικό id ⇒ αδύνατο χωρίς αλλοίωση· ποτέ γραφή πάνω του.
  if (staged.kind === 'foreign') return { kind: 'refused', reason: 'handover-closed' };

  const after: PropertyHandover = { ...handover, recipient: { userId: identity.uid, acceptedAt, dossierId }, updatedAt: acceptedAt };
  return {
    kind: 'commit',
    write: () => {
      stageHandoverRecipient(tx, db, after);
      return { dossier: staged.dossier, dossierBorn: staged.kind === 'born', before: handover, after };
    },
  };
}

/** Το είδος — ανά αίτημα (κρατά το `db`). */
function handoverInvitationKind(db: Firestore): InvitationKind<
  InvitationDocumentCore, PropertyHandoverInvitation, InvitationRedeemer, PropertyHandoverInvitationKindRefusal, HandoverInvitationUnavailable, HandoverAcceptance
> {
  return {
    ...PROPERTY_HANDOVER_INVITATION_LOCATOR,
    secretMissing: 'secret-missing',
    recordOf,
    // Συμβουλευτικά, πριν από την απόδειξη γραμματοκιβωτίου: πώληση που έπεσε δεν αξίζει ούτε ένα αίτημα Auth.
    prepareAcceptance: async (_identity, stored) => {
      const record = propertyHandoverInvitationFromDocument(stored, stored.id);
      if (record === null) return null;
      const handover = propertyHandoverFromDocument((await handoverRef(db, record.handoverId).get()).data(), record.handoverId);
      return handover !== null && !isOpenFor(handover, record) ? { kind: 'refused', reason: 'handover-closed' } : null;
    },
    onAccept: (tx, { record, identity }) => stageAcceptance(db, tx, record, identity),
    // «Δεν το θέλω» — το κάτοπτρο το θυμάται, ώστε **καμία** αυτόματη νέα πρόσκληση να μη φύγει στο ίδιο email.
    // Η πρόσκληση που απαντιέται είναι **πάντα** η τρέχουσα του κατόπτρου (supersede ατομικό με το κάτοπτρο).
    onDecline: (tx, record) => stageHandoverInvitationDeclined(tx, db, record.handoverId, record.resolvedAt ?? nowISO()),
  };
}

/** Τα ίχνη **μετά** το commit — παράδοση (`recipient`) και, αν γεννήθηκε, ο φάκελος. Ποτέ δεν πετούν προς τα πάνω. */
async function recordAcceptance(acceptance: HandoverAcceptance, performedBy: string): Promise<void> {
  try {
    await recordHandoverWrite({ kind: 'update', before: acceptance.before, after: acceptance.after }, performedBy);
    if (acceptance.dossierBorn) await recordPropertyDossierWrite(acceptance.dossier, { performedBy, before: null });
  } catch (error) {
    logger.error('Το ίχνος της αποδοχής πρόσκλησης αγοραστή δεν γράφτηκε', { handoverId: acceptance.after.id, error: getErrorMessage(error) });
  }
}

/**
 * **Η απάντηση του αγοραστή** — εξαργύρωση (ατομική) → ίχνος → ειδοποίηση γραφείου (Φ-Δ.2). Δύο ταυτόχρονα κλικ ⇒ **ένας**
 * φάκελος, **ένα** δέσιμο, **μία** ειδοποίηση (η δεύτερη συναλλαγή βρίσκει `accepted` ⇒ `already-used`, δεν φτάνει εδώ).
 * Ίχνος και ειδοποίηση **μετά** το commit και **δεν πετούν**: η απάντηση του αγοραστή δεν εξαρτάται από αυτά.
 */
export async function respondToHandoverInvitation(
  db: Firestore,
  input: { readonly action: 'accept' | 'decline'; readonly token: string; readonly identity: InvitationRedeemer },
): Promise<HandoverRedeemOutcome> {
  const outcome = await redeemInvitation(db, handoverInvitationKind(db), {
    token: input.token,
    identity: input.identity,
    target: input.action === 'accept' ? 'accepted' : 'declined',
    nowValue: nowISO(),
  });
  if (outcome.kind === 'accepted') await recordAcceptance(outcome.effect, input.identity.uid);
  if (outcome.kind === 'accepted' || outcome.kind === 'declined') {
    await announceHandoverInvitationAnswer(db, { invitation: outcome.invitation, answer: outcome.kind, respondentUid: input.identity.uid });
  }
  return outcome;
}
