/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΟΜΑΔΑΣ ΠΡΑΞΗΣ** — ποιος απαντά, από τη στιγμή που γεννιέται η πράξη.
 * @related ADR-867 §4.3 · §6 Β3 · ADR-834 §5 Β (ε) ①-③ · ADR-862 §5.3.6 (μέλη έργου — ίδιο νόημα)
 * @module services/network-messaging/act-team-writer
 *
 * 🔑 **Η ομάδα γεννιέται ΜΕ ΤΗΝ ΠΡΑΞΗ, όχι με το πρώτο μήνυμα** (N.7.2 #1 — προδραστικά).
 * Ένα «τη φτιάχνω όταν χρειαστεί» θα σήμαινε ότι το **πρώτο** μήνυμα του ιδιοκτήτη αποφασίζει
 * ποιος το διαβάζει — δηλαδή ο πελάτης θα όριζε το ακροατήριο του γραφείου.
 *
 * 🔑 **Ιδεμποτής, με ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ κλειδί** (N.7.2 #3): δεύτερη γέννηση της ίδιας πράξης
 * (ανανέωση όρων στο **ίδιο** γραφείο) βρίσκει την **ίδια** ομάδα και **ΔΕΝ** την ξαναγράφει —
 * αλλιώς μια ανανέωση θα **ακύρωνε** μεταβίβαση ευθύνης που έγινε στο ενδιάμεσο.
 *
 * ⚠️ **ΔΥΟ πόρτες, ΕΝΑΣ πυρήνας**: ο δρόμος της αποδοχής έχει **ήδη** συναλλαγή (και όλες τις
 * αναγνώσεις πριν τις γραφές — απαίτηση Firestore), ο δρόμος του μεσίτη **δεν έχει**. Γι' αυτό:
 * {@link readActTeam} + {@link writeActTeamBirth} για την πρώτη, {@link ensureActTeam} για τη
 * δεύτερη. Το **έγγραφο** το χτίζει **μία** συνάρτηση ({@link actTeamDocument}).
 *
 * ⛔ **Κανένας άλλος γραφέας του `network_act_teams`** (ADR-867 §4.3) — και του ακροατηρίου
 * που προβάλλεται από αυτό (Β4).
 */

import 'server-only';

import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore as AdminFirestore,
  Transaction,
} from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeMembership } from '@/lib/auth/workspace-membership';
import { createModuleLogger } from '@/lib/telemetry';
import { workspaceMemberRef } from '@/lib/workspace/workspace-member-ref';
import { EntityAuditService } from '@/services/entity-audit.service';
import { generateDeterministicNetworkActTeamId } from '@/services/enterprise-id.service';
import type { NetworkActKind, NetworkActTeam, NetworkAudienceReason } from '@/types/network-thread';

import {
  actTeamAuditChanges,
  judgeActTeamChange,
  type ActTeamChange,
  type ActTeamChangeRefusal,
  type ActTeamNext,
} from './act-team-change';
import { canServeOnActTeam } from './act-team-eligibility';
import { announceTeamArrivals } from './network-notifier';
import { teamArrivals } from './network-notification-plan';
import type { AudienceWrite } from './thread-audience';
import {
  readActThreadSlot,
  writeActThread,
  type ActThreadOutcome,
  type ActThreadSlot,
} from './thread-writer';

const logger = createModuleLogger('ActTeamWriter');

/** Ό,τι ξέρει η **πράξη** τη στιγμή που γεννιέται — τίποτα για μηνύματα, τίποτα για νήματα. */
export interface ActTeamBirth {
  readonly actKind: NetworkActKind;
  /** Ο σπόρος του μητρώου πηγών (`lib/network-edge/edge-sources.ts`) — **η ίδια** τιμή με το νήμα. */
  readonly actSeed: string;
  readonly hostCompanyId: string;
  /**
   * 🔴 **Ο άνθρωπος που ανέλαβε** — και είναι το πεδίο που **δεν υπήρχε πουθενά** ως τώρα
   * (ADR-867 §2.3): η εντολή κρατά `agencyCompanyId`, όχι άνθρωπο. Ο δρόμος της αποδοχής
   * δίνει τον `deciderUid`, ο δρόμος του μεσίτη τον `attestedByUserId`/`authorUserId`.
   */
  readonly responsibleUid: string;
}

