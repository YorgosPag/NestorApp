/**
 * @fileoverview **ΠΟΙΟΣ ΑΛΛΑΖΕΙ ΤΗΝ ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ, ΚΑΙ ΠΩΣ** — καθαρός κριτής, **μηδέν** I/O.
 * @related ADR-867 §4.3 · Β5 · ADR-834 §5 Β (ε) ② («με ίχνος και ΟΡΑΤΑ») · αδελφός: `act-team-writer.ts`
 * @module services/network-messaging/act-team-change
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🌐 Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ (έρευνα 2026-09-18, επίσημη τεκμηρίωση)
 * ─────────────────────────────────────────────────────────────────────────────
 * | Πλατφόρμα | Αλλάζει υπεύθυνο | Προσθέτει/αφαιρεί συνεργάτες |
 * |---|---|---|
 * | Follow Up Boss *(Zillow)* | admin · ISA · team lead | *«Agents can view, add, and remove collaborators from lead profiles they are assigned as … or collaborator of»* |
 * | Salesforce Opportunity Teams | owner · ιεραρχία πάνω του | *«only editable by the Owner … or a user above the owner in the Role Hierarchy»* |
 * | HubSpot deals | όποιος έχει edit | *«Users with Edit deal permissions can add collaborators»* |
 *
 * ⇒ **Δύο διαφορετικά ερωτήματα, δύο διαφορετικοί κριτές**: η **ευθύνη** είναι απόφαση του
 * γραφείου (ρόλος ⇒ `network:act_teams:manage`), η **συνεργασία** είναι απόφαση της ομάδας
 * (σχέση με τον πόρο: *«είσαι μέλος αυτής της ομάδας;»*). Ίδια διάκριση με το Zanzibar/OpenFGA:
 * `can_manage = manager from workspace OR member`. Γι' αυτό ο κριτής **δεν** διαβάζει ρόλους:
 * το «είναι διαχειριστής;» το απαντά **ο ένας κριτής** (`decideCapability`, CHECK 3.68) και
 * φτάνει εδώ ως γεγονός.
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ**:
 * - **Ο πελάτης το ΒΛΕΠΕΙ.** Σε κανέναν από τους τρεις η άλλη πλευρά δεν μαθαίνει ότι άλλαξε
 *   ποιος διαβάζει. Εδώ κάθε αλλαγή γίνεται **προβολή** στη λίστα «ποιοι διαβάζουν», με
 *   **ποιος πρόσθεσε** και **από πότε** (ADR-834 (ε) 🏆), στην **ίδια** συναλλαγή.
 * - **Ο διαχειριστής που μπαίνει ΜΟΝΟΣ του ΦΑΙΝΕΤΑΙ ως τέτοιος** (`admin-self`) και όχι ως
 *   «προστέθηκε»: Follow Up Boss και idealista αφήνουν τον διαχειριστή να διαβάζει **σιωπηλά**.
 * - **Αισιόδοξος έλεγχος έκδοσης** (ETag / `If-Match`): δύο διαχειριστές που αλλάζουν ταυτόχρονα
 *   δεν σβήνει ο ένας την απόφαση του άλλου· ο δεύτερος παίρνει `stale-version`. Και η
 *   **επανάληψη** ενός αιτήματος που ήδη εφαρμόστηκε δίνει `unchanged`, **όχι** σφάλμα: ο έλεγχος
 *   «δεν αλλάζει τίποτα» προηγείται του ελέγχου έκδοσης, επίτηδες (N.7.2 #3).
 *
 * ⚠️ **Ο υπεύθυνος δεν αφαιρείται — ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ.** Μια ομάδα χωρίς υπεύθυνο είναι το
 * **ορφανό νήμα** που το (ε) απαγορεύει. Ο παλιός υπεύθυνος **μένει** συνεργάτης (Salesforce
 * «Keep Opportunity Team»): η συνέχεια του νήματος δεν κόβεται από μια αλλαγή ευθύνης· αν
 * πρέπει να φύγει, είναι **δεύτερη**, ορατή πράξη.
 */

import type { AuditFieldChange } from '@/types/audit-trail';
import type { NetworkActTeam, NetworkAudienceReason } from '@/types/network-thread';

// =============================================================================
// ΤΟ ΛΕΞΙΛΟΓΙΟ
// =============================================================================

/** Οι **τρεις** αλλαγές — κλειστό σύνολο. Καμία «γενική ενημέρωση ομάδας». */
export const ACT_TEAM_CHANGE_KINDS = [
  'assign-responsible',
  'add-collaborator',
  'remove-collaborator',
] as const;
export type ActTeamChangeKind = (typeof ACT_TEAM_CHANGE_KINDS)[number];

export interface ActTeamChange {
  readonly kind: ActTeamChangeKind;
  /** Ο άνθρωπος **πάνω στον οποίο** γίνεται η αλλαγή. */
  readonly uid: string;
}

