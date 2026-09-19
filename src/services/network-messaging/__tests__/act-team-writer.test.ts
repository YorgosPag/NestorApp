/**
 * @jest-environment node
 *
 * ADR-867 §4.3 · §6 Β3 — ΑΓΚΥΡΕΣ του **ενός γραφέα της ομάδας πράξης**.
 *
 *   Ο-1  Η ομάδα γεννιέται με **ντετερμινιστικό** κλειδί, και ο υπεύθυνος είναι **μέσα** στα μέλη
 *   Ο-2  🔴 **Ιδεμποτής**: δεύτερη γέννηση ⇒ **ίδιο** έγγραφο, **καμία** δεύτερη γραφή
 *   Ο-3  🔴 Δεύτερη γέννηση **ΔΕΝ ΕΠΑΝΑΦΕΡΕΙ** υπεύθυνο που άλλαξε νόμιμα (ε) ②
 *   Ο-4  Δύο διαφορετικές πράξεις ⇒ δύο ομάδες
 *   Ο-5  Ο σπόρος είναι ο **ΙΔΙΟΣ** με του κριτή ακμής — μία πράξη, ένα νήμα, μία ομάδα
 *   Γ-1  (Β9) Η γέννηση της πράξης: ομάδα **ΚΑΙ** νήμα, ακροατήριο = υπεύθυνος + αντισυμβαλλόμενος
 *   Γ-2  🔴 Δεύτερη γέννηση ⇒ **καμία** γραφή (το backfill ξανατρέχει ακίνδυνα)
 *   Γ-3  🔴 Χωρίς πρόσωπο στην άλλη πλευρά ⇒ ομάδα ναι, νήμα **όχι** (§8 #1)
 *   Γ-4  🔴 Υπάρχουσα ομάδα με μεταβίβαση ⇒ το νήμα προβάλλει την ομάδα που **ισχύει**, όχι τη γέννηση
 *   Δ-1  🔴 Ιδιοκτήτης ΚΑΙ υπεύθυνος ⇒ **μία** θέση `counterpart` με `alsoHostRole` (όχι χαμένη ιδιότητα)
 *   Δ-2  Γραμμή προ-Β9 ⇒ η πρώτη προβολή τη **συμπληρώνει**, η δεύτερη **δεν** γράφει
 *   Δ-3  Ο ιδιοκτήτης βγαίνει από την ομάδα ⇒ `alsoHostRole: null`, η θέση του **μένει**
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { mandateActSeed, mandateEdgesOf } from '@/lib/network-edge/edge-sources';
import { brokeredMandate } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import {
  generateDeterministicNetworkActTeamId,
  generateDeterministicNetworkActThreadId,
} from '@/services/enterprise-id.service';
import {
  actTeamDocument,
  ensureActBirth,
  ensureActTeam,
  type ActTeamBirth,
} from '@/services/network-messaging/act-team-writer';
import { projectActAudience } from '@/services/network-messaging/thread-audience';
import type { NetworkAudienceEntry } from '@/types/network-thread';
import { nextResponsible, transferActTeamsOnDeparture } from '@/services/network-messaging/act-team-departure';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const NOW = '2026-09-17T10:00:00.000Z';
const LATER = '2026-11-01T10:00:00.000Z';
const BIRTH: ActTeamBirth = {
  actKind: 'mandate',
  actSeed: mandateActSeed('ownp_1', 'comp_alfa'),
  hostCompanyId: 'comp_alfa',
  responsibleUid: 'user_maria',
};

function freshDb(): { db: AdminFirestore; fake: FakeFirestore } {
  const fake = new FakeFirestore();
  return { db: fake as unknown as AdminFirestore, fake };
}

function storedTeam(fake: FakeFirestore, seed: string): Record<string, unknown> | null {
  const raw = fake.snapshotOf(COLLECTIONS.NETWORK_ACT_TEAMS, generateDeterministicNetworkActTeamId(seed));
  return JSON.parse(raw) as Record<string, unknown> | null;
}

// ============================================================================
describe('Ο — η ομάδα της πράξης', () => {
  it('Ο-1 γεννιέται με ντετερμινιστικό κλειδί· ο υπεύθυνος είναι ΜΕΣΑ στα μέλη', async () => {
    const { db, fake } = freshDb();

    const born = await ensureActTeam(db, BIRTH, NOW);

    expect(born.created).toBe(true);
    expect(born.id).toBe(generateDeterministicNetworkActTeamId(BIRTH.actSeed));
    expect(storedTeam(fake, BIRTH.actSeed)).toMatchObject({
      actKind: 'mandate',
      hostCompanyId: 'comp_alfa',
      responsibleUid: 'user_maria',
      memberUids: ['user_maria'],
      version: 1,
      createdAt: NOW,
    });
  });

  it('Ο-2 δεύτερη γέννηση ⇒ ΙΔΙΟ έγγραφο, καμία δεύτερη γραφή', async () => {
    const { db, fake } = freshDb();

    const first = await ensureActTeam(db, BIRTH, NOW);
    const second = await ensureActTeam(db, BIRTH, LATER);

    expect(second.id).toBe(first.id);
    expect(second.created).toBe(false);
    expect(storedTeam(fake, BIRTH.actSeed)).toMatchObject({ createdAt: NOW, version: 1 });
  });

  it('Ο-3 🔴 ανανέωση εντολής ΔΕΝ επαναφέρει υπεύθυνο που άλλαξε νόμιμα', async () => {
    const { db, fake } = freshDb();
    await ensureActTeam(db, BIRTH, NOW);

    // Η μεταβίβαση (ε) ② — όπως θα τη γράψει ο γραφέας μεταβίβασης.
    fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, generateDeterministicNetworkActTeamId(BIRTH.actSeed), {
      ...actTeamDocument(BIRTH, NOW),
      responsibleUid: 'user_eleni',
      memberUids: ['user_maria', 'user_eleni'],
      version: 2,
    });

    await ensureActTeam(db, BIRTH, LATER);

    expect(storedTeam(fake, BIRTH.actSeed)).toMatchObject({
      responsibleUid: 'user_eleni',
      version: 2,
    });
  });

  it('Ο-4 δύο πράξεις ⇒ δύο ομάδες', async () => {
    const { db } = freshDb();

    const alfa = await ensureActTeam(db, BIRTH, NOW);
    const beta = await ensureActTeam(
      db,
      { ...BIRTH, actSeed: mandateActSeed('ownp_1', 'comp_beta'), hostCompanyId: 'comp_beta' },
      NOW,
    );

    expect(beta.id).not.toBe(alfa.id);
  });

  it('Ο-5β ο σπόρος είναι Ο ΙΔΙΟΣ με του κριτή ακμής', () => {
    const [edge] = mandateEdgesOf({
      propertyId: 'ownp_1',
      mandates: [brokeredMandate({ confirmation: 'confirmed', confirmedByUserId: 'uid_owner' })],
    });

    expect(edge.actSeed).toBe(BIRTH.actSeed);
    expect(generateDeterministicNetworkActTeamId(edge.actSeed)).toBe(
      generateDeterministicNetworkActTeamId(BIRTH.actSeed),
    );
  });
});

// ============================================================================
/**
 * ADR-834 §5 Β (ε) 🏆 — **ΚΑΝΕΝΑ ΟΡΦΑΝΟ ΝΗΜΑ, ΠΟΤΕ**.
 *
 *   Μ-1  Αποχώρηση υπευθύνου ⇒ **το επόμενο μέλος** αναλαμβάνει, ο αποχωρών φεύγει από τα μέλη
 *   Μ-2  Μόνος υπεύθυνος ⇒ ο **διαχειριστής** που έκανε την πράξη, **ορατός** στα μέλη (ε) ②
 *   Μ-3  Ομάδα **άλλου** γραφείου ή **άλλου** υπευθύνου δεν αγγίζεται
 *   Μ-4  Ο κανόνας **ποτέ** δεν επιστρέφει τον αποχωρούντα — ούτε `null`
 */
