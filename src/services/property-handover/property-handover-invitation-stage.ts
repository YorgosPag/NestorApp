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
 *
 * 🔑 **Η απούσα ρύθμιση είναι ΕΝΑ σήμα, όχι σφάλμα ανά παράδοση** (ADR-916 §5.6): το «υπάρχει το μυστικό;» ρωτιέται
 *    **μία** φορά, πριν από τον βρόχο, από το SSoT `readConfiguredValue`· οι εκδόσεις που περιμένουν **μετριούνται**
 *    (`awaitingConfiguration`) και τις λέει ο καλών **έξω** από τη συναλλαγή (το σώμα της ξανατρέχει σε σύγκρουση).
 *    Κάθε **άλλη** αποτυχία έκδοσης γράφεται ως `error` με το **πραγματικό** μήνυμα — ποτέ με λάθος διάγνωση.
 */

import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { primaryEmailOf } from '@/lib/contacts/primary-email';
import { readConfiguredValue } from '@/lib/environment/environment-audit';
import { getErrorMessage } from '@/lib/error-utils';
import {
  handoverInvitationIntentOf,
  handoverInvitationRenewalOf,
  type HandoverInvitationIntent,
} from '@/lib/property-handover/handover-invitation-plan';
import { createModuleLogger } from '@/lib/telemetry';
import { stageInvitationWithSupersede, stageLiveInvitationRevocation } from '@/server/invitations/invitation-lifecycle';
import { readOwnedContactDocsInTransaction } from '@/server/lib/owned-contact-docs';
import {
  liveHandoverInvitationsQuery,
  mintHandoverInvitation,
  PROPERTY_HANDOVER_INVITE_SECRET_ENV,
  propertyHandoverInvitationsCollection,
  type MintedHandoverInvitation,
} from '@/server/property-handover-invitations/handover-invitation-kind';
import type { HandoverInvitationRenewalRefusal, PropertyHandover, PropertyHandoverInvitationLink } from '@/types/property-handover';

const logger = createModuleLogger('PropertyHandoverInvitationStage');

/** Φ-Δ.3 — η ρητή πρόθεση του γραφείου. `confirmDeclined` = ο άνθρωπος είδε ότι ο αγοραστής είχε αρνηθεί. */
export interface HandoverInvitationRenewalRequest {
  readonly handoverId: string;
  readonly confirmDeclined: boolean;
}

/** Τι έγινε με τη ρητή πρόθεση — `failed` = πραγματική βλάβη στην έκδοση (ήδη στο ημερολόγιο). */
export type HandoverInvitationRenewalOutcome =
  | { readonly kind: 'renewed'; readonly invitationId: string }
  | { readonly kind: 'refused'; readonly reason: HandoverInvitationRenewalRefusal }
  | { readonly kind: 'failed' };

export interface HandoverInvitationStageInput {
  readonly companyId: string;
  /** Οι παραδόσεις του ακινήτου **όπως θα γραφτούν** (μετά το σχέδιο κύκλου ζωής). */
  readonly handovers: readonly PropertyHandover[];
  /** uid του δρώντα — `'system'` για δίχτυ και γραφέα νομικής φάσης· ο **άνθρωπος** στη ρητή πρόθεση (Φ-Δ.3). */
  readonly actorUid: string;
  readonly nowValue: string;
  /** Φ-Δ.3 — «το γραφείο ζητά νέα πρόσκληση» για **μία** παράδοση· απούσα ⇒ καθαρή συμφιλίωση. */
  readonly renewal?: HandoverInvitationRenewalRequest;
}

export interface StagedHandoverInvitations {
  /** Οι παραδόσεις των οποίων **άλλαξε** το κάτοπτρο — με το νέο κάτοπτρο, για εγγραφή. */
  readonly mirrored: ReadonlyMap<string, PropertyHandover>;
  /** Οι νέες προσκλήσεις — το email τους φεύγει **μετά** το commit. */
  readonly issued: readonly MintedHandoverInvitation[];
  /** Εκδόσεις που **οφείλονται** αλλά περιμένουν το μυστικό των συνδέσμων — το δίχτυ τις εκδίδει όταν ρυθμιστεί. */
  readonly awaitingConfiguration: number;
  /** Φ-Δ.3 — η έκβαση της ρητής πρόθεσης· `null` όταν δεν ζητήθηκε. */
  readonly renewal: HandoverInvitationRenewalOutcome | null;
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
      supersedesInvitationId: handover.invitation?.status === 'issued' ? handover.invitation.invitationId : null,
    });
  } catch (error) {
    // Το μυστικό ελέγχθηκε πριν από τον βρόχο ⇒ εδώ φτάνει ΜΟΝΟ πραγματική βλάβη: το λέμε με το δικό της όνομα.
    // Η παράδοση μένει χωρίς κάτοπτρο ⇒ το δίχτυ ξαναδοκιμάζει· ο κύκλος ζωής δεν θυσιάζεται για την πρόσκληση.
    logger.error('Δεν εκδόθηκε πρόσκληση αγοραστή', { handoverId: handover.id, error: getErrorMessage(error) });
    return null;
  }
  const staged = await stageInvitationWithSupersede(tx, { ...lifecycle, invitation: minted.invitation });
  return { link: issuedLink(minted), minted, commit: staged.commit };
}