/**
 * Τα γεγονότα που χρειάζεται ο κριτής — **όλα** διαβασμένα από τον καλούντα μέσα στη
 * συναλλαγή του, **κανένα** από το σώμα του αιτήματος πέρα από την ίδια την αλλαγή.
 */
export interface ActTeamChangeFacts {
  /** Η ομάδα όπως είναι **τώρα** — `null` αν δεν υπάρχει. */
  readonly team: NetworkActTeam | null;
  readonly change: ActTeamChange;
  readonly actorUid: string;
  /** Ο χώρος του καλούντος, όπως τον έκρινε το ADR-787 — **όχι** επιλογή του πελάτη. */
  readonly actorWorkspaceId: string;
  /** Η απάντηση του **ενός** κριτή (`decideCapability` × `network:act_teams:manage`). */
  readonly actorIsManager: boolean;
  /** Είναι ο **στόχος** ενεργό μέλος του χώρου της πράξης; (ADR-787 — `normalizeMembership`) */
  readonly targetIsActiveMember: boolean;
  /** Το πρόσωπο της **άλλης** πλευράς, αν υπάρχει νήμα — δεν γίνεται και μέλος του γραφείου. */
  readonly counterpartUid: string | null;
  /** Η έκδοση που **είδε** ο άνθρωπος όταν αποφάσισε (`If-Match`). */
  readonly expectedVersion: number;
}

export type ActTeamChangeRefusal =
  /** Δεν υπάρχει — **ή** ανήκει σε άλλον χώρο: η απάντηση είναι ίδια επίτηδες (ADR-742). */
  | 'team-absent'
  | 'not-permitted'
  | 'target-not-in-workspace'
  | 'target-is-counterpart'
  | 'responsible-not-removable'
  | 'stale-version';

/** Η **επόμενη** ομάδα — ό,τι γράφεται, χωρίς το πεδίο χρόνου. */
export type ActTeamNext = Pick<NetworkActTeam, 'responsibleUid' | 'memberUids' | 'version'>;

export type ActTeamChangeVerdict =
  | {
      readonly kind: 'apply';
      readonly next: ActTeamNext;
      /** Ο λόγος για όποιον **μπαίνει** στο ακροατήριο με αυτή την αλλαγή. */
      readonly newcomerReason: NetworkAudienceReason;
    }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: ActTeamChangeRefusal };

// =============================================================================
// Ο ΚΡΙΤΗΣ
// =============================================================================

type Standing = 'workspace-manager' | 'team-member' | 'outsider';

function standingOf(team: NetworkActTeam, facts: ActTeamChangeFacts): Standing {
  if (facts.actorIsManager) return 'workspace-manager';
  return team.memberUids.includes(facts.actorUid) ? 'team-member' : 'outsider';
}

/**
 * **Η ευθύνη είναι απόφαση του γραφείου· η συνεργασία, της ομάδας.**
 * ⚠️ Ο έλεγχος προηγείται **κάθε** άλλου: ένας ξένος δεν πρέπει να μαθαίνει ούτε ότι
 * «αυτός είναι ήδη μέλος» — δηλαδή ποιοι διαβάζουν.
 */
function isPermitted(standing: Standing, kind: ActTeamChangeKind): boolean {
  if (standing === 'workspace-manager') return true;
  if (standing === 'team-member') return kind !== 'assign-responsible';
  return false;
}

/** Η αλλαγή **ήδη ισχύει**; — τότε η σωστή απάντηση είναι «τίποτα», όχι σφάλμα. */
function isAlreadyTrue(team: NetworkActTeam, change: ActTeamChange): boolean {
  switch (change.kind) {
    case 'assign-responsible':
      return team.responsibleUid === change.uid;
    case 'add-collaborator':
      return team.memberUids.includes(change.uid);
    case 'remove-collaborator':
      return !team.memberUids.includes(change.uid);
  }
}

/** Οι έλεγχοι που αφορούν τον **στόχο**, με τη σειρά που τους βλέπει ο άνθρωπος. */
function targetRefusal(team: NetworkActTeam, facts: ActTeamChangeFacts): ActTeamChangeRefusal | null {
  const { change } = facts;
  if (change.kind === 'remove-collaborator') {
    return change.uid === team.responsibleUid ? 'responsible-not-removable' : null;
  }
  // 🔑 Ο αντισυμβαλλόμενος δεν γίνεται «συνεργάτης του γραφείου»: η προβολή θα τον κρατούσε
  //    στην πλευρά του πελάτη **σιωπηλά** — δηλαδή «ναι» που δεν θα σήμαινε τίποτα.
  if (facts.counterpartUid !== null && change.uid === facts.counterpartUid) return 'target-is-counterpart';
  // ⚠️ Μόνο για όποιον **μπαίνει**. Η αφαίρεση αναστειλαμένου ανθρώπου πρέπει να δουλεύει.
  if (!facts.targetIsActiveMember) return 'target-not-in-workspace';
  return null;
}