describe('Μ — η μεταβίβαση της ευθύνης', () => {
  const DEPARTURE = {
    companyId: 'comp_alfa',
    departingUid: 'user_maria',
    fallbackUid: 'user_admin',
    performedBy: 'user_admin',
    nowISO: LATER,
  };

  function seedTeam(fake: FakeFirestore, over: Partial<ReturnType<typeof actTeamDocument>>): void {
    const doc = { ...actTeamDocument(BIRTH, NOW), ...over };
    fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, doc.id, doc);
  }

  it('Μ-1 το επόμενο μέλος αναλαμβάνει· ο αποχωρών φεύγει από τα μέλη', async () => {
    const { db, fake } = freshDb();
    seedTeam(fake, { memberUids: ['user_maria', 'user_eleni'] });

    expect(await transferActTeamsOnDeparture(db, DEPARTURE)).toEqual({ transferred: 1, orphaned: 0 });

    expect(storedTeam(fake, BIRTH.actSeed)).toMatchObject({
      responsibleUid: 'user_eleni',
      memberUids: ['user_eleni'],
      version: 2,
      updatedAt: LATER,
    });
  });

  it('Μ-2 μόνος υπεύθυνος ⇒ ο διαχειριστής, ΚΑΙ φαίνεται στα μέλη', async () => {
    const { db, fake } = freshDb();
    seedTeam(fake, {});

    await transferActTeamsOnDeparture(db, DEPARTURE);

    expect(storedTeam(fake, BIRTH.actSeed)).toMatchObject({
      responsibleUid: 'user_admin',
      memberUids: ['user_admin'],
    });
  });

  it('Μ-3 ΑΛΛΟ γραφείο ή ΑΛΛΟΣ υπεύθυνος δεν αγγίζεται', async () => {
    const { db, fake } = freshDb();
    const foreign = { ...actTeamDocument({ ...BIRTH, actSeed: 'ownp_2:comp_beta', hostCompanyId: 'comp_beta' }, NOW) };
    const other = { ...actTeamDocument({ ...BIRTH, actSeed: 'ownp_3:comp_alfa', responsibleUid: 'user_nikos' }, NOW) };
    fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, foreign.id, foreign);
    fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, other.id, other);

    expect(await transferActTeamsOnDeparture(db, DEPARTURE)).toEqual({ transferred: 0, orphaned: 0 });

    expect(storedTeam(fake, 'ownp_2:comp_beta')).toMatchObject({ responsibleUid: 'user_maria', version: 1 });
    expect(storedTeam(fake, 'ownp_3:comp_alfa')).toMatchObject({ responsibleUid: 'user_nikos', version: 1 });
  });

  it('Μ-4 ο κανόνας ΠΟΤΕ δεν επιστρέφει τον αποχωρούντα', () => {
    expect(nextResponsible({ memberUids: ['user_maria'] }, 'user_maria', 'user_admin')).toBe('user_admin');
    expect(nextResponsible({ memberUids: [] }, 'user_maria', 'user_admin')).toBe('user_admin');
    expect(nextResponsible({ memberUids: ['user_maria', 'user_eleni'] }, 'user_maria', 'user_admin')).toBe('user_eleni');
  });
});

