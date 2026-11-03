/**
 * ADR-928 §5.15 · Φ3α-2 — η οθόνη κρίνει ποιο κουμπί φαίνεται με τον ΙΔΙΟ κανόνα πόρου που κρίνει ο διακομιστής
 * (`agreement-resource.server.ts`): `single_project` αυτού του έργου ⇒ δικαίωμα έργου · κύρια σύμβαση / άλλο έργο ⇒ μόνο
 * εταιρεία · εντολή εργασίας ⇒ έργο-στόχος · έγκριση απόκλισης ⇒ μόνο εταιρεία. Fail-closed σε κάθε «δεν ξέρω ακόμη».
 */

import { renderHook } from '@testing-library/react';
import { useCapabilities, type CapabilityGate } from '@/auth/hooks/useCapability';
import { useProjectCapabilities } from '@/hooks/useProjectCapabilities';
import type { ProjectViewerCapabilities } from '@/lib/auth/project-scoped-actions';
import type { PermissionId } from '@/lib/auth/types';
import { sampleAgreement, sampleProjectIdentity } from '@/subapps/procurement/subcontracts/agreements/__tests__/agreement-fixtures';
import { useSubcontractAuthority } from '../subcontracts/useSubcontractAuthority';

jest.mock('@/auth/hooks/useCapability', () => ({ useCapabilities: jest.fn() }));
jest.mock('@/hooks/useProjectCapabilities', () => ({ useProjectCapabilities: jest.fn() }));

const capabilities = jest.mocked(useCapabilities);
const projectCapabilities = jest.mocked(useProjectCapabilities);

const COMPANY_ACTIONS = ['subcontracts:agreements:manage', 'subcontracts:agreements:assign', 'subcontracts:agreements:approve_deviation'] as const;

/** Όπως το `gateFor`: όσο εκκρεμεί η ταυτότητα, η ετυμηγορία είναι άρνηση (fail-closed) — με `pending`. */
const gate = (action: PermissionId, granted: boolean, pending: boolean): CapabilityGate => ({
  action,
  verdict: !pending && granted ? 'granted-by-role' : pending ? 'denied-unauthenticated' : 'denied-insufficient',
  reason: null,
  pending,
});

function company(granted: readonly PermissionId[], pending = false) {
  const gates = Object.fromEntries(COMPANY_ACTIONS.map((action) => [action, gate(action, granted.includes(action), pending)]));
  capabilities.mockReturnValue(gates as Readonly<Record<PermissionId, CapabilityGate>>);
}

function project(manage: boolean, assign: boolean) {
  projectCapabilities.mockReturnValue({ 'subcontracts:agreements:manage': manage, 'subcontracts:agreements:assign': assign } as ProjectViewerCapabilities);
}

const single = (projectId: string) => sampleAgreement({ scope: { kind: 'single_project', project: sampleProjectIdentity(projectId) } });
const master = sampleAgreement({ scope: { kind: 'multi_project', assignments: [] } });

const view = () => renderHook(() => useSubcontractAuthority('proj_1')).result.current;

describe('useSubcontractAuthority', () => {
  it('διαχειριστής έργου (όχι εταιρεία): το συμφωνητικό ΤΟΥ έργου ναι · κύρια σύμβαση και άλλο έργο όχι', () => {
    company([]);
    project(true, true);
    const authority = view();
    expect(authority.canManage(single('proj_1'))).toBe(true);
    expect(authority.canManage(single('proj_2'))).toBe(false);
    expect(authority.canManage(master)).toBe(false);
    expect(authority.canAssign).toBe(true);
    expect(authority.canCreateMaster).toBe(false);
    expect(authority.canApproveDeviation).toBe(false);
  });

  it('εταιρεία: κύρια σύμβαση και έγκριση απόκλισης ναι· στο έργο κρίνει η απάντηση του διακομιστή', () => {
    company(['subcontracts:agreements:manage', 'subcontracts:agreements:approve_deviation']);
    project(true, false);
    const authority = view();
    expect(authority.canManage(master)).toBe(true);
    expect(authority.canManage(single('proj_1'))).toBe(true);
    expect(authority.canApproveDeviation).toBe(true);
    expect(authority.canAssign).toBe(false);
  });

  it('fail-closed: ταυτότητα σε εκκρεμότητα ή χωρίς απάντηση έργου ⇒ τίποτα', () => {
    company(['subcontracts:agreements:manage', 'subcontracts:agreements:approve_deviation'], true);
    projectCapabilities.mockReturnValue(null);
    const authority = view();
    expect(authority.canManage(master)).toBe(false);
    expect(authority.canManage(single('proj_1'))).toBe(false);
    expect(authority.canApproveDeviation).toBe(false);
    expect(authority.canCreateForProject).toBe(false);
  });
});
