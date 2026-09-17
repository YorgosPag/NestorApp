/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **ΟΙ ΑΓΚΥΡΕΣ Α26-Α32** — η ομάδα του έργου γεννιέται με το έργο (ADR-862 Φ0 Β14).
 * @related lib/auth/project-member-write · lib/auth/project-staffing-policy ·
 *   api/projects/list/project-birth · lib/files/container-project · services/iso19650/container-custody ·
 *   api/admin/migrations/backfill-project-members
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ΤΙ ΚΛΕΙΔΩΝΕΙ
 * ════════════════════════════════════════════════════════════════════════════
 *   Α26  ο γραφέας: δεύτερη ένταξη ⇒ `already-member`, ΠΟΤΕ δεύτερο έγγραφο
 *   Α27  η πολιτική: ο δημιουργός = `design` + ομάδα = ο οργανισμός
 *   Α28  η γέννηση: έργο + μέλος ΑΤΟΜΙΚΑ — αποτυχία μέλους ⇒ ούτε έργο
 *   Α29  end-to-end με τον ΠΡΑΓΜΑΤΙΚΟ κριτή: δημιουργός βλέπει · μη-μέλος όχι
 *   Α30  ο αναλυτής έργου: property · building · floor · project · ξένος μισθωτής · εκτός έργων
 *   Α31  ο γραφέας κατάστασης σφραγίζει έργο + ομάδα στην είσοδο στο CDE
 *   Α32  το backfill: ιδεμπότητο, δεύτερη εκτέλεση = 0
 *
 * ⚠️ Ο αναγνώστης μελών, ο κριτής και ο αναγνώστης κατάστασης **δεν** γίνονται mock.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
  isFirebaseAdminAvailable: (): boolean => true,
  FieldValue: { serverTimestamp: () => '__server_timestamp__' },
}));

jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: jest.fn(async () => 'audit_test'),
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => undefined) },
}));

import { EntityAuditService } from '@/services/entity-audit.service';
import { enrollProjectMembers, type ProjectEnrollmentRequest } from '../project-member-write';
import { initialProjectTeam } from '../project-staffing-policy';
import { containerSubjectFor } from '../container-subject';
import { decideContainerAccess } from '../container-access';
import type { AuthContext } from '../types';
import { writeProjectBirth } from '@/app/api/projects/list/project-birth';
import { resolveContainerProject } from '@/lib/files/container-project';
import { transitionContainer } from '@/services/iso19650/container-transitions';
import { backfillProjectTeams } from '@/app/api/admin/migrations/backfill-project-members/backfill-project-members-operations';

const COMPANY = 'comp_alpha';
const FOREIGN = 'comp_beta';
const PROJECT = 'proj_tower';
const CREATOR = 'uid_creator';
const STRANGER = 'uid_stranger';

const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const membersPath = (projectId = PROJECT, companyId = COMPANY): string =>
  [COLLECTIONS.COMPANIES, companyId, SUBCOLLECTIONS.COMPANY_PROJECTS, projectId, SUBCOLLECTIONS.PROJECT_MEMBERS].join('/');
const members = (projectId = PROJECT): readonly Record<string, unknown>[] =>
  fake.all<Record<string, unknown>>(membersPath(projectId));

const request = (over: Partial<ProjectEnrollmentRequest> = {}): ProjectEnrollmentRequest => ({
  companyId: COMPANY,
  projectId: PROJECT,
  uid: CREATOR,
  roleId: 'project_manager',
  cdeAudience: 'design',
  taskTeamId: COMPANY,
  enrollment: 'manual',
  addedBy: CREATOR,
  ...over,
});

const AUDIT = { entityName: 'Πύργος', changes: [], performedByName: 'creator@example.test' };

const caller = (uid: string): AuthContext => ({
  uid,
  email: `${uid}@example.test`,
  companyId: COMPANY,
  globalRole: 'internal_user',
  mfaEnrolled: false,
  isAuthenticated: true,
  permissions: ['projects:projects:view'],
});

beforeEach(() => {
  fake = new FakeFirestore();
  jest.clearAllMocks();
});

// =============================================================================
// Α26 — Ο ΓΡΑΦΕΑΣ
// =============================================================================

