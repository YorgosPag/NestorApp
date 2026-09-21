/**
 * @jest-environment node
 *
 * ADR-867 Β5 · ADR-834 §5 Β (ε) ② — ΑΓΚΥΡΕΣ πάνω στον **πραγματικό γραφέα** της ανθρώπινης
 * αλλαγής ομάδας (`changeActTeam`): ομάδα + προβολή ακροατηρίου + ίχνος, μαζί.
 *
 *   Η-1  Ο διαχειριστής προσθέτει συνεργάτη ⇒ νέα έκδοση, **ζωντανή** γραμμή ακροατηρίου
 *        (`added`, από ποιον), και **ίχνος** στο βιβλίο του χώρου-οικοδεσπότη
 *   Η-2  🏆 Ο διαχειριστής που μπαίνει ΜΟΝΟΣ του ⇒ ο πελάτης βλέπει `admin-self`
 *   Η-3  Αλλαγή υπευθύνου ⇒ οι ΡΟΛΟΙ αλλάζουν στο ακροατήριο, το «από πότε» **μένει**
 *   Η-4  Αφαίρεση ⇒ η γραμμή **σφραγίζεται**, δεν σβήνεται
 *   Η-5  🔴 Άρνηση ⇒ **καμία** γραφή, **κανένα** ίχνος
 *   Η-6  🔴 Ο στόχος ανεστάλη ⇒ δεν μπαίνει (το έγγραφο μέλους διαβάζεται ΜΕΣΑ στη συναλλαγή)
 *   Η-7  Ομάδα **χωρίς** νήμα (δρόμος μεσίτη) ⇒ η αλλαγή γίνεται, νήμα **δεν** γεννιέται
 *   Η-8  Η αυτόματη μεταβίβαση γράφει κι αυτή ίχνος — **κάθε** αλλαγή μετά τη γέννηση
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { EntityAuditService } from '@/services/entity-audit.service';
import {
  generateDeterministicNetworkActThreadId,
  generateDeterministicNetworkActTeamId,
} from '@/services/enterprise-id.service';
import {
  actTeamDocument,
  changeActTeam,
  type ActTeamChangeRequest,
} from '@/services/network-messaging/act-team-writer';
import { transferActTeamsOnDeparture } from '@/services/network-messaging/act-team-departure';
import { ensureActThread } from '@/services/network-messaging/thread-writer';
import type { NetworkAudienceEntry } from '@/types/network-thread';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const NOW = '2026-09-17T10:00:00.000Z';
const LATER = '2026-09-18T10:00:00.000Z';
const HOST = 'comp_alfa';
const ACT_SEED = mandateActSeed('ownp_1', HOST);
const TEAM_ID = generateDeterministicNetworkActTeamId(ACT_SEED);
const THREAD_ID = generateDeterministicNetworkActThreadId(ACT_SEED);

const MARIA = 'user_maria';
const ELENI = 'user_eleni';
const ADMIN = 'user_admin';
const OWNER = 'user_kostas';

const MEMBERS_PATH = `${COLLECTIONS.COMPANIES}/${HOST}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`;
const AUDIENCE_PATH = `${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/${SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE}`;

let recordChange: jest.SpyInstance;
beforeEach(() => {
  recordChange = jest.spyOn(EntityAuditService, 'recordChange').mockResolvedValue('eaud_1');
});
afterEach(() => recordChange.mockRestore());

/** Χώρος με τρεις ενεργούς ανθρώπους, ομάδα της Μαρίας, και —αν ζητηθεί— νήμα με τον ιδιοκτήτη. */
async function world(withThread = true): Promise<{ db: AdminFirestore; fake: FakeFirestore }> {
  const fake = new FakeFirestore();
  const db = fake as unknown as AdminFirestore;
  for (const uid of [MARIA, ELENI, ADMIN]) fake.seed(MEMBERS_PATH, uid, { uid, status: 'active', globalRole: 'internal_user' });
  fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, TEAM_ID, {
    ...actTeamDocument({ actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: HOST, responsibleUid: MARIA }, NOW),
  });
  if (withThread) {
    await ensureActThread(db, {
      actSeed: ACT_SEED,
      birth: { kind: 'act', actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: HOST, counterpartUid: OWNER },
      team: { responsibleUid: MARIA, memberUids: [MARIA] },
      newcomerReason: 'creator',
      addedBy: MARIA,
      nowISO: NOW,
    });
  }
  return { db, fake };
}

function request(overrides: Partial<ActTeamChangeRequest>): ActTeamChangeRequest {
  return {
    teamId: TEAM_ID,
    change: { kind: 'add-collaborator', uid: ELENI },
    actorUid: ADMIN,
    actorWorkspaceId: HOST,
    actorIsManager: true,
    expectedVersion: 1,
    nowISO: LATER,
    ...overrides,
  };
}

const teamOf = (fake: FakeFirestore): Record<string, unknown> =>
  JSON.parse(fake.snapshotOf(COLLECTIONS.NETWORK_ACT_TEAMS, TEAM_ID)) as Record<string, unknown>;
const rowOf = (fake: FakeFirestore, uid: string): NetworkAudienceEntry | undefined =>
  fake.all<NetworkAudienceEntry>(AUDIENCE_PATH).find((row) => row.uid === uid);

