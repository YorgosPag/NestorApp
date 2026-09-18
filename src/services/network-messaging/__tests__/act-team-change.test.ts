/**
 * @jest-environment node
 *
 * ADR-867 Β5 · ADR-834 §5 Β (ε) ② — ΑΓΚΥΡΕΣ του **κριτή αλλαγής ομάδας** (καθαρός, μηδέν I/O).
 *
 *   Ε-1  🔴 Ξένος προς την ομάδα **δεν** αλλάζει τίποτα — και **δεν μαθαίνει** ποιοι είναι μέλη
 *   Ε-2  Μέλος της ομάδας: συνεργάτες **ναι**, υπεύθυνο **όχι** (Follow Up Boss)
 *   Ε-3  Ο διαχειριστής αλλάζει υπεύθυνο· ο προηγούμενος **μένει** συνεργάτης (Salesforce «Keep Team»)
 *   Ε-4  🔴 Ο υπεύθυνος **δεν αφαιρείται** — αντικαθίσταται (κανένα ορφανό νήμα)
 *   Ε-5  Ο στόχος πρέπει να είναι **ενεργό** μέλος του χώρου για να ΜΠΕΙ — όχι για να ΒΓΕΙ
 *   Ε-6  Ο αντισυμβαλλόμενος **δεν** γίνεται συνεργάτης του γραφείου
 *   Ε-7  🔴 Ομάδα ΞΕΝΟΥ χώρου ⇒ «δεν υπάρχει», **ίδια** απάντηση με την ανύπαρκτη (ADR-742)
 *   Ε-8  🔴 Επανάληψη αιτήματος που ήδη εφαρμόστηκε ⇒ `unchanged`, **όχι** `stale-version`
 *   Ε-9  Πραγματική αλλαγή πάνω σε παλιά έκδοση ⇒ `stale-version`
 *   Ε-10 🏆 Ο διαχειριστής που μπαίνει ΜΟΝΟΣ του φαίνεται ως `admin-self`, όχι ως «προστέθηκε»
 *   Ε-11 Το ίχνος: υπεύθυνος βαθμωτά, μέλη ως συλλογή — τίποτα παραπάνω
 */

import {
  actTeamAuditChanges,
  judgeActTeamChange,
  type ActTeamChange,
  type ActTeamChangeFacts,
} from '@/services/network-messaging/act-team-change';
import type { NetworkActTeam } from '@/types/network-thread';

const HOST = 'comp_alfa';
const MARIA = 'user_maria';
const ELENI = 'user_eleni';
const NIKOS = 'user_nikos';
const ADMIN = 'user_admin';
const OWNER = 'user_kostas';

const TEAM: NetworkActTeam = {
  id: 'nteam_1',
  actKind: 'mandate',
  actSeed: 'ownp_1:comp_alfa',
  hostCompanyId: HOST,
  responsibleUid: MARIA,
  memberUids: [MARIA, ELENI],
  version: 3,
};

function facts(change: ActTeamChange, overrides: Partial<ActTeamChangeFacts> = {}): ActTeamChangeFacts {
  return {
    team: TEAM,
    change,
    actorUid: ADMIN,
    actorWorkspaceId: HOST,
    actorIsManager: true,
    targetIsActiveMember: true,
    counterpartUid: OWNER,
    expectedVersion: TEAM.version,
    ...overrides,
  };
}

const asMember = (uid: string): Partial<ActTeamChangeFacts> => ({ actorUid: uid, actorIsManager: false });

// ============================================================================
describe('Ε — ποιος αλλάζει την ομάδα', () => {
  it('Ε-1 🔴 ξένος προς την ομάδα: άρνηση — ΚΑΙ για αλλαγή που ήδη ισχύει', () => {
    const outsider = asMember(NIKOS);

    expect(judgeActTeamChange(facts({ kind: 'add-collaborator', uid: NIKOS }, outsider)))
      .toStrictEqual({ kind: 'refused', reason: 'not-permitted' });
    // ⚠️ Αν το «ήδη μέλος» προηγούνταν, ο ξένος θα μάθαινε ότι η Ελένη διαβάζει.
    expect(judgeActTeamChange(facts({ kind: 'add-collaborator', uid: ELENI }, outsider)))
      .toStrictEqual({ kind: 'refused', reason: 'not-permitted' });
  });

  it('Ε-2 μέλος της ομάδας: προσθέτει και αφαιρεί συνεργάτες, ΔΕΝ αλλάζει υπεύθυνο', () => {
    const eleni = asMember(ELENI);

    const added = judgeActTeamChange(facts({ kind: 'add-collaborator', uid: NIKOS }, eleni));
    expect(added.kind).toBe('apply');

    const removed = judgeActTeamChange(facts({ kind: 'remove-collaborator', uid: ELENI }, eleni));
    expect(removed.kind).toBe('apply');

    expect(judgeActTeamChange(facts({ kind: 'assign-responsible', uid: ELENI }, eleni)))
      .toStrictEqual({ kind: 'refused', reason: 'not-permitted' });
  });

  it('Ε-3 ο διαχειριστής αλλάζει υπεύθυνο· ο προηγούμενος ΜΕΝΕΙ συνεργάτης', () => {
    const verdict = judgeActTeamChange(facts({ kind: 'assign-responsible', uid: NIKOS }));

    expect(verdict).toStrictEqual({
      kind: 'apply',
      next: { responsibleUid: NIKOS, memberUids: [MARIA, ELENI, NIKOS], version: 4 },
      newcomerReason: 'assigned',
    });
  });

  it('Ε-3β υπεύθυνος που ήταν ήδη συνεργάτης: ΚΑΝΕΝΑ διπλό μέλος', () => {
    const verdict = judgeActTeamChange(facts({ kind: 'assign-responsible', uid: ELENI }));

    expect(verdict.kind).toBe('apply');
    if (verdict.kind !== 'apply') return;
    expect(verdict.next.memberUids).toHaveLength(2);
    expect(verdict.next.memberUids).toStrictEqual([MARIA, ELENI]);
    expect(verdict.next.responsibleUid).toBe(ELENI);
  });

  it('Ε-4 🔴 ο υπεύθυνος ΔΕΝ αφαιρείται — ούτε από τον διαχειριστή', () => {
    expect(judgeActTeamChange(facts({ kind: 'remove-collaborator', uid: MARIA })))
      .toStrictEqual({ kind: 'refused', reason: 'responsible-not-removable' });
  });
});

