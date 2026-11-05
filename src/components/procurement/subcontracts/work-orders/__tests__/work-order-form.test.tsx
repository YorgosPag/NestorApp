/**
 * ADR-928 §5.24 — «Νέα εντολή εργασίας»: το σώμα κρίνεται από το ΣΧΗΜΑ ΤΗΣ ΔΙΑΔΡΟΜΗΣ, το δικαίωμα από το ΕΡΓΟ-ΣΤΟΧΟ
 * (ποτέ το έργο της σελίδας), η υποβολή στέλνει CAS με τη ζωντανή αναθεώρηση, και ο διάλογος δεν κρύβει γιατί είναι
 * ανενεργός.
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ProjectViewerCapabilities } from '@/lib/auth/project-scoped-actions';
import { sampleAgreement, sampleProjectIdentity } from '@/subapps/procurement/subcontracts/agreements/__tests__/agreement-fixtures';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { assignSubcontractAgreement } from '@/services/procurement/subcontracts/subcontract-agreements-api.client';
import NewWorkOrderDialog from '../NewWorkOrderDialog';
import { patchWorkOrderFields, useWorkOrderForm, workOrderBodyOf, type WorkOrderFields } from '../useWorkOrderForm';

const mockCapabilities: Record<string, Partial<ProjectViewerCapabilities>> = {};
jest.mock('@/hooks/useProjectCapabilities', () => ({
  useProjectCapabilities: (projectId: string | null) => (projectId ? (mockCapabilities[projectId] ?? null) : null),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key), i18n: { language: 'el' } }),
}));
jest.mock('@/hooks/useFirestoreProjects', () => ({ useFirestoreProjects: () => ({ projects: [], loading: false }) }));
jest.mock('@/hooks/useFirestoreBuildings', () => ({ useFirestoreBuildings: () => ({ buildings: [] }) }));
jest.mock('@/hooks/procurement/subcontracts/useProjectSubcontractAgreements', () => ({
  useCompanyMasterSubcontractAgreements: () => ({ items: [], loading: false, error: null }),
}));
const mockSuccess = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ success: mockSuccess }) }));
jest.mock('../../subcontract-messages', () => ({ useSubcontractFailureExplainer: () => (cause: unknown) => (cause instanceof Error ? cause : new Error('failure')) }));
jest.mock('@/services/procurement/subcontracts/subcontract-agreements-api.client', () => ({ assignSubcontractAgreement: jest.fn() }));

const ASSIGN = 'subcontracts:agreements:assign';
const grant = (projectId: string, granted: boolean) => { mockCapabilities[projectId] = { [ASSIGN]: granted } as Partial<ProjectViewerCapabilities>; };

function master(status: SubcontractAgreement['status'] = 'accepted', revision = 7): SubcontractAgreement {
  const earlier = { id: 'scas_1', project: sampleProjectIdentity('proj_A'), startDate: '2026-10-01', durationDays: null, note: null, assignedBy: 'u', assignedAt: '' };
  return sampleAgreement({ id: 'sca_master', status, revision, scope: { kind: 'multi_project', assignments: [earlier] }, projectIds: ['proj_A'] });
}

const FIELDS: WorkOrderFields = { projectId: 'proj_B', buildingIds: ['bld_1'], startDate: '2026-12-01', durationDays: ' 30 ', note: '  ' };

beforeEach(() => {
  for (const key of Object.keys(mockCapabilities)) delete mockCapabilities[key];
  jest.mocked(assignSubcontractAgreement).mockReset();
  mockSuccess.mockReset();
});

describe('workOrderBodyOf — το σχήμα της διαδρομής, όχι δεύτερος κανόνας', () => {
  it('ζωντανή αναθεώρηση ως CAS · διάρκεια αριθμός · κενή σημείωση ⇒ null', () => {
    expect(workOrderBodyOf(master(), FIELDS)).toEqual({ expectedRevision: 7, projectId: 'proj_B', buildingIds: ['bld_1'], startDate: '2026-12-01', durationDays: 30, note: null });
  });
  it.each<[string, Partial<WorkOrderFields>]>([
    ['χωρίς έργο', { projectId: '' }],
    ['διάρκεια 0', { durationDays: '0' }],
    ['δεκαδική διάρκεια', { durationDays: '2.5' }],
    ['άκυρη ημερομηνία', { startDate: '2026-13-40' }],
  ])('%s ⇒ null (η διαδρομή θα το απέρριπτε)', (_label, patch) => {
    expect(workOrderBodyOf(master(), { ...FIELDS, ...patch })).toBeNull();
  });
  it('χωρίς σύμβαση ⇒ null', () => {
    expect(workOrderBodyOf(null, FIELDS)).toBeNull();
  });
});

describe('patchWorkOrderFields', () => {
  it('άλλο έργο ⇒ τα κτίρια του προηγούμενου σβήνουν (ο γραφέας θα έλεγε `buildingNotInProject`)', () => {
    expect(patchWorkOrderFields(FIELDS, { projectId: 'proj_C' }).buildingIds).toEqual([]);
    expect(patchWorkOrderFields(FIELDS, { projectId: 'proj_B', note: 'x' }).buildingIds).toEqual(['bld_1']);
  });
});

describe('useWorkOrderForm — δικαίωμα στο ΕΡΓΟ-ΣΤΟΧΟ', () => {
  it('δικαίωμα στο Α, όχι στο Β: ο στόχος Β ⇒ denied, ο Α ⇒ καμία αιτία', () => {
    grant('proj_A', true);
    grant('proj_B', false);
    const { result } = renderHook(() => useWorkOrderForm(master(), null));
    act(() => result.current.setFields({ projectId: 'proj_B' }));
    expect(result.current.block).toEqual({ kind: 'denied' });
    act(() => result.current.setFields({ projectId: 'proj_A' }));
    expect(result.current.block).toBeNull();
    expect(result.current.previous).toMatchObject({ number: 1, assignment: { id: 'scas_1' } });
  });

  it('χωρίς απάντηση του διακομιστή ⇒ checking (fail-closed)', () => {
    const { result } = renderHook(() => useWorkOrderForm(master(), 'proj_Z'));
    expect(result.current.block).toEqual({ kind: 'checking' });
  });

  it('σύμβαση που δεν δέχεται εντολή ⇒ η άρνηση του γραφέα, πριν από κάθε δικαίωμα', () => {
    grant('proj_A', true);
    const { result } = renderHook(() => useWorkOrderForm(master('issued'), 'proj_A'));
    expect(result.current.block?.kind).toBe('refusal');
  });
});

describe('NewWorkOrderDialog', () => {
  it('σταθερή σύμβαση + σταθερό έργο με δικαίωμα: η υποβολή στέλνει το σώμα με CAS και ειδοποιεί', async () => {
    grant('proj_B', true);
    const agreement = master();
    jest.mocked(assignSubcontractAgreement).mockResolvedValue(agreement);
    const onClose = jest.fn();
    render(<NewWorkOrderDialog agreement={agreement} fixedProjectId="proj_B" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('subcontracts.workOrders.dialog.duration'), { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: 'subcontracts.workOrders.dialog.submit' }));
    await waitFor(() => expect(assignSubcontractAgreement).toHaveBeenCalledWith('sca_master', { expectedRevision: 7, projectId: 'proj_B', buildingIds: [], startDate: null, durationDays: 14, note: null }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSuccess).toHaveBeenCalledWith('subcontracts.workOrders.dialog.created');
  });

  it('χωρίς δικαίωμα στο έργο-στόχο: κουμπί ανενεργό ΚΑΙ η αιτία γραμμένη — καμία κλήση', () => {
    grant('proj_B', false);
    render(<NewWorkOrderDialog agreement={master()} fixedProjectId="proj_B" onClose={jest.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('subcontracts.workOrders.blocked.denied');
    expect(screen.getByRole('button', { name: 'subcontracts.workOrders.dialog.submit' })).toBeDisabled();
    expect(assignSubcontractAgreement).not.toHaveBeenCalled();
  });
});
