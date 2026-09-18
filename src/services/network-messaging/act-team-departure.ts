/**
 * @fileoverview **Η ΑΠΟΧΩΡΗΣΗ** — ποιος κληρονομεί την ευθύνη μιας πράξης όταν ο υπεύθυνος φεύγει,
 * και η μεταβίβαση που την εκτελεί (ADR-834 §5 Β (ε) 🏆 «κανένα ορφανό νήμα, ποτέ» · ADR-867 Β3/Β5).
 * @module services/network-messaging/act-team-departure
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🌐 Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ (έρευνα 2026-09-18, επίσημη τεκμηρίωση)
 * ─────────────────────────────────────────────────────────────────────────────
 * | Πλατφόρμα | Όταν φεύγει ο κάτοχος |
 * |---|---|
 * | [Microsoft 365 / OneDrive](https://learn.microsoft.com/en-us/sharepoint/retention-and-deletion) | *«the user's manager is **automatically** given access»* · αν δεν υπάρχει manager, ο **secondary owner που όρισε ο οργανισμός** — με email ειδοποίηση |
 * | [Salesforce](https://help.salesforce.com/s/articleView?language=en_US&id=platform.users_deactivate_considerations.htm&type=5) | *«Deactivation does not change ownership»* — χειροκίνητη μεταβίβαση |
 * | [HubSpot](https://knowledge.hubspot.com/user-management/remove-hubspot-users) | «Deactivated/Removed» στον κάτοχο — χειροκίνητη ανάθεση |
 *
 * ⇒ **Microsoft 365**, γιατί είναι ο μόνος χωρίς ορφανό διάστημα (το (ε) απορρίπτει ρητά τα
 * Salesforce/HubSpot). Και η **κρίσιμη** λεπτομέρεια του: ο κληρονόμος είναι **πάντα άνθρωπος του
 * ίδιου οργανισμού** — ποτέ ο χειριστής της πλατφόρμας που έκανε τη διαγραφή.
 *
 * 🔴 **ΓΙΑΤΙ ΞΑΝΑΓΡΑΦΤΗΚΕ (ADR-867 Β5)**: το Β3 έδινε την ευθύνη σε **«όποιον έκανε την αναστολή»**.
 * Οι **δύο** διαδρομές αποχώρησης (`…/users/[uid]/status` · `…/identity-remediation`) απαιτούν
 * `BYPASS_ROLES` — δηλαδή τις τρέχει ο **super_admin**. Σε **ξένο** γραφείο, ο super_admin γινόταν
 * υπεύθυνος πράξης, άρα **αναγνώστης ιδιωτικών νημάτων** — ό,τι αρνείται η ζωντανή άγκυρα Ζ2.
 *
 * 🔑 **Ο ΚΑΝΟΝΑΣ** ({@link resolveDepartureHeir}), με σειρά:
 *   1. **Επόμενο μέλος της ομάδας** (ο μόνος που ήδη ξέρει την υπόθεση — `nextResponsible`).
 *   2. Ο δρων, **αν είναι πραγματικό μέλος** του γραφείου (η συμπεριφορά του Β3, όπου ήταν σωστή).
 *   3. Ο **παλαιότερος ενεργός διαχειριστής του ίδιου γραφείου** — το «secondary owner» του M365,
 *      κριμένος από τον **έναν** κριτή ικανότητας (`decideCapability`), ποτέ από λίστα ρόλων (3.68).
 *   4. **Κανείς** ⇒ η ομάδα μένει όπως είναι και το ορφανό **ονομάζεται** (log + `orphaned`).
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ**: ο M365 δίνει στον manager **πρόσβαση**, σιωπηλά για τον έξω κόσμο. Εδώ ο
 * κληρονόμος **φαίνεται στον πελάτη** (λόγος `failover`, με «από πότε»), και η αλλαγή γράφει ίχνος.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { decideCapability } from '@/lib/auth/authority';
import { listMemberWorkspaces, normalizeMembership } from '@/lib/auth/workspace-membership';
import { createModuleLogger } from '@/lib/telemetry';
import { workspaceMembersCollection } from '@/lib/workspace/workspace-member-ref';
import { isGranted } from '@/types/capability-authority';
import type { NetworkActTeam } from '@/types/network-thread';

import type { ActTeamNext } from './act-team-change';
import { actTeamRefById, commitActTeamVersion, recordActTeamChange } from './act-team-writer';
import { readActThreadSlot } from './thread-writer';

const logger = createModuleLogger('ActTeamDeparture');

// =============================================================================
// Ο ΚΛΗΡΟΝΟΜΟΣ ΤΟΥ ΓΡΑΦΕΙΟΥ
// =============================================================================

/** Ένα μέλος του χώρου, όπως το χρειάζεται ο κριτής κληρονόμου. */
export interface HeirCandidate {
  readonly uid: string;
  readonly globalRole: string | null;
  readonly active: boolean;
  /** Πότε έγινε μέλος — `Infinity` αν δεν ξέρουμε (πάει **τελευταίος**, ποτέ πρώτος). */
  readonly joinedAtMs: number;
}