// ============================================================================
describe('Γ — η γέννηση της πράξης: ομάδα ΚΑΙ νήμα (Β9)', () => {
  const OWNER = 'user_kostas';
  const THREAD_ID = generateDeterministicNetworkActThreadId(BIRTH.actSeed);
  const audienceOf = (fake: FakeFirestore): readonly NetworkAudienceEntry[] =>
    fake.all<NetworkAudienceEntry>(
      `${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/${SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE}`,
    );

  it('Γ-1 ομάδα ΚΑΙ νήμα· ακροατήριο = υπεύθυνος + αντισυμβαλλόμενος', async () => {
    const { db, fake } = freshDb();

    const born = await ensureActBirth(db, BIRTH, OWNER, NOW);

    expect(born.teamCreated).toBe(true);
    expect(born.thread).toMatchObject({ threadId: THREAD_ID, created: true });
    expect(storedTeam(fake, BIRTH.actSeed)).toMatchObject({ responsibleUid: 'user_maria' });
    const seats = audienceOf(fake);
    expect(seats).toHaveLength(2);
    expect(seats.find((s) => s.uid === 'user_maria')).toMatchObject({ side: 'host', role: 'responsible' });
    expect(seats.find((s) => s.uid === OWNER)).toMatchObject({ side: 'counterpart', role: 'counterpart' });
  });

  it('Γ-2 🔴 δεύτερη γέννηση ⇒ ΚΑΜΙΑ γραφή', async () => {
    const { db, fake } = freshDb();
    await ensureActBirth(db, BIRTH, OWNER, NOW);
    const writesAfterBirth = fake.writes;

    const again = await ensureActBirth(db, BIRTH, OWNER, LATER);

    expect(again.teamCreated).toBe(false);
    expect(again.thread).toMatchObject({ threadId: THREAD_ID, created: false, audienceWrites: [] });
    expect(fake.writes).toBe(writesAfterBirth);
  });

  it('Γ-3 🔴 χωρίς πρόσωπο στην άλλη πλευρά ⇒ ομάδα ναι, νήμα ΟΧΙ', async () => {
    const { db, fake } = freshDb();

    const born = await ensureActBirth(db, BIRTH, null, NOW);

    expect(born.teamCreated).toBe(true);
    expect(born.thread).toMatchObject({ threadId: null, created: false });
    expect(fake.snapshotOf(COLLECTIONS.NETWORK_THREADS, THREAD_ID)).toBe('null');
  });

  it('Γ-4 🔴 υπάρχουσα ομάδα με μεταβίβαση ⇒ το νήμα προβάλλει ΑΥΤΗ, όχι τη γέννηση', async () => {
    const { db, fake } = freshDb();
    fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, generateDeterministicNetworkActTeamId(BIRTH.actSeed), {
      ...actTeamDocument(BIRTH, NOW),
      responsibleUid: 'user_eleni',
      memberUids: ['user_maria', 'user_eleni'],
      version: 2,
    });

    await ensureActBirth(db, BIRTH, OWNER, LATER);

    const seats = audienceOf(fake);
    expect(seats.find((s) => s.uid === 'user_eleni')).toMatchObject({ role: 'responsible' });
    expect(seats.find((s) => s.uid === 'user_maria')).toMatchObject({ role: 'collaborator' });
    expect(storedTeam(fake, BIRTH.actSeed)).toMatchObject({ responsibleUid: 'user_eleni', version: 2 });
  });
});

