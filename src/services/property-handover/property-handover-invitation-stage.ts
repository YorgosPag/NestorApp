import 'server-only';

/**
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ ΤΟΥ ΑΓΟΡΑΣΤΗ, ΜΕΣΑ ΣΤΗ ΣΥΝΑΛΛΑΓΗ ΤΗΣ ΠΑΡΑΔΟΣΗΣ** (ADR-916 Φ-Β · Δ1 · Δ7).
 * @related lib/property-handover/handover-invitation-plan.ts (η κρίση) · property-handover-write.service.ts (ο ΕΝΑΣ γραφέας) ·
 *          server/invitations/invitation-lifecycle.ts (supersede · ανάκληση — ο κοινός πυρήνας)
 * @module services/property-handover/property-handover-invitation-stage
 *
 * ```
 * [συναλλαγή: ακίνητο → παραδόσεις → σχέδιο κύκλου ζωής → email επαφών → ΚΡΙΣΗ → ζωντανές προσκλήσεις → ΕΓΓΡΑΦΕΣ]
 *                                                                              └─► μετά το commit: email (ο καλών)
 * ```
 * 🔴 **Παράδοση και πρόσκληση σε ΜΙΑ συναλλαγή**: το κάτοπτρο στην παράδοση λέει `invitationId` **μόνο** αν η πρόσκληση
 *    γράφτηκε, και το αντίστροφο (πρότυπο ADR-915 §28 Η-Β4). Δύο ταυτόχρονες συμφιλιώσεις ⇒ η δεύτερη ξαναπαίζει, βλέπει
 *    το κάτοπτρο της πρώτης και κρίνει `none` — **ένα** email, ποτέ δύο ζωντανοί σύνδεσμοι.
 * 🔴 **Το email ΔΕΝ φεύγει εδώ** (το σώμα ξανατρέχει σε σύγκρουση): επιστρέφεται το ωμό token για τον καλούντα.
 *
 * ⛔ **Καμία ανάγνωση στο `commit()`** — όλες γίνονται στη σκηνή (το Firestore θέλει αναγνώσεις πριν από γραφές).
 */

import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { primaryEmailOf } from '@/lib/contacts/primary-email';
import { getErrorMessage } from '@/lib/error-utils';
import { handoverInvitationIntentOf, type HandoverInvitationIntent } from '@/lib/property-handover/handover-invitation-plan';
import { createModuleLogger } from '@/lib/telemetry';
import { stageInvitationWithSupersede, stageLiveInvitationRevocation } from '@/server/invitations/invitation-lifecycle';
import { readOwnedContactDocsInTransaction } from '@/server/lib/owned-contact-docs';
import {
  liveHandoverInvitationsQuery,
  mintHandoverInvitation,
  propertyHandoverInvitationsCollection,
  type MintedHandoverInvitation,
} from '@/server/property-handover-invitations/handover-invitation-kind';
import type { PropertyHandover, PropertyHandoverInvitationLink } from '@/types/property-handover';

const logger = createModuleLogger('PropertyHandoverInvitationStage');

export interface HandoverInvitationStageInput {
  readonly companyId: string;
  /** Οι παραδόσεις του ακινήτου **όπως θα γραφτούν** (μετά το σχέδιο κύκλου ζωής). */
  readonly handovers: readonly PropertyHandover[];
  /** uid του δρώντα — `'system'` για δίχτυ και γραφέα νομικής φάσης. */
  readonly actorUid: string;
  readonly nowValue: string;
}

export interface StagedHandoverInvitations {
  /** Οι παραδόσεις των οποίων **άλλαξε** το κάτοπτρο — με το νέο κάτοπτρο, για εγγραφή. */
  readonly mirrored: ReadonlyMap<string, PropertyHandover>;
  /** Οι νέες προσκλήσεις — το email τους φεύγει **μετά** το commit. */
  readonly issued: readonly MintedHandoverInvitation[];
  commit(): void;
}

/** Το **τρέχον** κύριο email κάθε αγοραστή — κανονικοποιημένο· ξένη ή άγνωστη επαφή ≡ χωρίς email. */
async function recipientEmails(
  tx: Transaction,
  adminDb: AdminFirestore,
  companyId: string,
  handovers: readonly PropertyHandover[],
): Promise<ReadonlyMap<string, string | null>> {
  const docs = await readOwnedContactDocsInTransaction(tx, adminDb, companyId, handovers.map((h) => h.recipientContactId));
  return new Map(handovers.map((handover) => {
    const data = docs.get(handover.recipientContactId);
    const email = data === undefined ? null : primaryEmailOf(Array.isArray(data.emails) ? data.emails : undefined);
    return [handover.recipientContactId, email === null ? null : normaliseChannelEmail(email)] as const;
  }));
}