/** Ο λόγος εισόδου — ο διαχειριστής που μπαίνει **μόνος του** το λέει (ADR-834 (ε) ②). */
function newcomerReasonOf(facts: ActTeamChangeFacts): NetworkAudienceReason {
  const { change } = facts;
  if (change.kind === 'assign-responsible') return 'assigned';
  if (change.kind === 'add-collaborator' && facts.actorIsManager && change.uid === facts.actorUid) {
    return 'admin-self';
  }
  return 'added';
}

/** Η επόμενη ομάδα — ο υπεύθυνος **πάντα** μέλος, κανένα μέλος δύο φορές. */
function nextTeam(team: NetworkActTeam, change: ActTeamChange): ActTeamNext {
  const version = team.version + 1;
  switch (change.kind) {
    case 'assign-responsible':
    case 'add-collaborator': {
      const memberUids = team.memberUids.includes(change.uid)
        ? team.memberUids
        : [...team.memberUids, change.uid];
      const responsibleUid = change.kind === 'assign-responsible' ? change.uid : team.responsibleUid;
      return { responsibleUid, memberUids, version };
    }
    case 'remove-collaborator':
      return {
        responsibleUid: team.responsibleUid,
        memberUids: team.memberUids.filter((uid) => uid !== change.uid),
        version,
      };
  }
}

/**
 * 🔑 **Η απόφαση** — `apply` · `unchanged` · `refused`, ποτέ `boolean`.
 *
 * Σειρά: ύπαρξη/χώρος → δικαίωμα → «ήδη ισχύει» → στόχος → έκδοση.
 * ⚠️ Το «ήδη ισχύει» **πριν** από την έκδοση: επανάληψη αιτήματος που πέτυχε ⇒ `unchanged`.
 */
export function judgeActTeamChange(facts: ActTeamChangeFacts): ActTeamChangeVerdict {
  const { team, change } = facts;
  // 🔴 Ξένος χώρος ⇒ «δεν υπάρχει», ΟΧΙ «δεν επιτρέπεται»: αλλιώς η διαδρομή γίνεται
  //    όργανο απαρίθμησης ομάδων άλλων γραφείων (ADR-787 Ε-5 §4 #1 · ADR-742).
  if (team === null || team.hostCompanyId !== facts.actorWorkspaceId) {
    return { kind: 'refused', reason: 'team-absent' };
  }
  if (!isPermitted(standingOf(team, facts), change.kind)) return { kind: 'refused', reason: 'not-permitted' };
  if (isAlreadyTrue(team, change)) return { kind: 'unchanged' };

  const refusal = targetRefusal(team, facts);
  if (refusal !== null) return { kind: 'refused', reason: refusal };
  if (team.version !== facts.expectedVersion) return { kind: 'refused', reason: 'stale-version' };

  return { kind: 'apply', next: nextTeam(team, change), newcomerReason: newcomerReasonOf(facts) };
}

// =============================================================================
// ΤΟ ΙΧΝΟΣ — ίδιο σχήμα με κάθε άλλη οντότητα (ADR-195 Phase 11)
// =============================================================================

/**
 * **Τι άλλαξε**, στη μορφή του ιστορικού: ο υπεύθυνος ως βαθμωτό, τα μέλη ως **συλλογή**
 * (`added`/`removed` ανά `uid`). Καθαρή, ώστε το ίχνος να ελέγχεται χωρίς Firestore.
 *
 * ⚠️ Κλειδιά i18n, **ποτέ** κείμενο (N.11): οι ετικέτες λύνονται στον αναγνώστη του ιστορικού.
 */
export function actTeamAuditChanges(
  before: Pick<NetworkActTeam, 'responsibleUid' | 'memberUids'>,
  after: Pick<NetworkActTeam, 'responsibleUid' | 'memberUids'>,
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];
  if (before.responsibleUid !== after.responsibleUid) {
    changes.push({ field: 'responsibleUid', oldValue: before.responsibleUid, newValue: after.responsibleUid });
  }
  for (const uid of after.memberUids) {
    if (!before.memberUids.includes(uid)) changes.push(memberChange(uid, 'added'));
  }
  for (const uid of before.memberUids) {
    if (!after.memberUids.includes(uid)) changes.push(memberChange(uid, 'removed'));
  }
  return changes;
}

function memberChange(uid: string, op: 'added' | 'removed'): AuditFieldChange {
  return {
    field: 'memberUids',
    oldValue: null,
    newValue: null,
    kind: 'collection',
    op,
    itemKey: uid,
    itemLabel: uid,
  };
}