describe('Ε — ο στόχος', () => {
  it('Ε-5 ανενεργός στον χώρο: δεν ΜΠΑΙΝΕΙ — αλλά ΒΓΑΙΝΕΙ', () => {
    const suspended = { targetIsActiveMember: false };

    expect(judgeActTeamChange(facts({ kind: 'add-collaborator', uid: NIKOS }, suspended)))
      .toStrictEqual({ kind: 'refused', reason: 'target-not-in-workspace' });
    expect(judgeActTeamChange(facts({ kind: 'assign-responsible', uid: NIKOS }, suspended)))
      .toStrictEqual({ kind: 'refused', reason: 'target-not-in-workspace' });
    expect(judgeActTeamChange(facts({ kind: 'remove-collaborator', uid: ELENI }, suspended)).kind)
      .toBe('apply');
  });

  it('Ε-6 ο αντισυμβαλλόμενος δεν γίνεται συνεργάτης του γραφείου', () => {
    expect(judgeActTeamChange(facts({ kind: 'add-collaborator', uid: OWNER })))
      .toStrictEqual({ kind: 'refused', reason: 'target-is-counterpart' });
    expect(judgeActTeamChange(facts({ kind: 'assign-responsible', uid: OWNER })))
      .toStrictEqual({ kind: 'refused', reason: 'target-is-counterpart' });
  });

  it('Ε-7 🔴 ξένος χώρος ⇒ «δεν υπάρχει», ΙΔΙΑ απάντηση με την ανύπαρκτη', () => {
    const foreign = judgeActTeamChange(facts({ kind: 'add-collaborator', uid: NIKOS }, { actorWorkspaceId: 'comp_beta' }));
    const absent = judgeActTeamChange(facts({ kind: 'add-collaborator', uid: NIKOS }, { team: null }));

    expect(foreign).toStrictEqual({ kind: 'refused', reason: 'team-absent' });
    expect(absent).toStrictEqual(foreign);
  });
});

describe('Ε — ταυτόχρονες αλλαγές και επαναλήψεις', () => {
  it('Ε-8 🔴 επανάληψη αιτήματος που ήδη εφαρμόστηκε ⇒ unchanged, ΟΧΙ stale-version', () => {
    // Ο άνθρωπος είδε την έκδοση 2 και πρόσθεσε την Ελένη· η απάντηση χάθηκε, το αίτημα ξαναφεύγει.
    const retry = judgeActTeamChange(facts({ kind: 'add-collaborator', uid: ELENI }, { expectedVersion: 2 }));

    expect(retry).toStrictEqual({ kind: 'unchanged' });
  });

  it('Ε-9 πραγματική αλλαγή πάνω σε παλιά έκδοση ⇒ stale-version', () => {
    const stale = judgeActTeamChange(facts({ kind: 'add-collaborator', uid: NIKOS }, { expectedVersion: 2 }));

    expect(stale).toStrictEqual({ kind: 'refused', reason: 'stale-version' });
  });
});

describe('Ε — η διαφάνεια', () => {
  it('Ε-10 🏆 ο διαχειριστής που μπαίνει ΜΟΝΟΣ του ⇒ admin-self· όποιον άλλον βάζει ⇒ added', () => {
    const self = judgeActTeamChange(facts({ kind: 'add-collaborator', uid: ADMIN }));
    const other = judgeActTeamChange(facts({ kind: 'add-collaborator', uid: NIKOS }));
    const byMember = judgeActTeamChange(facts({ kind: 'add-collaborator', uid: NIKOS }, asMember(ELENI)));

    expect(self.kind === 'apply' && self.newcomerReason).toBe('admin-self');
    expect(other.kind === 'apply' && other.newcomerReason).toBe('added');
    expect(byMember.kind === 'apply' && byMember.newcomerReason).toBe('added');
  });

  it('Ε-11 το ίχνος: ο υπεύθυνος βαθμωτά, τα μέλη ως συλλογή — τίποτα παραπάνω', () => {
    const changes = actTeamAuditChanges(
      { responsibleUid: MARIA, memberUids: [MARIA, ELENI] },
      { responsibleUid: NIKOS, memberUids: [MARIA, NIKOS] },
    );

    expect(changes).toHaveLength(3);
    expect(changes).toStrictEqual([
      { field: 'responsibleUid', oldValue: MARIA, newValue: NIKOS },
      { field: 'memberUids', oldValue: null, newValue: null, kind: 'collection', op: 'added', itemKey: NIKOS, itemLabel: NIKOS },
      { field: 'memberUids', oldValue: null, newValue: null, kind: 'collection', op: 'removed', itemKey: ELENI, itemLabel: ELENI },
    ]);
  });
});