/** Το έγγραφο, με τα δύο πεδία χρόνου που ο τύπος του πυρήνα δεν κουβαλά. */
export interface ActTeamDocument extends NetworkActTeam {
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * **Η γέννηση σε μορφή εγγράφου** — καθαρή, ώστε να ελέγχεται χωρίς Firestore.
 *
 * ⚠️ `memberUids` **περιλαμβάνει** τον υπεύθυνο: **μία** λίστα, όχι δύο που πρέπει να
 * συμφωνούν (ADR-867 §4.3). `version: 1` — η μεταβίβαση το αυξάνει.
 */
export function actTeamDocument(birth: ActTeamBirth, nowISO: string): ActTeamDocument {
  return {
    id: generateDeterministicNetworkActTeamId(birth.actSeed),
    actKind: birth.actKind,
    actSeed: birth.actSeed,
    hostCompanyId: birth.hostCompanyId,
    responsibleUid: birth.responsibleUid,
    memberUids: [birth.responsibleUid],
    version: 1,
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}

/** Το μισό της ιδεμποτησίας που ανήκει στη **φάση ανάγνωσης** μιας ξένης συναλλαγής. */
export interface ActTeamSlot {
  readonly ref: DocumentReference;
  readonly exists: boolean;
  /**
   * 🔴 **Η ΟΜΑΔΑ ΟΠΩΣ ΕΙΝΑΙ ΤΩΡΑ — ΠΡΟΣΤΕΘΗΚΕ ΣΤΟ Β4, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΕΥΚΟΛΙΑ.**
   *
   * Η ανάγνωση γινόταν **ήδη** (`transaction.get`) και το περιεχόμενο **πεταγόταν**. Από
   * τη στιγμή που το ακροατήριο του νήματος είναι **προβολή** της ομάδας (§4.3), ο
   * καλών πρέπει να προβάλει την **πραγματική** ομάδα: σε **ανανέωση όρων** η ομάδα
   * μπορεί να έχει άλλον υπεύθυνο (μεταβίβαση) και περισσότερα μέλη. Χωρίς αυτό, η
   * προβολή θα έγραφε την ομάδα **της γέννησης** — δηλαδή θα **επανέφερε** σιωπηλά τον
   * αρχικό υπεύθυνο στο ακροατήριο και θα **σφράγιζε** τους υπόλοιπους.
   */
  readonly team: NetworkActTeam | null;
}

/**
 * **Η ομάδα που ΙΣΧΥΕΙ** μετά από μια γέννηση: η αποθηκευμένη αν υπάρχει, αλλιώς αυτή
 * που μόλις γεννήθηκε. Ο **ένας** τόπος που απαντά *«ποιους να προβάλω;»*.
 */
export function effectiveActTeam(
  slot: ActTeamSlot,
  birth: ActTeamBirth,
): Pick<NetworkActTeam, 'responsibleUid' | 'memberUids'> {
  return slot.team ?? { responsibleUid: birth.responsibleUid, memberUids: [birth.responsibleUid] };
}

function actTeamRef(adminDb: AdminFirestore, actSeed: string): DocumentReference {
  return actTeamRefById(adminDb, generateDeterministicNetworkActTeamId(actSeed));
}

/** `network_act_teams/{id}` — το μονοπάτι, σε **ένα** σημείο (και για τη μεταβίβαση). */
export function actTeamRefById(adminDb: AdminFirestore, teamId: string): DocumentReference {
  return adminDb.collection(COLLECTIONS.NETWORK_ACT_TEAMS).doc(teamId);
}

/**
 * **Φάση ανάγνωσης** — καλείται μαζί με τα υπόλοιπα `get` της συναλλαγής του καλούντος.
 *
 * ⚠️ **ΠΡΕΠΕΙ** να τρέξει πριν από **κάθε** γραφή της συναλλαγής (απαίτηση Firestore, όχι στυλ).
 */
export async function readActTeam(
  transaction: Transaction,
  adminDb: AdminFirestore,
  actSeed: string,
): Promise<ActTeamSlot> {
  const ref = actTeamRef(adminDb, actSeed);
  const snapshot: DocumentSnapshot = await transaction.get(ref);
  return {
    ref,
    exists: snapshot.exists,
    team: (snapshot.data() as NetworkActTeam | undefined) ?? null,
  };
}

/**
 * **Φάση γραφής** — γράφει **μόνο** όταν δεν υπάρχει· επιστρέφει το id είτε έγραψε είτε όχι.
 *
 * 🔑 Η σιωπή σε υπαρκτή ομάδα **δεν** είναι παράλειψη: είναι ο κανόνας. Ένα `set` με `merge`
 * εδώ θα επανέφερε τον **αρχικό** υπεύθυνο πάνω από μεταβίβαση που έγινε νόμιμα (ε) ②.
 */
export function writeActTeamBirth(
  transaction: Transaction,
  slot: ActTeamSlot,
  birth: ActTeamBirth,
  nowISO: string,
): string {
  const document = actTeamDocument(birth, nowISO);
  if (!slot.exists) transaction.set(slot.ref, document);
  return document.id;
}

/**
 * **Η πόρτα για όποιον ΔΕΝ έχει συναλλαγή** (δρόμος του μεσίτη — `brokered-listing.service.ts`).
 *
 * ⚠️ Δική της συναλλαγή, ώστε η ιδεμποτησία να μην είναι «διάβασε, μετά γράψε» με κενό ανάμεσα:
 * δύο ταυτόχρονες καταχωρίσεις της ίδιας πράξης θα γεννούσαν **δύο** ομάδες με το ίδιο κλειδί —
 * δηλαδή η δεύτερη θα έσβηνε την πρώτη.
 */
export async function ensureActTeam(
  adminDb: AdminFirestore,
  birth: ActTeamBirth,
  nowISO: string,
): Promise<{ readonly id: string; readonly created: boolean }> {
  return adminDb.runTransaction(async (transaction) => {
    const slot = await readActTeam(transaction, adminDb, birth.actSeed);
    const id = writeActTeamBirth(transaction, slot, birth, nowISO);
    return { id, created: !slot.exists };
  });
}

// =============================================================================
// Η ΓΕΝΝΗΣΗ ΤΗΣ ΠΡΑΞΗΣ — ΟΜΑΔΑ ΚΑΙ ΝΗΜΑ, ΣΤΗΝ ΙΔΙΑ ΣΥΝΑΛΛΑΓΗ
// =============================================================================

/** Οι δύο αναγνώσεις που ζητά η γέννηση — και οι δύο **πριν** από κάθε γραφή. */
export interface ActBirthSlots {
  readonly team: ActTeamSlot;
  readonly thread: ActThreadSlot;
}

/**
 * 🔑 **Η ΓΕΝΝΗΣΗ ΤΗΣ ΠΡΑΞΗΣ, ΜΙΑ ΦΟΡΑ** (ADR-867 Β9): ομάδα **και** —όταν υπάρχει ακμή— νήμα, με
 * ακροατήριο = **προβολή της ομάδας που ισχύει**. Ως τώρα το έγραφε μόνη της η αποδοχή, και το
 * backfill έγραφε **μόνο ομάδα** ⇒ κάθε εντολή προ-Β4 έμενε **χωρίς νήμα για πάντα**.
 *
 * `counterpartUid: null` ⇒ **καμία ακμή με πρόσωπο** (ιδιοκτήτης χωρίς λογαριασμό — §8 #1): γράφεται
 * μόνο η ομάδα. Ο αντισυμβαλλόμενος **δεν** υπολογίζεται εδώ· τον δίνει ο καλών από το
 * `mandateEdgesOf` ή από το αίτημα, ώστε «υπάρχει ακμή;» να απαντιέται σε **ένα** μέρος.
 */
export function writeActBirth(
  transaction: Transaction,
  slots: ActBirthSlots,
  birth: ActTeamBirth,
  counterpartUid: string | null,
  nowISO: string,
): ActThreadOutcome {
  writeActTeamBirth(transaction, slots.team, birth, nowISO);
  const topic =
    counterpartUid === null
      ? null
      : {
          kind: 'act' as const,
          actKind: birth.actKind,
          actSeed: birth.actSeed,
          hostCompanyId: birth.hostCompanyId,
          counterpartUid,
        };
  return writeActThread(transaction, slots.thread, {
    birth: topic,
    team: effectiveActTeam(slots.team, birth),
    newcomerReason: 'creator',
    addedBy: birth.responsibleUid,
    nowISO,
  });
}

/** Η πόρτα του {@link writeActBirth} για όποιον **δεν** έχει συναλλαγή (backfill). */
export async function ensureActBirth(
  adminDb: AdminFirestore,
  birth: ActTeamBirth,
  counterpartUid: string | null,
  nowISO: string,
): Promise<{ readonly teamCreated: boolean; readonly thread: ActThreadOutcome }> {
  return adminDb.runTransaction(async (transaction) => {
    const [team, thread] = await Promise.all([
      readActTeam(transaction, adminDb, birth.actSeed),
      readActThreadSlot(transaction, adminDb, birth.actSeed),
    ]);
    const outcome = writeActBirth(transaction, { team, thread }, birth, counterpartUid, nowISO);
    return { teamCreated: !team.exists, thread: outcome };
  });
}

// =============================================================================
// Ο ΕΝΑΣ ΤΟΠΟΣ ΟΠΟΥ Η ΟΜΑΔΑ ΑΠΟΚΤΑ ΝΕΑ ΕΚΔΟΣΗ
// =============================================================================

/** Ποιος μπαίνει, γιατί, από ποιον, πότε — ό,τι χρειάζεται η προβολή πέρα από την ομάδα. */
interface ProjectionContext {
  readonly newcomerReason: NetworkAudienceReason;
  readonly addedBy: string;
  readonly nowISO: string;
}

/**
 * 🔑 **Η ΝΕΑ ΕΚΔΟΣΗ ΤΗΣ ΟΜΑΔΑΣ ΚΑΙ Η ΠΡΟΒΟΛΗ ΤΗΣ — ΑΔΙΑΧΩΡΙΣΤΑ.**
 *
 * 🔴 **ADR-867 Β4 — ΑΛΛΑΓΗ ΧΩΡΙΣ ΤΟ ΑΚΡΟΑΤΗΡΙΟ ΘΑ ΗΤΑΝ ΜΙΣΗ**, και η μισή είναι **χειρότερη**
 * από καμία: η ομάδα θα έλεγε «υπεύθυνη η Ελένη» ενώ ο κανόνας Firestore θα συνέχιζε να δίνει
 * ανάγνωση στον **προηγούμενο** και να την **αρνείται** στην Ελένη.
 *
 * ⚠️ **Κάθε** αλλαγή ομάδας μετά τη γέννηση — αυτόματη μεταβίβαση **ή** ανθρώπινη πράξη —
 * περνά από **εδώ**. Δύο `update` σε δύο συναρτήσεις θα σήμαιναν ότι η τρίτη μπορεί να ξεχάσει
 * την προβολή — και η CHECK 3.89 Κ6 μετρά **ανά αρχείο**, όχι ανά συνάρτηση.
 *
 * `birth: null` ⇒ **αν δεν υπάρχει νήμα, δεν γεννιέται τώρα**: αλλαγή ομάδας δεν είναι ακμή (§8 #1).
 */
export function commitActTeamVersion(
  transaction: Transaction,
  ref: DocumentReference,
  threadSlot: ActThreadSlot,
  next: ActTeamNext,
  projection: ProjectionContext,
): ActThreadOutcome {
  transaction.update(ref, {
    responsibleUid: next.responsibleUid,
    memberUids: next.memberUids,
    version: next.version,
    updatedAt: projection.nowISO,
  });
  return writeActThread(transaction, threadSlot, { birth: null, team: next, ...projection });
}

/**
 * 🔑 **ΟΤΙ ΑΚΟΛΟΥΘΕΙ ΜΙΑ ΝΕΑ ΕΚΔΟΣΗ ΟΜΑΔΑΣ — ΕΝΑΣ ΤΟΠΟΣ** (ADR-867 Β6), ο δίδυμος του
 * {@link commitActTeamVersion}: εκείνος γράφει **μέσα** στη συναλλαγή, αυτός τρέχει **μετά** το commit —
 * **ίχνος** (ADR-834 (ε) ②) **και** ειδοποίηση όσων **μπήκαν** («σου ανατέθηκε» · «αναλάβατε» · «προστεθήκατε»).
 *
 * ⚠️ **Ένας τόπος, όχι δύο κλήσεις σε κάθε γραφέα**: η ανθρώπινη αλλαγή **και** η μεταβίβαση περνούν από
 * εδώ. Αλλιώς ο τρίτος γραφέας ομάδας θα θυμόταν το ίχνος και θα ξεχνούσε τον κληρονόμο — ακριβώς το
 * κενό που άφησε ανοιχτό το Β5 (β): *«ο κληρονόμος φαίνεται στη λίστα, αλλά κανείς δεν του το λέει»*.
 */
export async function settleActTeamChange(
  adminDb: AdminFirestore,
  before: NetworkActTeam,
  after: ActTeamNext,
  context: { readonly performedBy: string; readonly departingUid?: string },
): Promise<void> {
  await recordActTeamChange(before.id, before.hostCompanyId, context.performedBy, before, after);
  await announceTeamArrivals(adminDb, {
    team: { ...before, ...after },
    arrivals: teamArrivals(before, after, {
      actorUid: context.performedBy,
      departure: context.departingUid !== undefined,
    }),
    ...(context.departingUid === undefined ? {} : { departingUid: context.departingUid }),
  });
}

/**
 * **Το ίχνος** (ADR-834 (ε) ② «με ίχνος») — **μετά** τη συναλλαγή: ο γραφέας του ιστορικού
 * κάνει δικές του αναγνώσεις (όνομα εκτελούντος), και μια συναλλαγή δεν δέχεται ανάγνωση μετά
 * από γραφή. ⚠️ Αποτυχία εδώ **δεν** αναιρεί την αλλαγή — την ονομάζει στο log.
 */
async function recordActTeamChange(
  teamId: string,
  hostCompanyId: string,
  performedBy: string,
  before: Pick<NetworkActTeam, 'responsibleUid' | 'memberUids'>,
  after: Pick<NetworkActTeam, 'responsibleUid' | 'memberUids'>,
): Promise<void> {
  const written = await EntityAuditService.recordChange({
    entityType: 'network_act_team',
    entityId: teamId,
    entityName: null,
    action: 'updated',
    changes: actTeamAuditChanges(before, after),
    performedBy,
    performedByName: null,
    companyId: hostCompanyId,
  });
  if (written === null) logger.error('[ACT-TEAM] Το ίχνος δεν γράφτηκε — η αλλαγή ΕΓΙΝΕ', { teamId });
}

// =============================================================================
// Η ΑΝΘΡΩΠΙΝΗ ΑΛΛΑΓΗ — «άλλαξε υπεύθυνο / πρόσθεσε / αφαίρεσε» (ADR-834 (ε) ②)
// =============================================================================

/** Ό,τι φέρνει η πόρτα — ταυτότητα και ικανότητα **ήδη κριμένες** από τους δύο κριτές. */
export interface ActTeamChangeRequest {
  readonly teamId: string;
  readonly change: ActTeamChange;
  readonly actorUid: string;
  /** Ο χώρος του καλούντος (ADR-787) — ξένη ομάδα ⇒ «δεν υπάρχει». */
  readonly actorWorkspaceId: string;
  /** `decideCapability` × `network:act_teams:manage` (ADR-801) — **όχι** λίστα ρόλων εδώ. */
  readonly actorIsManager: boolean;
  readonly expectedVersion: number;
  readonly nowISO: string;
}

export type ActTeamChangeOutcome =
  | {
      readonly kind: 'applied';
      readonly team: ActTeamNext;
      /** Τι είδε ο πελάτης να αλλάζει στη λίστα «ποιοι διαβάζουν». */
      readonly audienceWrites: readonly AudienceWrite[];
    }
  | { readonly kind: 'unchanged' }
  | {
      readonly kind: 'refused';
      readonly reason: ActTeamChangeRefusal;
      /** Μόνο στο `stale-version`: η έκδοση που ισχύει, ώστε η οθόνη να ξαναδιαβάσει. */
      readonly currentVersion: number | null;
    };

type ChangeTxResult =
  | { readonly outcome: ActTeamChangeOutcome; readonly before: null }
  | { readonly outcome: ActTeamChangeOutcome; readonly before: NetworkActTeam };

/**
 * 🔑 **Η αλλαγή ομάδας από άνθρωπο** — ο κριτής αποφασίζει, ο **ένας** τόπος γράφει, το ίχνος
 * καταγράφει.
 *
 * ⚠️ Όλες οι αναγνώσεις **πριν** από κάθε γραφή: ομάδα → (νήμα + έγγραφο μέλους του στόχου).
 * Το έγγραφο μέλους διαβάζεται **μέσα** στη συναλλαγή: ανάμεσα στην οθόνη και στο «πρόσθεσε»
 * ο στόχος μπορεί να έχει ανασταλεί.
 */
export async function changeActTeam(
  adminDb: AdminFirestore,
  request: ActTeamChangeRequest,
): Promise<ActTeamChangeOutcome> {
  const result = await adminDb.runTransaction<ChangeTxResult>((transaction) =>
    changeActTeamInTransaction(transaction, adminDb, request),
  );

  if (result.outcome.kind === 'applied' && result.before !== null) {
    await settleActTeamChange(adminDb, result.before, result.outcome.team, { performedBy: request.actorUid });
  }
  return result.outcome;
}

/**
 * **Η ομάδα, όπως τη βλέπει ένα μέλος του χώρου-οικοδεσπότη** — `null` όταν δεν υπάρχει **ή**
 * ανήκει σε άλλον χώρο: η ίδια απάντηση επίτηδες (ADR-742), όπως το `team-absent` του κριτή.
 *
 * 🔑 Ποιος χειρίζεται μια πράξη το βλέπει **όλο το γραφείο** (Follow Up Boss: ο assigned agent
 * φαίνεται σε όλη την ομάδα). Το **νήμα** όμως μένει στην ομάδα — εκεί κρίνει ο κανόνας.
 */
export async function readActTeamInWorkspace(
  adminDb: AdminFirestore,
  teamId: string,
  workspaceId: string,
): Promise<NetworkActTeam | null> {
  const team = (await actTeamRefById(adminDb, teamId).get()).data() as NetworkActTeam | undefined;
  return team !== undefined && team.hostCompanyId === workspaceId ? team : null;
}

function refused(reason: ActTeamChangeRefusal, currentVersion: number | null): ActTeamChangeOutcome {
  return { kind: 'refused', reason, currentVersion };
}

/** Το σώμα της συναλλαγής: αναγνώσεις → κριτής → ο **ένας** τόπος γραφής. */
async function changeActTeamInTransaction(
  transaction: Transaction,
  adminDb: AdminFirestore,
  request: ActTeamChangeRequest,
): Promise<ChangeTxResult> {
  const ref = actTeamRefById(adminDb, request.teamId);
  const team = ((await transaction.get(ref)).data() as NetworkActTeam | undefined) ?? null;
  // 🔴 Ξένη ομάδα ⇒ **καμία** περαιτέρω ανάγνωση, ούτε μέλους ξένου χώρου.
  if (team === null || team.hostCompanyId !== request.actorWorkspaceId) {
    return { outcome: refused('team-absent', null), before: null };
  }

  const [threadSlot, targetSnap] = await Promise.all([
    readActThreadSlot(transaction, adminDb, team.actSeed),
    transaction.get(workspaceMemberRef(adminDb, team.hostCompanyId, request.change.uid)),
  ]);
  const target = targetSnap.exists ? normalizeMembership(request.change.uid, targetSnap.data()) : null;

  const verdict = judgeActTeamChange({
    ...request,
    team,
    targetIsActiveMember: target !== null && target.status === 'active',
    // 🔑 ADR-867 Ε1β — ο ρόλος του **εγγράφου μέλους**, κριμένος από τον ΕΝΑ κριτή ικανοτήτων.
    targetCanServe: target !== null && canServeOnActTeam(target.globalRole),
    counterpartUid: threadSlot.topic?.counterpartUid ?? null,
  });
  if (verdict.kind === 'unchanged') return { outcome: verdict, before: team };
  if (verdict.kind === 'refused') {
    const current = verdict.reason === 'stale-version' ? team.version : null;
    return { outcome: refused(verdict.reason, current), before: team };
  }

  const written = commitActTeamVersion(transaction, ref, threadSlot, verdict.next, {
    newcomerReason: verdict.newcomerReason,
    addedBy: request.actorUid,
    nowISO: request.nowISO,
  });
  return {
    outcome: { kind: 'applied', team: verdict.next, audienceWrites: written.audienceWrites },
    before: team,
  };
}
