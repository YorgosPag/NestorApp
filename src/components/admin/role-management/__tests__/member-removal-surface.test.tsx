/**
 * 🔴 **Η ΕΠΙΦΑΝΕΙΑ ΤΗΣ ΑΦΑΙΡΕΣΗΣ, ΤΗΣ ΠΑΥΣΗΣ ΚΑΙ ΤΗΣ ΕΠΑΝΑΦΟΡΑΣ ΜΕΛΟΥΣ** (ADR-892 Φ2 · Φ2β).
 * @related MemberExitDialog · RestoreAccessDialog · useMemberExit · member-exit-labels · UserTable · UserRowActions
 *
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * 1. Δείξε τη φόρμα και σε άρνηση της προεπισκόπησης (βγάλε το `refusal === null`) → **Α2**.
 * 2. Δείξε το κουμπί πράξης όταν η προεπισκόπηση απέτυχε → **Α3**.
 * 3. Αγνόησε το `isHomeWorkspace` → **Α1**.
 * 4. Κάνε το 409 `EXIT_REFUSED` να πέφτει στο γενικό `failed` → **Β1**.
 * 5. Σβήσε το `!isSelf` από τον φρουρό του κουμπιού → **Γ1**.
 * 6. Κρέμασε το κουμπί από το `canEdit` αντί για το `canRemove` → **Γ2**.
 * 7. Σβήσε τον κλάδο `loadFailed` του πίνακα → **Γ3** («Δεν βρέθηκαν χρήστες» για αποτυχία, §7).
 * 8. Στείλε την παύση χωρίς `?intent=pause` στην προεπισκόπηση → **Π1** (θα έκρινε αφαίρεση).
 * 9. Βγάλε το `offersTransfer &&` (μεταβίβαση πάντα) → **Π2**.
 * 10. Δείξε το «Παύση» σε μέλος ήδη σε παύση → **Λ1**.
 * 11. Κρέμασε το κουμπί λογαριασμού από το `status` αντί για το `disabled` → **Λ2**.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockNotify = { success: jest.fn(), warning: jest.fn(), error: jest.fn() };

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: {
    get: (url: string) => mockGet(url),
    post: (url: string, body: unknown) => mockPost(url, body),
    patch: (url: string, body: unknown) => mockPatch(url, body),
  },
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => mockNotify,
}));

jest.mock('@/lib/intl-formatting', () => ({
  formatRelativeTime: (iso: string) => `rel(${iso})`,
}));

type Kids = { children?: React.ReactNode };

// Ίδιο σκεπτικό με τη `workspace-invite-surface`: ο Radix ζει σε portal που το jsdom δεν προσομοιώνει.
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: Kids & { open?: boolean }) => (open ? <section>{children}</section> : null),
  DialogContent: ({ children }: Kids) => <section>{children}</section>,
  DialogHeader: ({ children }: Kids) => <header>{children}</header>,
  DialogTitle: ({ children }: Kids) => <h2>{children}</h2>,
  DialogDescription: ({ children }: Kids) => <p>{children}</p>,
  DialogFooter: ({ children }: Kids) => <footer>{children}</footer>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: Kids) => <span>{children}</span>,
  Tooltip: ({ children }: Kids) => <span>{children}</span>,
  TooltipTrigger: ({ children }: Kids) => <span>{children}</span>,
  TooltipContent: ({ children }: Kids) => <span>{children}</span>,
}));

import { ApiClientError } from '@/lib/api/api-client-types';
import { MemberExitDialog } from '../components/MemberExitDialog';
import { RestoreAccessDialog } from '../components/RestoreAccessDialog';
import { UserTable } from '../components/UserTable';
import {
  MEMBER_EXIT_KEYS,
  MEMBER_EXIT_MODE_KEYS,
  MEMBER_EXIT_REFUSAL_KEY,
  MEMBER_PAUSE_KEYS,
  MEMBER_RESTORE_KEYS,
} from '../member-exit-labels';
import type { CompanyUser } from '../types';

function userWith(overrides: Partial<CompanyUser> = {}): CompanyUser {
  return {
    uid: 'u_target',
    email: 'staff@example.com',
    displayName: 'Staff',
    photoURL: null,
    globalRole: 'external_user',
    status: 'active',
    mfaEnrolled: false,
    lastSignIn: null,
    projectCount: 0,
    permissionSetIds: [],
    projectMemberships: [],
    companyId: 'comp_1',
    disabled: false,
    accessPause: null,
    ...overrides,
  };
}

const HEIR = userWith({ uid: 'u_heir', displayName: 'Διαχειριστής', email: 'admin@example.com', globalRole: 'company_admin' });

function previewWith(overrides: Record<string, unknown> = {}) {
  return { preview: { verdict: { kind: 'allowed' }, heirUid: 'u_heir', actTeams: 2, isHomeWorkspace: false, ...overrides } };
}

const REMOVAL = MEMBER_EXIT_MODE_KEYS.removal;
const PAUSE = MEMBER_EXIT_MODE_KEYS.pause;
const URL = '/api/admin/role-management/users/u_target/membership';

function renderDialog(onSuccess = jest.fn(), mode: 'removal' | 'pause' = 'removal') {
  render(
    <MemberExitDialog mode={mode} user={userWith()} members={[userWith(), HEIR]} open onClose={jest.fn()} onSuccess={onSuccess} />,
  );
  return onSuccess;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Α — ο διάλογος δείχνει ΠΡΩΤΑ τι θα γίνει', () => {
  it('Α1: οικείος χώρος ⇒ λέει ότι θα αποσυνδεθεί· ο κληρονόμος ονομάζεται', async () => {
    mockGet.mockResolvedValue(previewWith({ isHomeWorkspace: true }));
    renderDialog();
    expect(await screen.findByText(MEMBER_EXIT_KEYS.signsOut)).toBeInTheDocument();
    expect(screen.queryByText(MEMBER_EXIT_KEYS.staysSignedIn)).not.toBeInTheDocument();
    expect(screen.getByText(MEMBER_EXIT_KEYS.heir)).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/api/admin/role-management/users/u_target/membership');
  });

  it('Α2: άρνηση στην προεπισκόπηση ⇒ λόγος με όνομα και ΚΑΝΕΝΑ κουμπί πράξης', async () => {
    mockGet.mockResolvedValue(previewWith({ verdict: { kind: 'last-manager' } }));
    renderDialog();
    expect(await screen.findByText(MEMBER_EXIT_REFUSAL_KEY['last-manager'])).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: REMOVAL.confirm })).not.toBeInTheDocument();
  });

  it('Α3: αποτυχία προεπισκόπησης ⇒ επανάληψη, ποτέ πράξη στα τυφλά', async () => {
    mockGet.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(previewWith());
    renderDialog();
    expect(await screen.findByText(MEMBER_EXIT_KEYS.previewFailed)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: REMOVAL.confirm })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: MEMBER_EXIT_KEYS.retry }));
    expect(await screen.findByRole('button', { name: REMOVAL.confirm })).toBeInTheDocument();
  });
});

describe('Β — η πράξη', () => {
  it('Β1: 409 EXIT_REFUSED ⇒ ο λόγος του διακομιστή εμφανίζεται με όνομα, όχι γενικό σφάλμα', async () => {
    mockGet.mockResolvedValue(previewWith());
    mockPost.mockRejectedValue(
      new ApiClientError('conflict', 409, 'HTTP_409', undefined, undefined, undefined, {
        error: 'EXIT_REFUSED',
        reason: 'outranks-actor',
      }),
    );
    const onSuccess = renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: REMOVAL.confirm }));
    expect(await screen.findByText(MEMBER_EXIT_REFUSAL_KEY['outranks-actor'])).toBeInTheDocument();
    expect(mockNotify.error).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('Β2: επιτυχία ⇒ POST με τον λόγο, ειδοποίηση, onSuccess', async () => {
    mockGet.mockResolvedValue(previewWith());
    mockPost.mockResolvedValue({ status: 'removed' });
    const onSuccess = renderDialog();
    await userEvent.type(await screen.findByRole('textbox'), '  αποχώρησε  ');
    await userEvent.click(screen.getByRole('button', { name: REMOVAL.confirm }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith('/api/admin/role-management/users/u_target/membership', { reason: 'αποχώρησε' });
    expect(mockNotify.success).toHaveBeenCalledWith(REMOVAL.success);
  });

  it('Β3: 503 ⇒ γενικό σφάλμα (ασφαλής επανάληψη), ο διάλογος μένει', async () => {
    mockGet.mockResolvedValue(previewWith());
    mockPost.mockRejectedValue(new ApiClientError('x', 503, 'HTTP_503', undefined, undefined, undefined, { error: 'EXIT_FAILED' }));
    const onSuccess = renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: REMOVAL.confirm }));
    await waitFor(() => expect(mockNotify.error).toHaveBeenCalledWith(REMOVAL.error));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: REMOVAL.confirm })).toBeInTheDocument();
  });
});

function renderTable(props: Partial<React.ComponentProps<typeof UserTable>> = {}) {
  const noop = jest.fn();
  render(
    <UserTable
      users={[userWith({ uid: 'u_self', email: 'me@example.com' }), userWith()]}
      currentUserId="u_self"
      canEdit={false}
      canRemove
      isLoading={false}
      loadFailed={false}
      onRetry={noop}
      sortBy="name"
      sortOrder="asc"
      onSort={noop}
      onChangeRole={noop}
      onManagePermissions={noop}
      onSuspend={noop}
      onRemove={noop}
      onPauseAccess={noop}
      onRestoreAccess={noop}
      onViewDetails={noop}
      onApprove={noop}
      onDeny={noop}
      {...props}
    />,
  );
}

describe('Γ — ο πίνακας', () => {
  it('Γ1: το κουμπί φαίνεται στο ΑΛΛΟ μέλος, ποτέ στον εαυτό', () => {
    renderTable();
    expect(screen.getAllByRole('button', { name: REMOVAL.button })).toHaveLength(1);
  });

  it('Γ2: το κουμπί κρέμεται από το canRemove (users:users:manage), όχι από το canEdit', () => {
    renderTable({ canRemove: false, canEdit: true });
    expect(screen.queryByRole('button', { name: REMOVAL.button })).not.toBeInTheDocument();
  });

  it('Γ3: αποτυχία ανάγνωσης ⇒ λέει «απέτυχε» με επανάληψη, ΟΧΙ «δεν βρέθηκαν χρήστες» (§7)', async () => {
    const onRetry = jest.fn();
    renderTable({ users: [], loadFailed: true, onRetry });
    expect(screen.getByText('roleManagement.usersTab.loadFailed')).toBeInTheDocument();
    expect(screen.queryByText('roleManagement.usersTab.noUsers')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'roleManagement.usersTab.retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('Π — η παύση πρόσβασης (Φ2β): ο ΙΔΙΟΣ διάλογος, άλλη κρίση, άλλη πράξη', () => {
  it('Π1: προεπισκόπηση με `?intent=pause` · «μένει μέλος» · ομάδες που ΜΕΝΟΥΝ (όχι «μεταβιβάζονται»)', async () => {
    mockGet.mockResolvedValue(previewWith());
    renderDialog(jest.fn(), 'pause');
    expect(await screen.findByText(MEMBER_PAUSE_KEYS.staysMember)).toBeInTheDocument();
    expect(screen.getByText(MEMBER_PAUSE_KEYS.actTeamsKept)).toBeInTheDocument();
    expect(screen.queryByText(MEMBER_EXIT_KEYS.actTeams)).not.toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith(`${URL}?intent=pause`);
  });

  it('Π2 🔴 η μεταβίβαση είναι ΕΠΙΛΟΓΗ: χωρίς τσεκ ⇒ `false`· με τσεκ ⇒ `true`', async () => {
    mockGet.mockResolvedValue(previewWith());
    mockPatch.mockRejectedValueOnce(new ApiClientError('x', 503, 'HTTP_503', undefined, undefined, undefined, { error: 'EXIT_FAILED' }));
    renderDialog(jest.fn(), 'pause');
    await userEvent.click(await screen.findByRole('button', { name: PAUSE.confirm }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith(URL, { action: 'pause', transferActTeams: false }));

    mockPatch.mockReset().mockResolvedValue({ status: 'paused' });
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: PAUSE.confirm }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith(URL, { action: 'pause', transferActTeams: true }));
  });

  it('Π3: καμία ομάδα ⇒ ΚΑΝΕΝΑ κουτί μεταβίβασης (δεν ρωτάμε για κάτι που δεν υπάρχει)', async () => {
    mockGet.mockResolvedValue(previewWith({ actTeams: 0 }));
    renderDialog(jest.fn(), 'pause');
    await screen.findByText(MEMBER_PAUSE_KEYS.staysMember);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('Π4: άρνηση `self-pause` από την πράξη ⇒ λόγος με όνομα', async () => {
    mockGet.mockResolvedValue(previewWith());
    mockPatch.mockRejectedValue(
      new ApiClientError('conflict', 409, 'HTTP_409', undefined, undefined, undefined, { error: 'EXIT_REFUSED', reason: 'self-pause' }),
    );
    renderDialog(jest.fn(), 'pause');
    await userEvent.click(await screen.findByRole('button', { name: PAUSE.confirm }));
    expect(await screen.findByText(MEMBER_EXIT_REFUSAL_KEY['self-pause'])).toBeInTheDocument();
  });
});

describe('Ε — η επαναφορά πρόσβασης', () => {
  const PAUSED = userWith({ status: 'suspended', accessPause: { pausedByUid: 'u_heir', reason: 'άδεια', pausedAt: null } });

  it('Ε1: δείχνει ΠΟΙΟΣ έβαλε την παύση και ΓΙΑΤΙ · PATCH `restore` · ειδοποίηση', async () => {
    mockPatch.mockResolvedValue({ status: 'restored' });
    const onSuccess = jest.fn();
    render(<RestoreAccessDialog user={PAUSED} members={[PAUSED, HEIR]} open onClose={jest.fn()} onSuccess={onSuccess} />);
    expect(screen.getByText(MEMBER_RESTORE_KEYS.pausedBy)).toBeInTheDocument();
    expect(screen.getByText(MEMBER_RESTORE_KEYS.pausedReason)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: MEMBER_RESTORE_KEYS.confirm }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockPatch).toHaveBeenCalledWith(URL, { action: 'restore' });
    expect(mockNotify.success).toHaveBeenCalledWith(MEMBER_RESTORE_KEYS.success);
  });

  it('Ε2: 409 `outranks-actor` ⇒ λόγος με όνομα, καμία επιτυχία', async () => {
    mockPatch.mockRejectedValue(
      new ApiClientError('conflict', 409, 'HTTP_409', undefined, undefined, undefined, { error: 'EXIT_REFUSED', reason: 'outranks-actor' }),
    );
    const onSuccess = jest.fn();
    render(<RestoreAccessDialog user={PAUSED} members={[PAUSED]} open onClose={jest.fn()} onSuccess={onSuccess} />);
    await userEvent.click(screen.getByRole('button', { name: MEMBER_RESTORE_KEYS.confirm }));
    expect(await screen.findByText(MEMBER_EXIT_REFUSAL_KEY['outranks-actor'])).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('Λ — δύο καταστάσεις, δύο κάτοχοι στη γραμμή', () => {
  it('Λ1: ενεργό μέλος ⇒ «Παύση»· σε παύση ⇒ «Επαναφορά» (ποτέ και τα δύο)', () => {
    renderTable({ users: [userWith({ uid: 'u_self' }), userWith(), userWith({ uid: 'u_paused', status: 'suspended' })] });
    expect(screen.getAllByRole('button', { name: PAUSE.button })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: MEMBER_RESTORE_KEYS.button })).toHaveLength(1);
  });

  it('Λ2 🔴 «Αναστολή λογαριασμού» κρίνει από το `disabled`, ΟΧΙ από την κατάσταση μέλους', () => {
    // ⚠️ Ανά ΓΡΑΜΜΗ, όχι μετρήσεις: μια μέτρηση άφηνε δύο λάθος γραμμές να αλληλοαναιρούνται (μετάλλαξη M8, 2026-09-27).
    renderTable({
      canEdit: true,
      users: [
        userWith({ uid: 'u_self' }),
        userWith({ uid: 'u_paused', email: 'paused@example.com', status: 'suspended', disabled: false }),
        userWith({ uid: 'u_off', email: 'off@example.com', status: 'active', disabled: true }),
      ],
    });
    const rowOf = (email: string) => within(screen.getByText(email).closest('tr') as HTMLElement);
    expect(rowOf('paused@example.com').getByRole('button', { name: 'roleManagement.actions.suspendAccount' })).toBeInTheDocument();
    expect(rowOf('off@example.com').getByRole('button', { name: 'roleManagement.actions.reactivateAccount' })).toBeInTheDocument();
    expect(rowOf('off@example.com').getByText('roleManagement.statusLabels.accountDisabled')).toBeInTheDocument();
    expect(rowOf('paused@example.com').queryByText('roleManagement.statusLabels.accountDisabled')).not.toBeInTheDocument();
  });
});