/** Το κάτοπτρο μιας **νέας** πρόσκλησης — η αποστολή δεν έχει δοκιμαστεί ακόμη (`pending`). */
function issuedLink(minted: MintedHandoverInvitation): PropertyHandoverInvitationLink {
  const { invitation } = minted;
  return {
    status: 'issued', invitationId: invitation.id, inviteeEmail: invitation.inviteeEmail, occasion: invitation.occasion,
    issuedAt: invitation.createdAt, expiresAt: invitation.expiresAt, delivery: 'pending', deliveryAttempts: 0,
    remindedAt: null, declinedAt: null,
  };
}

interface IntentStage {
  readonly link: PropertyHandoverInvitationLink | null;
  readonly minted: MintedHandoverInvitation | null;
  commit(): void;
}

/** Οι αναγνώσεις μιας πρόθεσης (ζωντανές προσκλήσεις) — `null` ⇒ καμία πράξη αυτή τη φορά. */
async function stageIntent(
  tx: Transaction,
  adminDb: AdminFirestore,
  handover: PropertyHandover,
  intent: Exclude<HandoverInvitationIntent, { kind: 'none' }>,
  input: HandoverInvitationStageInput,
): Promise<IntentStage | null> {
  const lifecycle = {
    collection: propertyHandoverInvitationsCollection(adminDb),
    liveQuery: liveHandoverInvitationsQuery(adminDb, handover.id),
    actorUid: input.actorUid,
    nowValue: input.nowValue,
  };
  if (intent.kind !== 'issue') {
    const revocation = await stageLiveInvitationRevocation(tx, lifecycle);
    const link: PropertyHandoverInvitationLink | null = intent.kind === 'no-address' ? { status: 'no-address', checkedAt: input.nowValue } : null;
    return { link, minted: null, commit: revocation.commit };
  }
  let minted: MintedHandoverInvitation;
  try {
    minted = await mintHandoverInvitation({
      companyId: input.companyId, propertyId: handover.propertyId, handoverId: handover.id, contactId: handover.recipientContactId,
      email: intent.email, occasion: intent.occasion, actorUid: input.actorUid, nowValue: input.nowValue,
    });
  } catch (error) {
    // Λείπει ΔΙΚΟ ΜΑΣ μυστικό ⇒ καμία πρόσκληση χωρίς σύνδεσμο. Το δίχτυ ξαναδοκιμάζει όταν ρυθμιστεί.
    logger.error('Δεν εκδόθηκε πρόσκληση αγοραστή — λείπει το μυστικό', { handoverId: handover.id, error: getErrorMessage(error) });
    return null;
  }
  const staged = await stageInvitationWithSupersede(tx, { ...lifecycle, invitation: minted.invitation });
  return { link: issuedLink(minted), minted, commit: staged.commit };
}

/**
 * **Η σκηνή**: κρίση ανά παράδοση + οι αναγνώσεις της. Ό,τι γράφει μπαίνει στο `commit()`· οι παραδόσεις με νέο
 * κάτοπτρο επιστρέφονται για να τις γράψει ο γραφέας **μαζί** με τον κύκλο ζωής τους (ένα `set` ανά έγγραφο).
 */
export async function stageHandoverInvitations(
  tx: Transaction,
  adminDb: AdminFirestore,
  input: HandoverInvitationStageInput,
): Promise<StagedHandoverInvitations> {
  const open = input.handovers.filter((handover) => handover.recipient === null);
  const emails = await recipientEmails(tx, adminDb, input.companyId, open);
  const mirrored = new Map<string, PropertyHandover>();
  const issued: MintedHandoverInvitation[] = [];
  const commits: Array<() => void> = [];

  for (const handover of open) {
    const intent = handoverInvitationIntentOf(handover, emails.get(handover.recipientContactId) ?? null);
    if (intent.kind === 'none') continue;
    const stage = await stageIntent(tx, adminDb, handover, intent, input);
    if (stage === null) continue;
    mirrored.set(handover.id, { ...handover, invitation: stage.link, updatedAt: input.nowValue });
    if (stage.minted !== null) issued.push(stage.minted);
    commits.push(stage.commit);
  }
  return { mirrored, issued, commit: () => commits.forEach((commit) => commit()) };
}
