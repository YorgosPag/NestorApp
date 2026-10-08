/**
 * 🔴 **Η ΕΠΙΦΑΝΕΙΑ ΤΗΣ ΑΠΟΧΩΡΗΣΗΣ** (ADR-892 Φ3, §13).
 * @related LeaveWorkspaceDialog · use-leave-workspace · exit-action · leave-workspace-labels
 *
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * 1. Δείξε το κουμπί πριν φορτώσει η προεπισκόπηση → **Π1**.
 * 2. Βγάλε το όνομα του γραφείου από το κουμπί → **Π1**.
 * 3. Δείξε το κουμπί σε άρνηση `last-manager` ή σβήσε τον δρόμο «Διαχείριση ρόλων» → **Α1**.
 * 4. Δείξε το κουμπί όταν η προεπισκόπηση απέτυχε → **Α2**.
 * 5. Φύγε στο `/home` ΠΡΙΝ στηθεί η νέα συνεδρία (π.χ. αμέσως μετά την υιοθέτηση) → **Σ2**.
 * 6. Αγνόησε το `unchanged` και περίμενε νέα συνεδρία που δεν θα έρθει ποτέ → **Σ1**.
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (url: string) => mockGet(url), post: (url: string, body: unknown) => mockPost(url, body) },
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}${JSON.stringify(options)}` : key),
  }),
}));

jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ info: jest.fn() }) }));

type AuthState = { user: object | null; sessionPhase: string; signOut: jest.Mock };
const authState: AuthState = { user: { uid: 'u_self' }, sessionPhase: 'established', signOut: jest.fn() };
jest.mock('@/auth', () => ({ useAuth: () => authState }));

const mockAdopt = jest.fn();
jest.mock('@/auth/issued-session', () => ({ adoptIssuedSession: (token: string) => mockAdopt(token) }));

const mockRouter = { replace: jest.fn(), push: jest.fn() };
type Kids = { children?: React.ReactNode };
jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => mockRouter,
  Link: ({ children, href }: Kids & { href: string }) => <a href={href}>{children}</a>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: Kids & { open?: boolean }) => (open ? <section>{children}</section> : null),
  DialogContent: ({ children }: Kids) => <section>{children}</section>,
  DialogHeader: ({ children }: Kids) => <header>{children}</header>,
  DialogTitle: ({ children }: Kids) => <h2>{children}</h2>,
  DialogDescription: ({ children }: Kids) => <p>{children}</p>,
  DialogFooter: ({ children }: Kids) => <footer>{children}</footer>,
}));

import { ApiClientError } from '@/lib/api/api-client-types';
import LeaveWorkspaceDialog from '../LeaveWorkspaceDialog';
import { LEAVE_REFUSAL_KEY, LEAVE_WORKSPACE_KEYS as K } from '../leave-workspace-labels';

const mockNavigateDocument = jest.fn();
jest.mock('@/lib/browser/document-navigation', () => ({
  navigateDocument: (url: string, options?: unknown) => mockNavigateDocument(url, options),
}));

/** Πλήρης πλοήγηση στο /home, **χωρίς** να μείνει το γραφείο στο ιστορικό. */
const docNav = {
  get calledHome() { return mockNavigateDocument.mock.calls.some(([url, opts]) => url === '/home' && (opts as { replace?: boolean })?.replace === true); },
  get called() { return mockNavigateDocument.mock.calls.length > 0; },
};

function previewWith(overrides: Record<string, unknown> = {}) {
  return {
    preview: { verdict: { kind: 'allowed' }, heirUid: 'u_heir', actTeams: 2, isHomeWorkspace: false, ...overrides },
    workspaceName: 'PLATO',
    heirName: 'Μαρία',
  };
}

function confirmButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: new RegExp(`^${K.confirm}`) });
}

beforeEach(() => {
  jest.clearAllMocks();
  authState.user = { uid: 'u_self' };
  authState.sessionPhase = 'established';
});

describe('Π — πρώτα τι θα γίνει, μετά το κουμπί', () => {
  it('Π1 🔴 — κανένα κουμπί όσο φορτώνει· μετά κουμπί με το ΟΝΟΜΑ του γραφείου + κληρονόμος', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mockGet.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<LeaveWorkspaceDialog open onClose={jest.fn()} />);
    expect(screen.getByText(K.loading)).toBeInTheDocument();
    expect(confirmButton()).toBeNull();

    await act(async () => { resolve(previewWith()); });
    expect(confirmButton()).toHaveTextContent('PLATO');
    expect(screen.getByText(new RegExp(`^${K.actTeamsTo}.*Μαρία`))).toBeInTheDocument();
  });
});