describe('Α26 — ο ΕΝΑΣ γραφέας μελών', () => {
  it('Α26.1 — πρώτη ένταξη γράφει ΕΝΑ έγγραφο `mbr_…` με το `uid` ως πεδίο και την προέλευση', async () => {
    const [outcome] = await enrollProjectMembers(db(), [request()]);

    expect(outcome.outcome).toBe('enrolled');
    expect(outcome.memberId).toMatch(/^mbr_/);
    expect(members()).toEqual([expect.objectContaining({ uid: CREATOR, enrollment: 'manual', taskTeamId: COMPANY })]);
  });

  it('🔴 Α26.2 — δεύτερη ένταξη του ΙΔΙΟΥ ⇒ already-member, ΚΑΝΕΝΑ δεύτερο έγγραφο', async () => {
    const [first] = await enrollProjectMembers(db(), [request()]);
    const [second] = await enrollProjectMembers(db(), [request({ roleId: 'viewer' })]);

    expect(second).toEqual({ outcome: 'already-member', uid: CREATOR, memberId: first.memberId });
    expect(members()).toHaveLength(1);
  });

  it('🔴 Α26.3 — δύο αιτήματα για τον ίδιο άνθρωπο στην ΙΔΙΑ κλήση ⇒ ένα έγγραφο', async () => {
    await enrollProjectMembers(db(), [request(), request()]);

    expect(members()).toHaveLength(1);
  });

  it('Α26.4 — απόν ακροατήριο/ομάδα ΔΕΝ γράφεται κενό («δεν δηλώθηκε» ≠ «δηλώθηκε κενό»)', async () => {
    await enrollProjectMembers(db(), [request({ cdeAudience: undefined, taskTeamId: undefined })]);

    expect(Object.keys(members()[0])).not.toEqual(expect.arrayContaining(['cdeAudience']));
    expect(Object.keys(members()[0])).not.toEqual(expect.arrayContaining(['taskTeamId']));
  });
});

// =============================================================================
// Α27 — Η ΠΟΛΙΤΙΚΗ
// =============================================================================

describe('Α27 — η αρχική ομάδα του έργου', () => {
  it('🔴 Α27.1 — ο δημιουργός, ως μελετητής, με ομάδα τον οργανισμό — και ΚΑΝΕΙΣ άλλος', () => {
    expect(initialProjectTeam({ companyId: COMPANY, projectId: PROJECT, createdBy: CREATOR })).toEqual([
      { uid: CREATOR, roleId: 'project_manager', cdeAudience: 'design', taskTeamId: COMPANY, enrollment: 'creator' },
    ]);
  });
});

// =============================================================================
// Α28 + Α29 — Η ΓΕΝΝΗΣΗ, ΚΑΙ Ο ΠΡΑΓΜΑΤΙΚΟΣ ΚΡΙΤΗΣ
// =============================================================================

describe('Α28 — έργο και ομάδα σε ΜΙΑ συναλλαγή', () => {
  const birth = () => writeProjectBirth(db(), {
    companyId: COMPANY, projectId: PROJECT, createdBy: CREATOR, document: { name: 'Πύργος', companyId: COMPANY }, audit: AUDIT,
  });

  it('Α28.1 — η γέννηση γράφει το έργο ΚΑΙ τον δημιουργό ως μέλος', async () => {
    const [outcome] = await birth();

    expect(outcome.outcome).toBe('enrolled');
    expect(fake.all(COLLECTIONS.PROJECTS)).toEqual([expect.objectContaining({ name: 'Πύργος' })]);
    expect(members()).toEqual([expect.objectContaining({ uid: CREATOR, enrollment: 'creator' })]);
  });

  it('Α28.3 — το ίχνος ADR-195 καταγράφεται ΜΕΤΑ το commit, μία φορά, για το ΣΩΣΤΟ έργο', async () => {
    await birth();

    expect(EntityAuditService.recordChange).toHaveBeenCalledTimes(1);
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityId: PROJECT, action: 'created', performedBy: CREATOR, companyId: COMPANY,
    }));
  });

  it('🔴 Α28.2 — αποτυχία εγγραφής ⇒ η συναλλαγή απορρίπτεται, ΚΑΝΕΝΑ έργο «χωρίς ομάδα» δεν μένει', async () => {
    // Υπάρχον έργο με το ίδιο id: το `create` αποτυγχάνει, και μαζί του ΟΛΗ η γέννηση.
    fake.seed(COLLECTIONS.PROJECTS, PROJECT, { name: 'υπάρχον', companyId: COMPANY });

    await expect(birth()).rejects.toThrow(/ALREADY_EXISTS/);
    expect(fake.all(COLLECTIONS.PROJECTS)).toEqual([{ name: 'υπάρχον', companyId: COMPANY }]);
    // ⚠️ Και ΚΑΝΕΝΑ ίχνος «δημιουργήθηκε» για έργο που δεν γεννήθηκε.
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });
});