// ============================================================================
describe('Δ — ο ιδιοκτήτης που είναι ΚΑΙ μέλος του γραφείου (Β9)', () => {
  const OWNER = 'user_maria';
  const project = (team: { responsibleUid: string; memberUids: string[] }, existing: NetworkAudienceEntry[] = []) =>
    projectActAudience({
      team,
      counterpartUid: OWNER,
      existing,
      newcomerReason: 'creator',
      addedBy: 'user_maria',
      nowISO: NOW,
      threadActivityAt: NOW,
    });

  it('Δ-1 🔴 μία θέση `counterpart`, με τη δεύτερη ιδιότητα ΓΡΑΜΜΕΝΗ', () => {
    const writes = project({ responsibleUid: OWNER, memberUids: [OWNER] });

    expect(writes).toHaveLength(1);
    expect(writes[0]?.entry).toMatchObject({ uid: OWNER, side: 'counterpart', role: 'counterpart', alsoHostRole: 'responsible' });
  });

  it('Δ-2 γραμμή προ-Β9 ⇒ συμπληρώνεται μία φορά· ξένη γραμμή προ-Β9 δεν αγγίζεται', () => {
    const legacy = { ...project({ responsibleUid: 'user_eleni', memberUids: ['user_eleni'] })[0]!.entry } as Record<string, unknown>;
    delete legacy.alsoHostRole;
    const preB9 = legacy as unknown as NetworkAudienceEntry;

    // Ιδιοκτήτης ΕΚΤΟΣ ομάδας: `undefined` ≡ `null` ⇒ καμία άσκοπη «αλλαγή ρόλου».
    expect(project({ responsibleUid: 'user_eleni', memberUids: ['user_eleni'] }, [preB9]).filter((w) => w.uid === OWNER)).toEqual([]);

    const filled = project({ responsibleUid: OWNER, memberUids: [OWNER] }, [preB9]);
    expect(filled).toStrictEqual([expect.objectContaining({ uid: OWNER, change: 'role-changed' })]);
    expect(filled[0]?.entry).toMatchObject({ alsoHostRole: 'responsible', since: preB9.since });
    expect(project({ responsibleUid: OWNER, memberUids: [OWNER] }, [filled[0]!.entry])).toEqual([]);
  });

  it('Δ-3 βγαίνει από την ομάδα ⇒ `alsoHostRole: null`, η θέση του ΜΕΝΕΙ ζωντανή', () => {
    const [dual] = project({ responsibleUid: OWNER, memberUids: [OWNER, 'user_eleni'] });
    const writes = project({ responsibleUid: 'user_eleni', memberUids: ['user_eleni'] }, [dual!.entry]);

    const own = writes.find((w) => w.uid === OWNER);
    expect(own?.entry).toMatchObject({ side: 'counterpart', alsoHostRole: null, until: null });
  });
});
