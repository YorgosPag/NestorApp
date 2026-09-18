/**
 * @jest-environment node
 *
 * ADR-867 Β5 · ADR-834 §5 Β (ε) 🏆 — ΑΓΚΥΡΕΣ του **κληρονόμου** στην αποχώρηση (πρότυπο Microsoft 365:
 * manager ⇒ secondary owner **του ίδιου οργανισμού** — ποτέ ο χειριστής της πλατφόρμας).
 *
 *   Κλ-1  Ο παλαιότερος **ενεργός** διαχειριστής του γραφείου — όχι απλός υπάλληλος, όχι ανεσταλμένος
 *   Κλ-2  🔴 Ο super_admin σε ΞΕΝΟ γραφείο **δεν** κληρονομεί· ο διαχειριστής-μέλος **ναι**
 *   Κλ-3  🔴 Κανείς διαχειριστής ⇒ η ομάδα **δεν** αγγίζεται, το ορφανό **μετριέται** — ποτέ ξένος αναγνώστης
 *   Κλ-4  Ο κανόνας **ποτέ** δεν επιστρέφει τον αποχωρούντα — ούτε όταν ο καταφύγιος είναι ο ίδιος
 *   Κλ-5  🔴 Το ίχνος γράφει **ποιος έκανε την αναστολή**, όχι ποιος κληρονόμησε
 *   Κλ-6  Αποχώρηση από ΟΛΗ την πλατφόρμα ⇒ ένας κληρονόμος **ανά γραφείο**, από τους **δικούς του**
 */

import fs from 'fs';
import path from 'path';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { EntityAuditService } from '@/services/entity-audit.service';
import { generateDeterministicNetworkActTeamId } from '@/services/enterprise-id.service';
import {
  nextResponsible,
  pickOfficeHeir,
  resolveDepartureHeir,
  transferActTeamsOnDeparture,
  transferActTeamsOnPlatformDeparture,
} from '@/services/network-messaging/act-team-departure';
import { actTeamDocument } from '@/services/network-messaging/act-team-writer';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const mockListMemberWorkspaces = jest.fn();
jest.mock('@/lib/auth/workspace-membership', () => ({
  ...jest.requireActual('@/lib/auth/workspace-membership'),
  listMemberWorkspaces: (uid: string) => mockListMemberWorkspaces(uid),
}));

const NOW = '2026-09-18T10:00:00.000Z';
const ALFA = 'comp_alfa';
const BETA = 'comp_beta';
const MARIA = 'user_maria';
const ROOT = 'user_root';

const membersPath = (companyId: string) => `${COLLECTIONS.COMPANIES}/${companyId}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`;
const seedMember = (fake: FakeFirestore, companyId: string, uid: string, over: Record<string, unknown> = {}) =>
  fake.seed(membersPath(companyId), uid, { uid, status: 'active', globalRole: 'internal_user', joinedAt: NOW, ...over });
const seedSoloTeam = (fake: FakeFirestore, companyId: string, propertyId: string) => {
  const doc = actTeamDocument(
    { actKind: 'mandate', actSeed: mandateActSeed(propertyId, companyId), hostCompanyId: companyId, responsibleUid: MARIA },
    NOW,
  );
  fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, doc.id, { ...doc });
  return doc.id;
};
const teamOf = (fake: FakeFirestore, id: string) =>
  JSON.parse(fake.snapshotOf(COLLECTIONS.NETWORK_ACT_TEAMS, id)) as Record<string, unknown>;

let recordChange: jest.SpyInstance;
beforeEach(() => {
  recordChange = jest.spyOn(EntityAuditService, 'recordChange').mockResolvedValue('eaud_1');
  mockListMemberWorkspaces.mockReset();
});
afterEach(() => jest.restoreAllMocks());

function freshDb(): { db: AdminFirestore; fake: FakeFirestore } {
  const fake = new FakeFirestore();
  return { db: fake as unknown as AdminFirestore, fake };
}