describe('Α29 — ο ΠΡΑΓΜΑΤΙΚΟΣ κριτής, μετά τη γέννηση', () => {
  async function verdictFor(uid: string): Promise<string> {
    const built = await containerSubjectFor({ caller: caller(uid), projectId: PROJECT, historyRequested: true });
    if (built.outcome !== 'subject') throw new Error(`περίμενα υποκείμενο, πήρα ${built.outcome}`);
    return decideContainerAccess({
      subject: built.subject,
      facts: { fileId: 'file_old', companyId: COMPANY, createdBy: CREATOR, state: { phase: 'SUPERSEDED', teamId: null } },
      action: 'projects:projects:view',
    }).verdict;
  }

  it('🔴 Α29.1 — ΠΡΙΝ τη γέννηση: ο δημιουργός δεν συμμετέχει (η βλάβη της 2026-09-17)', async () => {
    expect(await verdictFor(CREATOR)).toBe('denied-not-engaged');
  });

  it('✅ Α29.2 — ΜΕΤΑ τη γέννηση: ο δημιουργός βλέπει το ιστορικό', async () => {
    await writeProjectBirth(db(), { companyId: COMPANY, projectId: PROJECT, createdBy: CREATOR, document: { companyId: COMPANY }, audit: AUDIT });

    expect(await verdictFor(CREATOR)).toBe('visible-history');
  });

  it('⛔ Α29.3 — ΚΑΙ ΜΟΝΟ αυτός: συνάδελφος του ίδιου γραφείου ΔΕΝ μπαίνει σιωπηρά', async () => {
    await writeProjectBirth(db(), { companyId: COMPANY, projectId: PROJECT, createdBy: CREATOR, document: { companyId: COMPANY }, audit: AUDIT });

    expect(await verdictFor(STRANGER)).toBe('denied-not-engaged');
  });
});

// =============================================================================
// Α30 — Ο ΑΝΑΛΥΤΗΣ ΕΡΓΟΥ
// =============================================================================

describe('Α30 — σε ποιο έργο ζει το δοχείο', () => {
  const resolve = (raw: Record<string, unknown>) =>
    fake.runTransaction((tx) => resolveContainerProject(tx as never, db(), raw));
  const file = (entityType: string, entityId: string, over: Record<string, unknown> = {}) =>
    ({ companyId: COMPANY, entityType, entityId, ...over });

  beforeEach(() => {
    fake.seed(COLLECTIONS.PROJECTS, PROJECT, { companyId: COMPANY });
    fake.seed(COLLECTIONS.BUILDINGS, 'bldg_1', { companyId: COMPANY, projectId: PROJECT });
  });

  it('Α30.1 — δηλωμένο `projectId` ⇒ declared (καμία ανάγνωση αλυσίδας)', async () => {
    expect(await resolve({ projectId: PROJECT })).toEqual({ outcome: 'declared', projectId: PROJECT });
  });

  it('🔴 Α30.2 — ακίνητο με `projectId` ⇒ derived (το ζωντανό SUPERSEDED της 2026-09-17)', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, projectId: PROJECT });
    expect(await resolve(file('property', 'prop_1'))).toEqual({ outcome: 'derived', projectId: PROJECT });
  });

  it('🔴 Α30.3 — όροφος ΧΩΡΙΣ `projectId` ⇒ μέσω κτιρίου', async () => {
    fake.seed(COLLECTIONS.FLOORS, 'flr_1', { companyId: COMPANY, buildingId: 'bldg_1' });
    expect(await resolve(file('floor', 'flr_1'))).toEqual({ outcome: 'derived', projectId: PROJECT });
  });

  it('Α30.4 — οντότητα `project` ⇒ το ίδιο της το id', async () => {
    expect(await resolve(file('project', PROJECT))).toEqual({ outcome: 'derived', projectId: PROJECT });
  });

  it('⛔ Α30.5 — ΞΕΝΟΣ μισθωτής σε οποιονδήποτε κρίκο ⇒ chain-broken, ΠΟΤΕ έργο άλλου', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_x', { companyId: FOREIGN, projectId: PROJECT });
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_y', { companyId: COMPANY, projectId: 'proj_foreign' });
    fake.seed(COLLECTIONS.PROJECTS, 'proj_foreign', { companyId: FOREIGN });

    expect(await resolve(file('property', 'prop_x'))).toEqual({ outcome: 'none', why: 'chain-broken' });
    expect(await resolve(file('property', 'prop_y'))).toEqual({ outcome: 'none', why: 'chain-broken' });
  });

  it('Α30.6 — επαφή (εκτός έργων) · ακίνητο χωρίς έργο · χωρίς οντότητα — ονομασμένα', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_free', { companyId: COMPANY });

    expect(await resolve(file('unknown_kind', 'x'))).toEqual({ outcome: 'none', why: 'entity-outside-projects' });
    expect(await resolve(file('property', 'prop_free'))).toEqual({ outcome: 'none', why: 'entity-without-project' });
    expect(await resolve({ companyId: COMPANY })).toEqual({ outcome: 'none', why: 'no-entity' });
  });
});

