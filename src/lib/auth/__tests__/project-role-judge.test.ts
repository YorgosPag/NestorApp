/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ — **ο κλάδος έργου του κριτή** (ADR-926 Κ1 · Κ2 · Κ4 · Κ5).
 *
 * Τρέχει ο πραγματικός `checkPermission` με τον πραγματικό κατάλογο ρόλων. Αντικαθίσταται μόνο ο αναγνώστης μέλους,
 * γιατί εκεί ζουν οι τέσσερις εκβάσεις που κρίνονται εδώ.
 */

import { checkPermission } from '../permissions';
import { PROJECT_SCOPED_ACTIONS } from '../project-scoped-actions';
import { PREDEFINED_ROLES } from '../role-catalogue';
import { readProjectMember, type ProjectMemberRead } from '../project-member-read';
import type { AuthContext, GlobalRole, PermissionId, ProjectMember } from '../types';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('../project-member-read', () => ({ readProjectMember: jest.fn() }));

const readMember = readProjectMember as jest.MockedFunction<typeof readProjectMember>;

function caller(globalRole: GlobalRole, mfaEnrolled = true): AuthContext {
  return { uid: 'u1', email: 'u@x.gr', companyId: 'co_a', globalRole, mfaEnrolled, isAuthenticated: true };
}

function member(roleId: string, extra: Partial<ProjectMember> = {}): ProjectMemberRead {
  return {
    outcome: 'member',
    member: { roleId, permissionSetIds: [], effectivePermissions: [], ...extra } as unknown as ProjectMember,
  };
}

const ON_PROJECT = { projectId: 'prj_a' };

beforeEach(() => readMember.mockReset());

describe('Κ2 — ο κλειστός κατάλογος', () => {
  it('κάθε πράξη του καταλόγου υπάρχει σε ρόλο έργου: καμία νεκρή γραμμή', () => {
    const projectRoles = Object.values(PREDEFINED_ROLES).filter((role) => role.isProjectRole);
    for (const action of PROJECT_SCOPED_ACTIONS) {
      expect(projectRoles.some((role) => (role.permissions as readonly string[]).includes(action))).toBe(true);
    }
  });

  it('⛔ η οριστική διαγραφή και η διαγραφή ορόφου δεν είναι πράξεις έργου', () => {
    expect(PROJECT_SCOPED_ACTIONS).not.toContain('trash:entities:purge');
    expect(PROJECT_SCOPED_ACTIONS).not.toContain('projects:floors:delete');
  });

  it('ο `project_manager` δεν φέρει ούτε καν στον κατάλογο τη διαγραφή ορόφου', () => {
    expect(PREDEFINED_ROLES.project_manager.permissions).not.toContain('projects:floors:delete');
    expect(PREDEFINED_ROLES.project_manager.permissions).not.toContain('trash:entities:purge');
  });

  it('το `effectivePermissions` του εγγράφου δεν ανοίγει πράξη εκτός καταλόγου', async () => {
    readMember.mockResolvedValue(member('viewer', { effectivePermissions: ['projects:floors:delete'] as PermissionId[] }));

    const result = await checkPermission(caller('internal_user'), 'projects:floors:delete', ON_PROJECT);

    expect(result).toEqual({ granted: false, reason: 'permission_not_in_role' });
    expect(readMember).not.toHaveBeenCalled();
  });

  it('πράξη του ρόλου εκτός καταλόγου μένει κλειστή, ακόμη κι αν το μέλος είναι PM', async () => {
    readMember.mockResolvedValue(member('project_manager'));

    const result = await checkPermission(caller('internal_user'), 'properties:properties:create', ON_PROJECT);

    expect(result.granted).toBe(false);
  });
});

describe('Κ1 — αθροιστικός κριτής', () => {
  it('μέλος PM: η πράξη του καταλόγου περνά με πηγή `project_role`', async () => {
    readMember.mockResolvedValue(member('project_manager'));

    const result = await checkPermission(caller('internal_user'), 'buildings:buildings:update', ON_PROJECT);

    expect(result).toEqual({ granted: true, reason: null, source: 'project_role' });
  });

  it('η ανάγνωση μέλους γίνεται στον μισθωτή του καλούντα, με το έργο που δόθηκε', async () => {
    readMember.mockResolvedValue(member('project_manager'));

    await checkPermission(caller('internal_user'), 'buildings:buildings:update', ON_PROJECT);

    expect(readMember).toHaveBeenCalledWith({ companyId: 'co_a', projectId: 'prj_a', uid: 'u1' });
  });

  it('μέλος `viewer` δεν χάνει ό,τι δίνει η εταιρεία, και δεν διαβάζεται καν', async () => {
    readMember.mockResolvedValue(member('viewer'));

    const result = await checkPermission(caller('company_admin'), 'buildings:buildings:update', ON_PROJECT);

    expect(result).toEqual({ granted: true, reason: null, source: 'global_role' });
    expect(readMember).not.toHaveBeenCalled();
  });

  it('μέλος `viewer` χωρίς εταιρικό δικαίωμα απορρίπτεται', async () => {
    readMember.mockResolvedValue(member('viewer'));

    const result = await checkPermission(caller('internal_user'), 'buildings:buildings:update', ON_PROJECT);

    expect(result).toEqual({ granted: false, reason: 'permission_not_in_role' });
  });

  it('το σύνολο δικαιωμάτων με MFA κόβει τον κλάδο έργου, όχι της εταιρείας', async () => {
    readMember.mockResolvedValue(member('project_manager', { permissionSetIds: ['dxf_editor'] as ProjectMember['permissionSetIds'] }));

    expect((await checkPermission(caller('company_admin', false), 'buildings:buildings:update', ON_PROJECT)).granted).toBe(true);
  });
});

describe('Κ4 · Κ5 — όρια και κλειστή αστοχία', () => {
  it('Κ4 — χωρίς έργο, ο ρόλος έργου δεν έχει σημείο εφαρμογής', async () => {
    readMember.mockResolvedValue(member('project_manager'));

    const result = await checkPermission(caller('internal_user'), 'buildings:buildings:update', {});

    expect(result.granted).toBe(false);
    expect(readMember).not.toHaveBeenCalled();
  });

  it('μη μέλος απορρίπτεται με ρητό λόγο', async () => {
    readMember.mockResolvedValue({ outcome: 'absent' });

    const result = await checkPermission(caller('internal_user'), 'buildings:buildings:update', ON_PROJECT);

    expect(result).toEqual({ granted: false, reason: 'no_project_membership' });
  });

  for (const outcome of ['unknown', 'unreadable'] as const) {
    it(`Κ5 — ανάγνωση «${outcome}»: ο κλάδος έργου αρνείται, της εταιρείας κρίνεται κανονικά`, async () => {
      readMember.mockResolvedValue({ outcome, why: 'test' });

      const denied = await checkPermission(caller('internal_user'), 'buildings:buildings:update', ON_PROJECT);
      const granted = await checkPermission(caller('company_admin'), 'buildings:buildings:update', ON_PROJECT);

      expect(denied).toEqual({ granted: false, reason: 'no_project_membership' });
      expect(granted.granted).toBe(true);
    });
  }
});
