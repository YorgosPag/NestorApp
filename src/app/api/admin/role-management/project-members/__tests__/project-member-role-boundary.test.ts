/**
 * Το σύνορο της ανάθεσης ρόλου έργου (ADR-926).
 * @related project-member-mutations · isProjectRoleId · AssignMemberDialog
 *
 * Βρέθηκε στον ζωντανό έλεγχο: ο διάλογος πρόσφερε καθολικούς ρόλους και ο διακομιστής
 * έγραφε ό,τι του έστελναν, οπότε ο ρόλος `project_manager` ήταν απρόσιτος.
 *
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * 1. Βγάλε τον έλεγχο από το `assignMember` → Α2, Α3.
 * 2. Βγάλε τον έλεγχο από το `updateMember` → Β2.
 * 3. Κάνε το `isProjectRoleId` να απαντά `true` σε κάθε γνωστό ρόλο → Α2, Β2, Γ1.
 * 4. Βγάλε το `Object.hasOwn` → Γ2.
 */

import type { AuthContext } from '@/lib/auth';
import { getProjectRoles, isProjectRoleId } from '@/lib/auth/roles';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import { assignMember, updateMember, type MutationContext } from '../project-member-mutations';
import type { PostBody } from '../types';

const mockEnroll = jest.fn();
const mockUpdate = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('@/lib/auth', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/auth/project-member-write', () => ({
  enrollProjectMembers: (...args: unknown[]) => mockEnroll(...args),
  updateProjectMember: (...args: unknown[]) => mockUpdate(...args),
  removeProjectMember: jest.fn(),
}));

function mutationWith(body: Partial<PostBody>): MutationContext {
  const validated: PostBody = {
    action: 'assign',
    projectId: 'proj_1',
    uid: 'user_1',
    reason: 'ζωντανός έλεγχος',
    ...body,
  };
  return {
    db: {} as MutationContext['db'],
    ctx: { uid: 'admin_1', companyId: 'comp_1' } as AuthContext,
    validated,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEnroll.mockResolvedValue([{ outcome: 'enrolled', uid: 'user_1', memberId: 'mem_1' }]);
  mockUpdate.mockResolvedValue({
    outcome: 'mutated',
    previous: { roleId: 'viewer', permissionSetIds: [] },
    applied: { roleId: 'project_manager' },
  });
});

describe('assignMember', () => {
  it('Α1: γράφει ρόλο έργου', async () => {
    const response = await assignMember(mutationWith({ roleId: 'project_manager' }));
    expect(response.status).toBe(200);
    expect(mockEnroll).toHaveBeenCalledTimes(1);
  });

  it.each([...GLOBAL_ROLES])('Α2: απορρίπτει τον καθολικό ρόλο %s χωρίς εγγραφή', async (roleId) => {
    const response = await assignMember(mutationWith({ roleId }));
    expect(response.status).toBe(400);
    expect(mockEnroll).not.toHaveBeenCalled();
  });

  it('Α3: απορρίπτει άγνωστο ρόλο χωρίς εγγραφή', async () => {
    const response = await assignMember(mutationWith({ roleId: 'project_manger' }));
    expect(response.status).toBe(400);
    expect(mockEnroll).not.toHaveBeenCalled();
  });
});

describe('updateMember', () => {
  it('Β1: δέχεται ρόλο έργου', async () => {
    const response = await updateMember(
      mutationWith({ action: 'update', roleId: 'project_manager' }),
    );
    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('Β2: απορρίπτει καθολικό ρόλο χωρίς εγγραφή', async () => {
    const response = await updateMember(
      mutationWith({ action: 'update', roleId: 'company_admin' }),
    );
    expect(response.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('Β3: χωρίς ρόλο περνά, γιατί αλλάζει μόνο σύνολα ή ομάδα', async () => {
    const response = await updateMember(
      mutationWith({ action: 'update', permissionSetIds: ['legal_viewer'] }),
    );
    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('isProjectRoleId', () => {
  it('Γ1: συμφωνεί με τον κατάλογο σε κάθε ρόλο', () => {
    const projectRoles = getProjectRoles();
    expect(projectRoles).toContain('project_manager');
    expect(projectRoles.every(isProjectRoleId)).toBe(true);
    expect(GLOBAL_ROLES.some(isProjectRoleId)).toBe(false);
  });

  it('Γ2: κληρονομημένα ονόματα του αντικειμένου δεν είναι ρόλοι', () => {
    expect(isProjectRoleId('constructor')).toBe(false);
    expect(isProjectRoleId('__proto__')).toBe(false);
  });
});