describe('Α — άρνηση και αποτυχία ΧΩΡΙΣ κουμπί πράξης', () => {
  it('Α1 🔴 — τελευταίος διαχειριστής: λόγος + δρόμος «Διαχείριση ρόλων», κανένα κουμπί αποχώρησης', async () => {
    mockGet.mockResolvedValue(previewWith({ verdict: { kind: 'last-manager' } }));
    render(<LeaveWorkspaceDialog open onClose={jest.fn()} />);
    expect(await screen.findByText(LEAVE_REFUSAL_KEY['last-manager'])).toBeInTheDocument();
    expect(confirmButton()).toBeNull();
    expect(screen.getByRole('link', { name: K.manageRoles })).toHaveAttribute('href', '/admin/role-management');
  });

  it('Α2 🔴 — η προεπισκόπηση απέτυχε: μόνο «Δοκιμάστε ξανά»', async () => {
    mockGet.mockRejectedValue(new Error('network'));
    render(<LeaveWorkspaceDialog open onClose={jest.fn()} />);
    expect(await screen.findByText(K.previewFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: K.retry })).toBeInTheDocument();
    expect(confirmButton()).toBeNull();
  });

  it('Α3 — άρνηση της ΠΡΑΞΗΣ (409) νικά την προεπισκόπηση', async () => {
    mockGet.mockResolvedValue(previewWith());
    mockPost.mockRejectedValue(new ApiClientError('x', 409, 'HTTP_409', undefined, undefined, undefined, { error: 'EXIT_REFUSED', reason: 'last-manager' }));
    render(<LeaveWorkspaceDialog open onClose={jest.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${K.confirm}`) }));
    expect(await screen.findByText(LEAVE_REFUSAL_KEY['last-manager'])).toBeInTheDocument();
    expect(docNav.called).toBe(false);
  });
});

describe('Σ — μετά την αποχώρηση', () => {
  it('Σ1 — ξένος χώρος (`unchanged`): κατευθείαν στο /home, καμία υιοθέτηση', async () => {
    mockGet.mockResolvedValue(previewWith());
    mockPost.mockResolvedValue({ status: 'left', home: { kind: 'untouched' }, session: { kind: 'unchanged' } });
    render(<LeaveWorkspaceDialog open onClose={jest.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${K.confirm}`) }));
    await waitFor(() => expect(docNav.calledHome).toBe(true));
    expect(mockAdopt).not.toHaveBeenCalled();
  });

  it('Σ2 🔴 — οικείος χώρος (`reissued`): /home ΜΟΝΟ αφού το AuthContext στήσει ΝΕΟ χρήστη', async () => {
    mockGet.mockResolvedValue(previewWith({ isHomeWorkspace: true }));
    mockPost.mockResolvedValue({ status: 'left', home: { kind: 'personal' }, session: { kind: 'reissued', token: 'tok' } });
    mockAdopt.mockResolvedValue({ kind: 'signed-in', uid: 'u_self' });
    const view = render(<LeaveWorkspaceDialog open onClose={jest.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${K.confirm}`) }));
    await waitFor(() => expect(mockAdopt).toHaveBeenCalledWith('tok'));
    expect(docNav.called).toBe(false);

    authState.sessionPhase = 'establishing';
    authState.user = null;
    view.rerender(<LeaveWorkspaceDialog open onClose={jest.fn()} />);
    expect(docNav.called).toBe(false);

    authState.sessionPhase = 'established';
    authState.user = { uid: 'u_self' };
    view.rerender(<LeaveWorkspaceDialog open onClose={jest.fn()} />);
    await waitFor(() => expect(docNav.calledHome).toBe(true));
  });

  // 🔑 ADR-908 — ο ΕΝΑΣ κάτοχος αποσυνδέει και πλοηγεί· η οθόνη δηλώνει μόνο τον λόγο, και ΔΕΝ πλοηγεί η ίδια.
  it('Σ3 🔴 — `ended` (χωρίς κλειδί): αποσύνδεση με λόγο `left-workspace`, καμία δική της πλοήγηση', async () => {
    mockGet.mockResolvedValue(previewWith({ isHomeWorkspace: true }));
    mockPost.mockResolvedValue({ status: 'left', home: { kind: 'personal' }, session: { kind: 'ended' } });
    render(<LeaveWorkspaceDialog open onClose={jest.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${K.confirm}`) }));
    await waitFor(() => expect(authState.signOut).toHaveBeenCalledWith({ reason: 'left-workspace' }));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(docNav.called).toBe(false);
  });
});