// ============================================================================
describe('Η — η ανθρώπινη αλλαγή ομάδας, πάνω στον πραγματικό γραφέα', () => {
  it('Η-1 συνεργάτης ⇒ νέα έκδοση + ζωντανή γραμμή + ίχνος στο βιβλίο του χώρου', async () => {
    const { db, fake } = await world();

    const outcome = await changeActTeam(db, request({}));

    expect(outcome.kind).toBe('applied');
    expect(teamOf(fake)).toMatchObject({ memberUids: [MARIA, ELENI], version: 2, updatedAt: LATER });
    expect(rowOf(fake, ELENI)).toMatchObject({
      role: 'collaborator',
      reason: 'added',
      addedBy: ADMIN,
      since: LATER,
      until: null,
    });
    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange.mock.calls[0][0]).toMatchObject({
      entityType: 'network_act_team',
      entityId: TEAM_ID,
      action: 'updated',
      performedBy: ADMIN,
      companyId: HOST,
    });
  });

  it('Η-2 🏆 ο διαχειριστής που μπαίνει μόνος του ⇒ ο πελάτης βλέπει admin-self', async () => {
    const { db, fake } = await world();

    await changeActTeam(db, request({ change: { kind: 'add-collaborator', uid: ADMIN } }));

    expect(rowOf(fake, ADMIN)).toMatchObject({ reason: 'admin-self', addedBy: ADMIN, until: null });
  });

  it('Η-3 αλλαγή υπευθύνου ⇒ οι ρόλοι αλλάζουν, το «από πότε» της Μαρίας ΜΕΝΕΙ', async () => {
    const { db, fake } = await world();
    await changeActTeam(db, request({}));

    await changeActTeam(db, request({ change: { kind: 'assign-responsible', uid: ELENI }, expectedVersion: 2 }));

    expect(teamOf(fake)).toMatchObject({ responsibleUid: ELENI, memberUids: [MARIA, ELENI], version: 3 });
    expect(rowOf(fake, ELENI)).toMatchObject({ role: 'responsible', until: null });
    expect(rowOf(fake, MARIA)).toMatchObject({ role: 'collaborator', since: NOW, until: null });
  });

  it('Η-4 αφαίρεση ⇒ η γραμμή σφραγίζεται, ΔΕΝ σβήνεται', async () => {
    const { db, fake } = await world();
    await changeActTeam(db, request({}));

    await changeActTeam(db, request({ change: { kind: 'remove-collaborator', uid: ELENI }, expectedVersion: 2 }));

    expect(teamOf(fake)).toMatchObject({ memberUids: [MARIA], version: 3 });
    expect(rowOf(fake, ELENI)).toMatchObject({ until: LATER, since: LATER });
  });

  it('Η-5 🔴 άρνηση ⇒ καμία γραφή, κανένα ίχνος', async () => {
    const { db, fake } = await world();
    const writesBefore = fake.writes;

    const outcome = await changeActTeam(db, request({ actorUid: 'user_nikos', actorIsManager: false }));

    expect(outcome).toStrictEqual({ kind: 'refused', reason: 'not-permitted', currentVersion: null });
    expect(fake.writes).toBe(writesBefore);
    expect(teamOf(fake)).toMatchObject({ memberUids: [MARIA], version: 1 });
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('Η-5β παλιά έκδοση ⇒ η άρνηση λέει ΠΟΙΑ ισχύει, ώστε η οθόνη να ξαναδιαβάσει', async () => {
    const { db } = await world();
    await changeActTeam(db, request({}));

    const outcome = await changeActTeam(db, request({ change: { kind: 'add-collaborator', uid: ADMIN } }));

    expect(outcome).toStrictEqual({ kind: 'refused', reason: 'stale-version', currentVersion: 2 });
  });

  it('Η-6 🔴 ο στόχος ανεστάλη ⇒ δεν μπαίνει', async () => {
    const { db, fake } = await world();
    fake.seed(MEMBERS_PATH, ELENI, { uid: ELENI, status: 'suspended' });

    const outcome = await changeActTeam(db, request({}));

    expect(outcome).toStrictEqual({ kind: 'refused', reason: 'target-not-in-workspace', currentVersion: null });
    expect(rowOf(fake, ELENI)).toBeUndefined();
  });

  it('Η-7 ομάδα ΧΩΡΙΣ νήμα ⇒ η αλλαγή γίνεται, νήμα ΔΕΝ γεννιέται', async () => {
    const { db, fake } = await world(false);

    const outcome = await changeActTeam(db, request({}));

    expect(outcome.kind).toBe('applied');
    expect(teamOf(fake)).toMatchObject({ memberUids: [MARIA, ELENI] });
    expect(JSON.parse(fake.snapshotOf(COLLECTIONS.NETWORK_THREADS, THREAD_ID))).toBeNull();
  });

  it('Η-8 η αυτόματη μεταβίβαση γράφει κι αυτή ίχνος', async () => {
    const { db } = await world();

    await transferActTeamsOnDeparture(db, { companyId: HOST, departingUid: MARIA, fallbackUid: ADMIN, performedBy: ADMIN, nowISO: LATER });

    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange.mock.calls[0][0]).toMatchObject({
      entityType: 'network_act_team',
      entityId: TEAM_ID,
      performedBy: ADMIN,
      companyId: HOST,
    });
  });
});
