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
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { mandateActSeed, mandateEdgesOf } from '@/lib/network-edge/edge-sources';
import { brokeredMandate } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { generateDeterministicNetworkActTeamId } from '@/services/enterprise-id.service';
import {
  actTeamDocument,
  ensureActTeam,
  nextResponsible,
  transferActTeamsOnDeparture,
  type ActTeamBirth,
} from '@/services/network-messaging/act-team-writer';
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
    nowISO: LATER,
  };

  function seedTeam(fake: FakeFirestore, over: Partial<ReturnType<typeof actTeamDocument>>): void {
    const doc = { ...actTeamDocument(BIRTH, NOW), ...over };
    fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, doc.id, doc);
  }

  it('Μ-1 το επόμενο μέλος αναλαμβάνει· ο αποχωρών φεύγει από τα μέλη', async () => {
    const { db, fake } = freshDb();
    seedTeam(fake, { memberUids: ['user_maria', 'user_eleni'] });

    expect(await transferActTeamsOnDeparture(db, DEPARTURE)).toEqual({ transferred: 1 });

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

    expect(await transferActTeamsOnDeparture(db, DEPARTURE)).toEqual({ transferred: 0 });

    expect(storedTeam(fake, 'ownp_2:comp_beta')).toMatchObject({ responsibleUid: 'user_maria', version: 1 });
    expect(storedTeam(fake, 'ownp_3:comp_alfa')).toMatchObject({ responsibleUid: 'user_nikos', version: 1 });
  });

  it('Μ-4 ο κανόνας ΠΟΤΕ δεν επιστρέφει τον αποχωρούντα', () => {
    expect(nextResponsible({ memberUids: ['user_maria'] }, 'user_maria', 'user_admin')).toBe('user_admin');
    expect(nextResponsible({ memberUids: [] }, 'user_maria', 'user_admin')).toBe('user_admin');
    expect(nextResponsible({ memberUids: ['user_maria', 'user_eleni'] }, 'user_maria', 'user_admin')).toBe('user_eleni');
  });
});