/**
 * **Ο παλαιότερος ενεργός διαχειριστής** (ισοπαλία ⇒ `uid`, ώστε η απάντηση να είναι ντετερμινιστική).
 *
 * ⚠️ Το «διαχειριστής» **δεν** γράφεται εδώ ως ρόλος: ρωτιέται ο **ένας** κριτής αν το μέλος έχει
 * την ικανότητα που χρειάζεται ο κληρονόμος — `network:act_teams:manage`, η ίδια με το «άλλαξε
 * υπεύθυνο». Όποιος μπορεί να **αναθέσει**, μπορεί και να **κληρονομήσει**.
 */
export function pickOfficeHeir(candidates: readonly HeirCandidate[], departingUid: string): string | null {
  const eligible = candidates.filter(
    (c) =>
      c.active &&
      c.uid !== departingUid &&
      isGranted(decideCapability({ subject: { globalRole: c.globalRole }, action: 'network:act_teams:manage' }).verdict),
  );
  const sorted = [...eligible].sort((a, b) => a.joinedAtMs - b.joinedAtMs || a.uid.localeCompare(b.uid));
  return sorted[0]?.uid ?? null;
}

/** `joinedAt` σε χιλιοστά — Timestamp, ISO ή τίποτα (το τελευταίο ⇒ `Infinity`). */
function millisOf(value: unknown): number {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const toMillis = (value as { readonly toMillis: unknown }).toMillis;
    if (typeof toMillis === 'function') return Number(toMillis.call(value));
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * 🔑 **Ποιος κληρονομεί σε ΑΥΤΟ το γραφείο** αν η ομάδα δεν έχει άλλο μέλος — ή `null`.
 *
 * ⚠️ Ο δρων κληρονομεί **μόνο** αν είναι **πραγματικό** μέλος του γραφείου (`home` · `member`) — ο
 * super_admin σε ξένο χώρο (`platform-bypass`) **ποτέ**.
 */
export async function resolveDepartureHeir(
  adminDb: AdminFirestore,
  input: {
    readonly companyId: string;
    readonly departingUid: string;
    readonly actorUid: string;
    readonly actorIsMember: boolean;
  },
): Promise<string | null> {
  if (input.actorIsMember && input.actorUid !== input.departingUid) return input.actorUid;
  const snapshot = await workspaceMembersCollection(adminDb, input.companyId).where('status', '==', 'active').get();
  const candidates = snapshot.docs.map((doc) => {
    const member = normalizeMembership(doc.id, doc.data());
    return {
      uid: member.uid,
      globalRole: member.globalRole === '' ? null : member.globalRole,
      active: member.status === 'active',
      joinedAtMs: millisOf(member.joinedAt),
    };
  });
  return pickOfficeHeir(candidates, input.departingUid);
}

/**
 * **Αποχώρηση από ΟΛΑ τα γραφεία** — για την πράξη που κλείνει τον άνθρωπο **σε όλη την πλατφόρμα**
 * (`identity-remediation`: `external_user` + `suspended` στο `users/{uid}`). Ένας κληρονόμος **ανά
 * γραφείο**, από τους **δικούς του** ανθρώπους.
 *
 * ⚠️ `unknown` στη λίστα χώρων ⇒ **ρίχνει με όνομα**: «δεν μπόρεσα να ρωτήσω» δεν είναι «σε κανέναν».
 */
export async function transferActTeamsOnPlatformDeparture(
  adminDb: AdminFirestore,
  input: {
    readonly departingUid: string;
    readonly actorUid: string;
    /** Ο χώρος όπου ο δρων είναι πραγματικό μέλος, ή `null`. */
    readonly actorMemberWorkspaceId: string | null;
    readonly nowISO: string;
  },
): Promise<{ readonly transferred: number; readonly orphaned: number }> {
  const workspaces = await listMemberWorkspaces(input.departingUid);
  if (workspaces.outcome !== 'ok') throw new Error(`workspace list unknown: ${workspaces.reason}`);

  let transferred = 0;
  let orphaned = 0;
  for (const companyId of workspaces.companyIds) {
    const fallbackUid = await resolveDepartureHeir(adminDb, {
      companyId,
      departingUid: input.departingUid,
      actorUid: input.actorUid,
      actorIsMember: input.actorMemberWorkspaceId === companyId,
    });
    const outcome = await transferActTeamsOnDeparture(adminDb, {
      companyId,
      departingUid: input.departingUid,
      fallbackUid,
      performedBy: input.actorUid,
      nowISO: input.nowISO,
    });
    transferred += outcome.transferred;
    orphaned += outcome.orphaned;
  }
  return { transferred, orphaned };
}

// =============================================================================
// Η ΜΕΤΑΒΙΒΑΣΗ — «κανένα ορφανό νήμα, ΠΟΤΕ» (ADR-834 §5 Β (ε) 🏆)
// =============================================================================

/** Ποιος φεύγει, ποιος κληρονομεί αν δεν μένει κανείς, ποιος έκανε την πράξη, πότε. */
export interface DepartureTransfer {
  readonly companyId: string;
  readonly departingUid: string;
  /**
   * 🔑 **Ο τελευταίος καταφύγιος — ΑΝΘΡΩΠΟΣ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΓΡΑΦΕΙΟΥ, ή κανείς.**
   *
   * 🔴 **ADR-867 Β5 — ΤΟ Β3 ΕΒΑΖΕ ΕΔΩ «ΟΠΟΙΟΝ ΕΚΑΝΕ ΤΗΝ ΑΝΑΣΤΟΛΗ», ΚΑΙ ΗΤΑΝ ΔΙΑΡΡΟΗ**: οι δύο
   * διαδρομές αποχώρησης τρέχουν από **super_admin** (`BYPASS_ROLES`). Σε **ξένο** γραφείο, ο
   * super_admin γινόταν υπεύθυνος — δηλαδή **αναγνώστης ιδιωτικών νημάτων** (Ζ2). Τον κληρονόμο
   * τον αποφασίζει πλέον το `act-team-departure.ts` (πρότυπο Microsoft 365: manager ⇒ secondary
   * owner **του ίδιου οργανισμού**). `null` ⇒ **κανείς** — ποτέ ξένος.
   */
  readonly fallbackUid: string | null;
  /** **Ποιος έκανε την αναστολή** — για το ίχνος και το «από ποιον». Δεν είναι απαραίτητα ο κληρονόμος. */
  readonly performedBy: string;
  readonly nowISO: string;
}

/**
 * **Ο κανόνας, καθαρός**: επόμενο μέλος της ομάδας· αν δεν υπάρχει, ο κληρονόμος του γραφείου.
 *
 * ⚠️ **Ποτέ «ο ίδιος»**. `null` **μόνο** όταν το γραφείο δεν έχει **κανέναν** ενεργό διαχειριστή —
 * και τότε το ορφανό **ονομάζεται** (log + μέτρηση), δεν «λύνεται» με ξένο αναγνώστη.
 */
export function nextResponsible(
  team: { readonly memberUids: readonly string[] },
  departingUid: string,
  fallbackUid: string | null,
): string | null {
  const heir = team.memberUids.find((uid) => uid !== departingUid) ?? fallbackUid;
  return heir === departingUid ? null : heir;
}

/** Η **επόμενη έκδοση** της ομάδας μετά την αποχώρηση — καθαρή, ώστε να ελέγχεται μόνη της. */
export function teamAfterDeparture(
  team: NetworkActTeam,
  transfer: DepartureTransfer,
): (Pick<NetworkActTeam, 'responsibleUid' | 'memberUids' | 'version'> & { readonly updatedAt: string }) | null {
  const heir = nextResponsible(team, transfer.departingUid, transfer.fallbackUid);
  if (heir === null) return null;
  const remaining = team.memberUids.filter((uid) => uid !== transfer.departingUid);
  return {
    responsibleUid: heir,
    // ⚠️ Ο κληρονόμος μπαίνει στα μέλη **μία** φορά: ο διαχειριστής που μπαίνει είναι
    //    **ορατός** στο ακροατήριο (ADR-834 (ε) ②) — καμία σιωπηλή ανάγνωση.
    memberUids: remaining.includes(heir) ? remaining : [...remaining, heir],
    version: team.version + 1,
    updatedAt: transfer.nowISO,
  };
}

/**
 * **Η αποχώρηση παράγει ξανά την ευθύνη** — για **κάθε** πράξη που κρατούσε ο αποχωρών.
 *
 * ⚠️ **Η αποχώρηση ΔΕΝ είναι διαγραφή μέλους** (μετρημένο 2026-09-17, ADR-867 §8 #5):
 * **κανείς** δεν σβήνει `workspace_members`. Η αποχώρηση εκφράζεται ως **κατάσταση**
 * (`status: suspended` + Firebase Auth `disabled`), και **αυτοί** είναι οι γραφείς που
 * καλούν αυτή τη συνάρτηση.
 *
 * ⚠️ **Μία συναλλαγή ανά ομάδα**, όχι μία για όλες: το πλήθος είναι **αφράγκτο** και μια
 * συναλλαγή Firestore έχει όριο. Κάθε ομάδα μεταβιβάζεται **ατομικά** — μερική επιτυχία
 * αφήνει **λιγότερα** ορφανά, ποτέ ασυνεπή ομάδα.
 */
export async function transferActTeamsOnDeparture(
  adminDb: AdminFirestore,
  transfer: DepartureTransfer,
): Promise<{ readonly transferred: number; readonly orphaned: number }> {
  // tenant-scope-exempt: το φίλτρο **ΕΙΝΑΙ** ο άξονας μισθωτή αυτής της συλλογής
  //   (`hostCompanyId`, tenant-config) — δηλωμένο ρητά επειδή το όνομα δεν είναι `companyId`.
  const snapshot = await adminDb
    .collection(COLLECTIONS.NETWORK_ACT_TEAMS)
    .where('hostCompanyId', '==', transfer.companyId)
    .where('responsibleUid', '==', transfer.departingUid)
    .get();

  let transferred = 0;
  let orphaned = 0;
  for (const doc of snapshot.docs) {
    const change = await transferOneTeam(adminDb, doc.id, transfer);
    if (change === 'orphaned') {
      orphaned += 1;
      logger.error('[ACT-TEAM] Ορφανή ομάδα: κανείς ενεργός διαχειριστής στο γραφείο', { teamId: doc.id });
    }
    if (change === 'untouched' || change === 'orphaned') continue;
    transferred += 1;
    await recordActTeamChange(doc.id, transfer.companyId, transfer.performedBy, change.before, change.after);
  }
  return { transferred, orphaned };
}

/** Η μεταβίβαση **μιας** ομάδας, σε δική της συναλλαγή. */
async function transferOneTeam(
  adminDb: AdminFirestore,
  teamId: string,
  transfer: DepartureTransfer,
): Promise<'untouched' | 'orphaned' | { readonly before: NetworkActTeam; readonly after: ActTeamNext }> {
  const ref = actTeamRefById(adminDb, teamId);
  return adminDb.runTransaction(async (transaction) => {
    const team = (await transaction.get(ref)).data() as NetworkActTeam | undefined;
    // 🔑 **Ξαναδιαβάζουμε μέσα στη συναλλαγή**: αν κάποιος μεταβίβασε ήδη στο ενδιάμεσο,
    //    η ομάδα **δεν** αγγίζεται — αλλιώς θα κλέβαμε ευθύνη από τον νέο υπεύθυνο.
    if (team === undefined || team.responsibleUid !== transfer.departingUid) return 'untouched' as const;

    // ⚠️ Η ανάγνωση **πριν** από κάθε γραφή (απαίτηση Firestore) — γι' αυτό εδώ.
    const threadSlot = await readActThreadSlot(transaction, adminDb, team.actSeed);
    const next = teamAfterDeparture(team, transfer);
    if (next === null) return 'orphaned' as const;
    commitActTeamVersion(transaction, ref, threadSlot, next, {
      newcomerReason: 'failover',
      addedBy: transfer.performedBy,
      nowISO: transfer.nowISO,
    });
    return { before: team, after: next };
  });
}