// ============================================================================
describe('Κλ — ο κληρονόμος του γραφείου', () => {
  const candidate = (uid: string, globalRole: string | null, joinedAtMs: number, active = true) => ({
    uid,
    globalRole,
    joinedAtMs,
    active,
  });

  it('Κλ-1 ο παλαιότερος ΕΝΕΡΓΟΣ διαχειριστής — όχι υπάλληλος, όχι ανεσταλμένος, όχι ο αποχωρών', () => {
    const heir = pickOfficeHeir(
      [
        candidate('user_old_employee', 'internal_user', 1),
        candidate('user_suspended_admin', 'company_admin', 2, false),
        candidate(MARIA, 'company_admin', 3),
        candidate('user_admin_b', 'company_admin', 5),
        candidate('user_admin_a', 'company_admin', 4),
      ],
      MARIA,
    );

    expect(heir).toBe('user_admin_a');
    expect(pickOfficeHeir([candidate('user_old_employee', 'internal_user', 1)], MARIA)).toBeNull();
  });

  it('Κλ-2 🔴 super_admin σε ΞΕΝΟ γραφείο δεν κληρονομεί· ο διαχειριστής-μέλος ναι', async () => {
    const { db, fake } = freshDb();
    seedMember(fake, ALFA, 'user_admin', { globalRole: 'company_admin' });

    const viaPlatform = await resolveDepartureHeir(db, { companyId: ALFA, departingUid: MARIA, actorUid: ROOT, actorIsMember: false });
    const viaMember = await resolveDepartureHeir(db, { companyId: ALFA, departingUid: MARIA, actorUid: 'user_admin', actorIsMember: true });

    expect(viaPlatform).toBe('user_admin');
    expect(viaMember).toBe('user_admin');
  });

  it('Κλ-3 🔴 κανείς διαχειριστής ⇒ η ομάδα ΔΕΝ αγγίζεται και το ορφανό ΜΕΤΡΙΕΤΑΙ', async () => {
    const { db, fake } = freshDb();
    const teamId = seedSoloTeam(fake, ALFA, 'ownp_1');

    const outcome = await transferActTeamsOnDeparture(db, {
      companyId: ALFA,
      departingUid: MARIA,
      fallbackUid: null,
      performedBy: ROOT,
      nowISO: NOW,
    });

    expect(outcome).toEqual({ transferred: 0, orphaned: 1 });
    expect(teamOf(fake, teamId)).toMatchObject({ responsibleUid: MARIA, version: 1 });
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('Κλ-4 ο κανόνας ΠΟΤΕ δεν επιστρέφει τον αποχωρούντα', () => {
    expect(nextResponsible({ memberUids: [MARIA] }, MARIA, MARIA)).toBeNull();
    expect(nextResponsible({ memberUids: [MARIA] }, MARIA, null)).toBeNull();
    expect(nextResponsible({ memberUids: [MARIA, 'user_eleni'] }, MARIA, null)).toBe('user_eleni');
  });

  it('Κλ-5 🔴 το ίχνος γράφει ΠΟΙΟΣ ΕΚΑΝΕ την αναστολή — όχι ποιος κληρονόμησε', async () => {
    const { db, fake } = freshDb();
    const teamId = seedSoloTeam(fake, ALFA, 'ownp_1');

    await transferActTeamsOnDeparture(db, {
      companyId: ALFA,
      departingUid: MARIA,
      fallbackUid: 'user_admin',
      performedBy: ROOT,
      nowISO: NOW,
    });

    expect(teamOf(fake, teamId)).toMatchObject({ responsibleUid: 'user_admin' });
    expect(recordChange.mock.calls[0][0]).toMatchObject({ performedBy: ROOT, companyId: ALFA });
  });

  it('Κλ-6 αποχώρηση από όλη την πλατφόρμα ⇒ κληρονόμος ΑΝΑ γραφείο, από τους ΔΙΚΟΥΣ του', async () => {
    const { db, fake } = freshDb();
    mockListMemberWorkspaces.mockResolvedValue({ outcome: 'ok', companyIds: [ALFA, BETA] });
    seedMember(fake, ALFA, 'user_alfa_admin', { globalRole: 'company_admin' });
    seedMember(fake, BETA, 'user_beta_admin', { globalRole: 'company_admin' });
    const alfaTeam = seedSoloTeam(fake, ALFA, 'ownp_1');
    const betaTeam = seedSoloTeam(fake, BETA, 'ownp_2');

    const outcome = await transferActTeamsOnPlatformDeparture(db, {
      departingUid: MARIA,
      actorUid: ROOT,
      actorMemberWorkspaceId: null,
      nowISO: NOW,
    });

    expect(outcome).toEqual({ transferred: 2, orphaned: 0 });
    expect(teamOf(fake, alfaTeam)).toMatchObject({ responsibleUid: 'user_alfa_admin' });
    expect(teamOf(fake, betaTeam)).toMatchObject({ responsibleUid: 'user_beta_admin' });
    expect(generateDeterministicNetworkActTeamId(mandateActSeed('ownp_1', ALFA))).toBe(alfaTeam);
  });

  it('Κλ-7 🔴 ΚΑΜΙΑ διαδρομή αποχώρησης δεν κάνει κληρονόμο τον δρώντα — και οι ΔΥΟ ρωτούν τον κριτή', () => {
    const route = (name: string) =>
      fs.readFileSync(path.resolve(__dirname, `../../../app/api/admin/role-management/users/[uid]/${name}/route.ts`), 'utf8');
    const status = route('status');
    const remediation = route('identity-remediation');

    // Οι δύο διαδρομές απαιτούν `BYPASS_ROLES`: «κληρονόμος = ctx.uid» ⇒ super_admin αναγνώστης (Ζ2).
    expect(status).not.toMatch(/fallbackUid:\s*ctx\.uid/);
    expect(status).toContain('resolveDepartureHeir(');
    expect(remediation).toContain('transferActTeamsOnPlatformDeparture(');
  });

  it('Κλ-6β «δεν μπόρεσα να ρωτήσω» ≠ «σε κανένα γραφείο» — ρίχνει με όνομα', async () => {
    const { db } = freshDb();
    mockListMemberWorkspaces.mockResolvedValue({ outcome: 'unknown', reason: 'firebase-admin-unavailable' });

    await expect(
      transferActTeamsOnPlatformDeparture(db, { departingUid: MARIA, actorUid: ROOT, actorMemberWorkspaceId: null, nowISO: NOW }),
    ).rejects.toThrow('workspace list unknown');
  });
});
