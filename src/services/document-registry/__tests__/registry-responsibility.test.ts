/**
 * @jest-environment node
 *
 * ADR-915 Φ5β — ο συλλέκτης γεγονότων της αλυσίδας υπευθυνότητας: διαβάζει **μόνο** από τα υπάρχοντα SSoT (ομάδα
 * πράξης εντολής · ομάδα έργου · μέλη χώρου), και ο μισθωτής κρίνεται σε κάθε πηγή. Αληθινά μονοπάτια, ψεύτικη βάση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { DOCUMENT_MANAGER_SET_ID } from '@/lib/auth/permission-sets';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { generateDeterministicNetworkActTeamId } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { readOfficeResponsibility } from '../registry-responsibility.server';

const CO = 'comp_a';
const MEMBERS = `${COLLECTIONS.COMPANIES}/${CO}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`;
const projectMembers = (projectId: string) =>
  `${COLLECTIONS.COMPANIES}/${CO}/${SUBCOLLECTIONS.COMPANY_PROJECTS}/${projectId}/${SUBCOLLECTIONS.PROJECT_MEMBERS}`;

let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;

function member(uid: string, globalRole: string, extra: Record<string, unknown> = {}): void {
  fake.seed(MEMBERS, uid, { uid, status: 'active', globalRole, ...extra });
}

function actTeam(ownerPropertyId: string, hostCompanyId: string, responsibleUid: string): void {
  const id = generateDeterministicNetworkActTeamId(mandateActSeed(ownerPropertyId, CO));
  fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, id, { id, actKind: 'mandate', hostCompanyId, responsibleUid, memberUids: [responsibleUid] });
}

beforeEach(() => {
  fake = new FakeFirestore();
  member('u_admin', 'company_admin');
  member('u_doc', 'internal_user', { permissionSetIds: [DOCUMENT_MANAGER_SET_ID] });
  member('u_pm', 'internal_user');
  member('u_sales', 'internal_user');
  member('u_viewer', 'internal_user');
  fake.seed(MEMBERS, 'u_gone', { uid: 'u_gone', status: 'suspended', globalRole: 'company_admin' });
  fake.seed(COLLECTIONS.PROPERTIES, 'p1', { companyId: CO, projectId: 'proj_1', name: 'Α' });
  fake.seed(COLLECTIONS.PROPERTIES, 'p_foreign', { companyId: 'comp_x', projectId: 'proj_1', name: 'Ξ' });
  fake.seed(projectMembers('proj_1'), 'mem_1', { uid: 'u_pm', roleId: 'project_manager' });
  fake.seed(projectMembers('proj_1'), 'mem_2', { uid: 'u_sales', roleId: 'sales_agent' });
  fake.seed(projectMembers('proj_1'), 'mem_3', { uid: 'u_viewer', roleId: 'viewer' });
});

describe('readOfficeResponsibility', () => {
  it('μέλη χώρου: ενεργοί · υπεύθυνοι εγγράφων (σύνολο) · διαχειριστές — ο σε παύση δεν μετρά', async () => {
    const facts = await readOfficeResponsibility(db(), CO, {});
    expect([...facts.activeUids].sort()).toEqual(['u_admin', 'u_doc', 'u_pm', 'u_sales', 'u_viewer']);
    expect(facts.documentManagers).toEqual(['u_doc']);
    expect(facts.administrators).toEqual(['u_admin']);
  });

  it('ακίνητο εταιρείας ⇒ η ομάδα του έργου με ρόλο υπευθύνου (όχι ο `viewer`)', async () => {
    const facts = await readOfficeResponsibility(db(), CO, { p1: { scope: 'property' } });
    expect(facts.properties.p1).toEqual({ explicitUid: null, projectUids: ['u_pm', 'u_sales'] });
  });

  it('🔴 ακίνητο ΞΕΝΟΥ γραφείου ⇒ κανένα γεγονός (το `readCompanyProperties` κρίνει τον μισθωτή)', async () => {
    const facts = await readOfficeResponsibility(db(), CO, { p_foreign: { scope: 'property' } });
    expect(facts.properties.p_foreign).toBeUndefined();
  });

  it('εντολή ⇒ ο υπεύθυνος της ομάδας πράξης (ADR-867)', async () => {
    actTeam('ownp_7', CO, 'u_pm');
    const facts = await readOfficeResponsibility(db(), CO, { ownp_7: { scope: 'owner-property' } });
    expect(facts.properties.ownp_7).toEqual({ explicitUid: 'u_pm', projectUids: [] });
  });

  it('🔴 ομάδα πράξης με ΑΛΛΟΝ οικοδεσπότη ⇒ αγνοείται', async () => {
    actTeam('ownp_7', 'comp_x', 'u_intruder');
    const facts = await readOfficeResponsibility(db(), CO, { ownp_7: { scope: 'owner-property' } });
    expect(facts.properties.ownp_7).toBeUndefined();
  });

  it('εντολή χωρίς ομάδα πράξης ⇒ καμία εφεύρεση (ο κριτής πέφτει στους κρίκους του γραφείου)', async () => {
    const facts = await readOfficeResponsibility(db(), CO, { ownp_8: { scope: 'owner-property' } });
    expect(facts.properties.ownp_8).toBeUndefined();
  });
});