/** Η πρόθεση για μία παράδοση: η συμφιλίωση πρώτα· η ρητή πρόθεση του γραφείου **μόνο** αν η συμφιλίωση δεν κάνει τίποτα. */
interface Decision {
  readonly intent: HandoverInvitationIntent;
  /** Η ρητή πρόθεση αφορούσε αυτή την παράδοση και η κρίση την αρνήθηκε. */
  readonly refused: HandoverInvitationRenewalRefusal | null;
}

function decide(handover: PropertyHandover, email: string | null, input: HandoverInvitationStageInput): Decision {
  const reconcile = handoverInvitationIntentOf(handover, email);
  const { renewal } = input;
  if (renewal === undefined || renewal.handoverId !== handover.id || reconcile.kind !== 'none') return { intent: reconcile, refused: null };
  const renewed = handoverInvitationRenewalOf(handover, email, input.nowValue, renewal.confirmDeclined);
  return renewed.kind === 'refused' ? { intent: reconcile, refused: renewed.reason } : { intent: renewed, refused: null };
}

/**
 * Φ-Δ.3 — η έκβαση της ρητής πρόθεσης. Αν η **συμφιλίωση** εξέδωσε ήδη (π.χ. άλλαξε το email), η πρόθεση ικανοποιήθηκε·
 * αν ανακάλεσε ή βρήκε κενό email, **δεν** στάλθηκε τίποτα — και το λέμε.
 */
function renewalOutcomeOf(decision: Decision, linksConfigured: boolean, stage: IntentStage | null): HandoverInvitationRenewalOutcome {
  if (decision.refused !== null) return { kind: 'refused', reason: decision.refused };
  const { intent } = decision;
  if (intent.kind === 'no-address') return { kind: 'refused', reason: 'no-address' };
  if (intent.kind !== 'issue') return { kind: 'refused', reason: 'not-renewable' };
  if (!linksConfigured) return { kind: 'refused', reason: 'awaiting-configuration' };
  return stage?.minted ? { kind: 'renewed', invitationId: stage.minted.invitation.id } : { kind: 'failed' };
}

/** Φ-Δ.3 — ζητήθηκε νέα για παράδοση που **δεν** είναι ανοιχτή: αποδεκτή (υπάρχει) ⇒ `not-renewable` · άγνωστη ⇒ `handover-unknown`. */
function closedRenewalOutcomeOf(input: HandoverInvitationStageInput): HandoverInvitationRenewalOutcome | null {
  const { renewal } = input;
  if (renewal === undefined) return null;
  const known = input.handovers.some((handover) => handover.id === renewal.handoverId);
  return { kind: 'refused', reason: known ? 'not-renewable' : 'handover-unknown' };
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
  const linksConfigured = readConfiguredValue(process.env, PROPERTY_HANDOVER_INVITE_SECRET_ENV) !== null;
  let awaitingConfiguration = 0;
  let renewal = closedRenewalOutcomeOf(input);

  for (const handover of open) {
    const decision = decide(handover, emails.get(handover.recipientContactId) ?? null, input);
    const { intent } = decision;
    // Χωρίς μυστικό καμία έκδοση (σύνδεσμος που δεν θα άνοιγε)· η ανάκληση όμως δεν το χρειάζεται και γίνεται κανονικά.
    const blocked = intent.kind === 'issue' && !linksConfigured;
    if (blocked) awaitingConfiguration += 1;
    const stage = intent.kind === 'none' || blocked ? null : await stageIntent(tx, adminDb, handover, intent, input);
    if (handover.id === input.renewal?.handoverId) renewal = renewalOutcomeOf(decision, linksConfigured, stage);
    if (stage === null) continue;
    mirrored.set(handover.id, { ...handover, invitation: stage.link, updatedAt: input.nowValue });
    if (stage.minted !== null) issued.push(stage.minted);
    commits.push(stage.commit);
  }
  return { mirrored, issued, awaitingConfiguration, renewal, commit: () => commits.forEach((commit) => commit()) };
}