// =============================================================================
// Α31 — Η ΣΦΡΑΓΙΣΗ ΣΤΗΝ ΕΙΣΟΔΟ ΣΤΟ CDE
// =============================================================================

describe('Α31 — ο γραφέας κατάστασης σφραγίζει έργο + ομάδα', () => {
  const FILE = 'file_plan';
  const actor = { uid: CREATOR, companyId: COMPANY, globalRole: 'internal_user', permissions: ['iso19650:containers:share'] };
  const share = () => transitionContainer({ fileId: FILE, act: 'share', actor } as never);

  beforeEach(() => {
    fake.seed(COLLECTIONS.PROJECTS, PROJECT, { companyId: COMPANY });
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, projectId: PROJECT });
    fake.seed(COLLECTIONS.FILES, FILE, {
      id: FILE, companyId: COMPANY, createdBy: CREATOR, entityType: 'property', entityId: 'prop_1', status: 'ready',
    });
  });

  it('🔴 Α31.1 — μέλος μπαίνει στο CDE ⇒ `projectId` από την οντότητα ΚΑΙ `cdeTeamId` από το έγγραφο μέλους', async () => {
    await enrollProjectMembers(db(), [request()]);

    expect((await share()).kind).toBe('transitioned');
    expect(fake.all(COLLECTIONS.FILES)[0]).toEqual(expect.objectContaining({ projectId: PROJECT, cdeTeamId: COMPANY }));
  });

  it('⚠️ Α31.2 — ΜΗ μέλος ⇒ η πράξη ΔΕΝ αρνείται (αλλιώς σπάει η «νέα έκδοση»), η ομάδα ΔΕΝ μαντεύεται', async () => {
    expect((await share()).kind).toBe('transitioned');
    const stored = fake.all<Record<string, unknown>>(COLLECTIONS.FILES)[0];
    expect(stored.projectId).toBe(PROJECT);
    expect(stored).not.toHaveProperty('cdeTeamId');
  });
});

// =============================================================================
// Α32 — ΤΟ BACKFILL
// =============================================================================

describe('Α32 — το backfill των υπαρχόντων', () => {
  beforeEach(() => {
    fake.seed(COLLECTIONS.PROJECTS, PROJECT, { companyId: COMPANY, createdBy: CREATOR });
    fake.seed(COLLECTIONS.PROJECTS, 'proj_orphan', { companyId: COMPANY });
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, projectId: PROJECT });
    fake.seed(COLLECTIONS.FILES, 'file_old', {
      companyId: COMPANY, cdeState: 'SUPERSEDED', entityType: 'property', entityId: 'prop_1',
    });
  });

  it('Α32.1 — dry-run αναφέρει και ΔΕΝ γράφει', async () => {
    const report = await backfillProjectTeams(db(), { dryRun: true });

    expect(report).toEqual(expect.objectContaining({
      projectsScanned: 2, membersEnrolled: 1, projectsWithoutOwner: ['proj_orphan'],
      containersSealed: [{ fileId: 'file_old', projectId: PROJECT }],
    }));
    expect(members()).toEqual([]);
    expect(fake.all<Record<string, unknown>>(COLLECTIONS.FILES)[0]).not.toHaveProperty('projectId');
  });

  it('🔴 Α32.2 — εκτέλεση γράφει· ΔΕΥΤΕΡΗ εκτέλεση = 0 (ιδεμπότητο)', async () => {
    await backfillProjectTeams(db(), { dryRun: false });
    const second = await backfillProjectTeams(db(), { dryRun: false });

    expect(members()).toEqual([expect.objectContaining({ uid: CREATOR, enrollment: 'backfill', cdeAudience: 'design' })]);
    expect(fake.all<Record<string, unknown>>(COLLECTIONS.FILES)[0].projectId).toBe(PROJECT);
    expect(second).toEqual(expect.objectContaining({ membersEnrolled: 0, alreadyMembers: 1, containersSealed: [] }));
  });
});
