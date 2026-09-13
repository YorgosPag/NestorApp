/**
 * 🔴 **Η ΔΙΟΙΚΗΤΙΚΗ ΕΠΙΦΑΝΕΙΑ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ** (ADR-853 Φ6 — ΒΗΜΑ Α).
 * @related useInviteCapability · InviteUserDialog · InvitationTable · useInvitationActions
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΕΙΝΑΙ ΟΙ **ΠΡΩΤΕΣ** ΑΓΚΥΡΕΣ ΓΙΑ ΤΟ `role-management`
 * ────────────────────────────────────────────────────────────────────────────
 * Μετρήθηκε: **καμία** σουίτα δεν υπήρχε για τους διαλόγους αυτής της κονσόλας. Κανένα
 * «καλύπτεται από υπάρχον πρότυπο» — ό,τι δεν γράφεται εδώ, δεν φυλάγεται πουθενά.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Βγάλε το `!invite.pending` από τον φρουρό → **Α1**.
 * 2. Άλλαξε το `WORKSPACE_INVITE_PERMISSION` σε άλλη ικανότητα → **Α4** (και στις δύο πόρτες).
 * 3. Κάνε τον διάλογο να καλεί `onClose()` **πάντα** μετά την έκδοση → **Β2**.
 * 4. Σβήσε το `warning(t(INVITE_KEYS.superseded))` → **Β3**.
 * 5. Βάλε `GLOBAL_ROLES` αντί για `INVITABLE_ROLES` στο Select → **Β6**.
 * 6. Βγάλε το `'expired'` από το `ACTIONABLE_STATES` → **Γ5**.
 * 7. Σβήσε το `if (result.setback.kind !== 'unavailable') refetch()` → **Δ1**.
 * 8. Κάνε την επαναποστολή να χτυπά δική της διαδρομή → **Δ3**.
 */

import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mockUseCapability = jest.fn();
const mockIssue = jest.fn();
const mockRevoke = jest.fn();
const mockNotify = { success: jest.fn(), warning: jest.fn(), error: jest.fn() };

jest.mock('@/auth/hooks/useCapability', () => ({
  useCapability: (action: string) => mockUseCapability(action),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => mockNotify,
}));

// 🔴 **ΤΟ `useSemanticColors` ΔΕΝ ΕΙΝΑΙ MOCK-ΑΡΙΣΜΕΝΟ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ — ΜΗΝ ΤΟ ΞΑΝΑΒΑΛΕΙΣ.**
//
// Η πρώτη γραφή αυτής της σουίτας το αντικατέστησε με `{ text: { muted: '' } }` και **17
// από τις 26** άγκυρες έσκασαν με `Cannot read properties of undefined (reading 'primary')`:
// το `badge.tsx` καλεί **το ίδιο** άγκιστρο και διαβάζει `colors.bg.primary`.
//
// 🔑 Η θεραπεία **δεν** ήταν παχύτερο mock. Το άγκιστρο είναι `useMemo` πάνω σε σταθερά
// (`COLOR_BRIDGE`) — μηδέν λογική, κανένα context, καμία παρενέργεια — άρα τρέχει μια χαρά
// στο jsdom. Κάθε χειρόγραφο σχήμα εδώ θα ήταν **δεύτερο λεξιλόγιο του design system**, που
// αποκλίνει σιωπηλά την πρώτη φορά που το `COLOR_BRIDGE` αποκτά κλειδί: η ίδια βλάβη, απλώς
// αργότερα και πιο δύσκολα. Το `useBorderTokens` δεν ήταν ποτέ mock-αρισμένο και δούλευε.

jest.mock('@/lib/intl-formatting', () => ({
  formatRelativeTime: (iso: string) => `rel(${iso})`,
}));

jest.mock('@/services/workspace/workspace-invitation.client', () => ({
  issueWorkspaceInvitationFromScreen: (input: unknown) => mockIssue(input),
  revokeWorkspaceInvitationFromScreen: (id: unknown) => mockRevoke(id),
}));

// ⚠️ **ΓΙΑΤΙ ΑΝΤΙΚΑΘΙΣΤΑΝΤΑΙ ΤΑ RADIX**: ο διάλογος και το `Select` ζουν σε portal με
//    pointer-events που το jsdom δεν προσομοιώνει. Διάφανα υποκατάστατα κρατούν την άγκυρα
//    πάνω στη **δική μας** λογική — τι επιλογές **δίνουμε**, τι κείμενο **λέμε** — αντί να
//    μετρούν τη βιβλιοθήκη. Το `SelectItem` κρατά το `value` ώστε να ελέγχεται το σύνολο.
type Kids = { children?: React.ReactNode };

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: Kids & { open?: boolean }) => (open ? <section>{children}</section> : null),
  DialogContent: ({ children }: Kids) => <section>{children}</section>,
  DialogHeader: ({ children }: Kids) => <header>{children}</header>,
  DialogTitle: ({ children }: Kids) => <h2>{children}</h2>,
  DialogDescription: ({ children }: Kids) => <p>{children}</p>,
  DialogFooter: ({ children }: Kids) => <footer>{children}</footer>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: Kids) => <fieldset>{children}</fieldset>,
  SelectTrigger: ({ children }: Kids) => <span>{children}</span>,
  SelectValue: () => null,
  SelectContent: ({ children }: Kids) => <ul>{children}</ul>,
  SelectItem: ({ value, children }: Kids & { value: string }) => (
    <li data-role-value={value}>{children}</li>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: Kids) => <span>{children}</span>,
  Tooltip: ({ children }: Kids) => <span>{children}</span>,
  TooltipTrigger: ({ children }: Kids) => <span>{children}</span>,
  TooltipContent: ({ children }: Kids) => <span>{children}</span>,
}));

import { InvitationTable } from '../components/InvitationTable';
import { InviteUserDialog } from '../components/InviteUserDialog';
import {
  DELIVERY_KEY,
  INVITATION_STATE_KEY,
  INVITE_KEYS,
  ISSUE_SETBACK_KEY,
} from '../invite-labels';
import { useInvitationActions } from '../useInvitationActions';
import { useInviteCapability, WORKSPACE_INVITE_PERMISSION } from '../useInviteCapability';
import {
  INVITABLE_ROLES,
  WORKSPACE_INVITATION_STATES,
  type WorkspaceInvitationState,
  type WorkspaceInvitationView,
} from '@/types/workspace-invitation';

// ===========================================================================
// ΚΟΙΝΑ
// ===========================================================================

function invitationWith(
  overrides: Partial<WorkspaceInvitationView> = {},
): WorkspaceInvitationView {
  return {
    id: 'winv_1',
    companyId: 'comp_0001',
    inviteeEmail: 'maria@example.com',
    role: 'internal_user',
    state: 'pending',
    invitedByUid: 'uid_admin',
    createdAt: '2026-09-01T10:00:00.000Z',
    expiresAt: '2026-09-08T10:00:00.000Z',
    openedAt: null,
    resolvedAt: null,
    resolvedByUid: null,
    ...overrides,
  };
}

const ISSUED = {
  invitationId: 'winv_1',
  inviteeEmail: 'maria@example.com',
  role: 'internal_user',
  expiresAt: '2026-09-08T10:00:00.000Z',
  supersededCount: 0,
  delivery: 'accepted',
} as const;

beforeEach(() => {
  mockUseCapability.mockReset().mockReturnValue({
    verdict: 'granted-by-role',
    action: WORKSPACE_INVITE_PERMISSION,
    reason: null,
    pending: false,
  });
  mockIssue.mockReset().mockResolvedValue({ kind: 'issued', issued: ISSUED });
  mockRevoke.mockReset().mockResolvedValue({ kind: 'revoked' });
  mockNotify.success.mockReset();
  mockNotify.warning.mockReset();
  mockNotify.error.mockReset();
});

// ===========================================================================
// Α — ΠΟΙΟΣ ΒΛΕΠΕΙ: ΤΟΝ ΚΡΙΤΗ ΡΩΤΑΜΕ, ΟΧΙ ΛΙΣΤΑ ΡΟΛΩΝ
// ===========================================================================

function CapabilityProbe() {
  const invite = useInviteCapability();
  return <output data-testid="gate">{`${invite.canInvite}|${invite.pending}`}</output>;
}

describe('Α — η ερώτηση περνά από τον ΕΝΑ κριτή', () => {
  it('🔴 Α1 — ΕΚΚΡΕΜΗΣ ταυτότητα: κλειστό ΚΑΙ δηλωμένα μη τελικό (άρνηση που δεν κρίθηκε ποτέ)', () => {
    mockUseCapability.mockReturnValue({
      verdict: 'denied-unauthenticated',
      action: WORKSPACE_INVITE_PERMISSION,
      reason: null,
      pending: true,
    });
    render(<CapabilityProbe />);

    // Η κατεύθυνση είναι **«κλειστό → ανοιχτό»**: το `pending` λέει στην οθόνη να μη
    // δείξει τίποτα, όχι να δείξει «δεν δικαιούσαι».
    expect(screen.getByTestId('gate')).toHaveTextContent('false|true');
  });

  it('Α2 — παραχωρημένη ⇒ ανοιχτό, και τελικό', () => {
    render(<CapabilityProbe />);
    expect(screen.getByTestId('gate')).toHaveTextContent('true|false');
  });

  it('Α3 — αρνημένη ⇒ κλειστό', () => {
    mockUseCapability.mockReturnValue({
      verdict: 'denied-by-role',
      action: WORKSPACE_INVITE_PERMISSION,
      reason: 'role_lacks_permission',
      pending: false,
    });
    render(<CapabilityProbe />);
    expect(screen.getByTestId('gate')).toHaveTextContent('false|false');
  });

  /**
   * 🔑 **Η ΠΙΟ ΑΚΡΙΒΗ ΑΓΚΥΡΑ ΤΗΣ ΣΟΥΙΤΑΣ**: διαβάζει **τα ίδια τα route** και απαιτεί η
   * οθόνη να ρωτά **την ίδια** ικανότητα που φυλά την πόρτα. Χωρίς αυτήν, η οθόνη μπορεί
   * να δείχνει κουμπί που ο διακομιστής θα απορρίψει — ή να το κρύβει από άνθρωπο που
   * **δικαιούται**. Ίδιο ιδίωμα με το `property-edit-capability.test.ts` (ADR-840 §8.2).
   */
  it.each([
    'src/app/api/workspace-invitations/route.ts',
    'src/app/api/workspace-invitations/[invitationId]/revoke/route.ts',
  ])('🔑 Α4 — η οθόνη ρωτά την ΙΔΙΑ ικανότητα που φυλά το %s', (relative) => {
    const source = fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
    expect(source).toContain(`permissions: '${WORKSPACE_INVITE_PERMISSION}'`);
  });
});

// ===========================================================================
// Β — Ο ΔΙΑΛΟΓΟΣ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ ΓΙΑ ΤΗΝ ΠΑΡΑΔΟΣΗ
// ===========================================================================

function renderDialog() {
  const onClose = jest.fn();
  const onIssued = jest.fn();
  render(<InviteUserDialog open onClose={onClose} onIssued={onIssued} />);
  return { onClose, onIssued };
}

async function submitInvite(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText(INVITE_KEYS.emailLabel), 'maria@example.com');
  await user.click(screen.getByRole('button', { name: INVITE_KEYS.submit }));
}

describe('Β — ο διάλογος', () => {
  it('Β1 — ΚΑΘΑΡΗ παράδοση ⇒ κλείνει και το λέει', async () => {
    const { onClose, onIssued } = renderDialog();
    await submitInvite(userEvent.setup());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onIssued).toHaveBeenCalled();
    expect(mockNotify.success).toHaveBeenCalledWith(INVITE_KEYS.success);
  });

  it('🔴 Β2 — το μήνυμα ΔΕΝ έφυγε: ΜΕΝΕΙ ανοιχτός και ονομάζει τον λόγο', async () => {
    mockIssue.mockResolvedValue({
      kind: 'issued',
      issued: { ...ISSUED, delivery: 'failed' },
    });
    const { onClose, onIssued } = renderDialog();
    await submitInvite(userEvent.setup());

    expect(await screen.findByText(DELIVERY_KEY.failed)).toBeInTheDocument();
    // 🔑 Η πρόσκληση **υπάρχει** — η λίστα ανανεώνεται· απλώς ο άνθρωπος δεν ειδοποιήθηκε.
    expect(onIssued).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('🔴 Β3 — η επαναποστολή ΑΚΥΡΩΣΕ την προηγούμενη, και λέγεται', async () => {
    mockIssue.mockResolvedValue({
      kind: 'issued',
      issued: { ...ISSUED, supersededCount: 1 },
    });
    renderDialog();
    await submitInvite(userEvent.setup());

    // Χωρίς αυτό, ο διαχειριστής νομίζει ότι κυκλοφορούν **δύο** σύνδεσμοι.
    await waitFor(() => expect(mockNotify.warning).toHaveBeenCalledWith(INVITE_KEYS.superseded));
  });

  it('Β4 — άρνηση ταβανιού ρόλου: ο ΟΝΟΜΑΣΜΕΝΟΣ λόγος, όχι το γενικό «απέτυχε»', async () => {
    mockIssue.mockResolvedValue({ kind: 'refused', setback: { kind: 'role-above-inviter' } });
    const { onIssued } = renderDialog();
    await submitInvite(userEvent.setup());

    expect(await screen.findByText(ISSUE_SETBACK_KEY['role-above-inviter'])).toBeInTheDocument();
    expect(screen.queryByText(INVITE_KEYS.error)).toBeNull();
    // Καμία πρόσκληση δεν γεννήθηκε ⇒ η λίστα **δεν** είναι μπαγιάτικη.
    expect(onIssued).not.toHaveBeenCalled();
  });

  it.each(Object.keys(ISSUE_SETBACK_KEY) as (keyof typeof ISSUE_SETBACK_KEY)[])(
    '🔑 Β5 — «%s»: κάθε άρνηση του κλειστού συνόλου έχει δική της λέξη',
    async (kind) => {
      mockIssue.mockResolvedValue({ kind: 'refused', setback: { kind } });
      renderDialog();
      await submitInvite(userEvent.setup());

      expect(await screen.findByText(ISSUE_SETBACK_KEY[kind])).toBeInTheDocument();
    },
  );

  it('🔒 Β6 — προσφέρονται ΜΟΝΟ οι προσκλήσιμοι ρόλοι — ποτέ ο super_admin', () => {
    renderDialog();

    const offered = screen
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('data-role-value'));

    expect(offered).toEqual([...INVITABLE_ROLES]);
    // Ο `super_admin` είναι **break-glass** (παρακάμπτει κάθε έλεγχο), όχι βαθμίδα
    // ιεραρχίας — ρόλος που παρακάμπτει τους ελέγχους δεν δίνεται με **email**.
    expect(offered).not.toContain('super_admin');
  });
});

// ===========================================================================
// Γ — Ο ΠΙΝΑΚΑΣ
// ===========================================================================

function renderTable(
  invitations: WorkspaceInvitationView[],
  canManage = true,
): { onRevoke: jest.Mock; onResend: jest.Mock } {
  const onRevoke = jest.fn();
  const onResend = jest.fn();
  render(
    <InvitationTable
      invitations={invitations}
      canManage={canManage}
      busyId={null}
      onRevoke={onRevoke}
      onResend={onResend}
    />,
  );
  return { onRevoke, onResend };
}

describe('Γ — ο πίνακας των εκκρεμών', () => {
  it.each(WORKSPACE_INVITATION_STATES)(
    '🔑 Γ1 — «%s»: κάθε κατάσταση του κλειστού συνόλου έχει λέξη',
    (state: WorkspaceInvitationState) => {
      renderTable([invitationWith({ state })]);
      expect(screen.getByText(INVITATION_STATE_KEY[state])).toBeInTheDocument();
    },
  );

  it('Γ2 — ασύνδετος σύνδεσμος: λέει «δεν ανοίχτηκε», ΠΟΤΕ κενό κελί', () => {
    renderTable([invitationWith({ openedAt: null })]);
    expect(screen.getByText(INVITE_KEYS.openedNever)).toBeInTheDocument();
  });

  it('🔴 Γ3 — όταν ΥΠΑΡΧΕΙ σφραγίδα, λέγεται ότι είναι ένδειξη — όχι απόδειξη', () => {
    renderTable([invitationWith({ openedAt: '2026-09-02T08:00:00.000Z' })]);

    // Χωρίς αυτή τη λέξη, μια ώρα σε στήλη «Άνοιγμα συνδέσμου» διαβάζεται ως «το είδε» —
    // ισχυρισμός που **δεν μπορούμε να στηρίξουμε** (οι πελάτες email προφορτώνουν).
    expect(screen.getByText(INVITE_KEYS.openedHint)).toBeInTheDocument();
  });

  it('Γ4 — ΤΕΛΙΚΗ κατάσταση ⇒ καμία πράξη (δεν υπάρχει τι να ανακληθεί)', () => {
    renderTable([invitationWith({ state: 'accepted' })]);
    expect(screen.queryByRole('button', { name: INVITE_KEYS.actionRevoke })).toBeNull();
    expect(screen.queryByRole('button', { name: INVITE_KEYS.actionResend })).toBeNull();
  });

  it('🔑 Γ5 — ΛΗΓΜΕΝΗ ⇒ ΕΧΕΙ πράξεις: η κατάσταση είναι ΠΑΡΑΓΟΜΕΝΗ, το έγγραφο ζει', () => {
    renderTable([invitationWith({ state: 'expired' })]);

    // Ο παρονομαστής του Γ4: κανείς δεν σκουπίζει τις ληγμένες, άρα στη βάση η πρόσκληση
    // είναι ακόμη `pending` — η ανάκληση **όντως γράφει**, και η επαναποστολή είναι
    // ακριβώς αυτό που θέλει ο διαχειριστής.
    expect(screen.getByRole('button', { name: INVITE_KEYS.actionRevoke })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: INVITE_KEYS.actionResend })).toBeInTheDocument();
  });

  it('Γ6 — χωρίς δικαίωμα και χωρίς προσκλήσεις ⇒ καμία ενότητα', () => {
    const { container } = render(
      <InvitationTable
        invitations={[]}
        canManage={false}
        busyId={null}
        onRevoke={jest.fn()}
        onResend={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ===========================================================================
// Δ — ΟΙ ΠΡΑΞΕΙΣ ΤΗΣ ΓΡΑΜΜΗΣ
// ===========================================================================

function ActionsProbe({ refetch }: { refetch: () => void }) {
  const actions = useInvitationActions(refetch);
  const invitation = invitationWith();
  return (
    <nav>
      <button type="button" onClick={() => void actions.revoke(invitation)}>
        do-revoke
      </button>
      <button type="button" onClick={() => void actions.resend(invitation)}>
        do-resend
      </button>
    </nav>
  );
}

describe('Δ — ανάκληση και επαναποστολή', () => {
  it('🔴 Δ1 — «ήδη κλειστή» (409): η οθόνη μας είναι ΜΠΑΓΙΑΤΙΚΗ ⇒ ξαναρωτά', async () => {
    mockRevoke.mockResolvedValue({
      kind: 'refused',
      setback: { kind: 'already-resolved', state: 'accepted' },
    });
    const refetch = jest.fn();
    render(<ActionsProbe refetch={refetch} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'do-revoke' }));

    // Χωρίς αυτό, η νεκρή γραμμή μένει και ο άνθρωπος ξαναπατά κουμπί που **δεν μπορεί**
    // να πετύχει.
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(mockNotify.error).toHaveBeenCalled();
  });

  it('Δ2 — 503: ΤΙΠΟΤΑ δεν άλλαξε ⇒ καμία ανανέωση', async () => {
    mockRevoke.mockResolvedValue({ kind: 'refused', setback: { kind: 'unavailable' } });
    const refetch = jest.fn();
    render(<ActionsProbe refetch={refetch} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'do-revoke' }));

    await waitFor(() => expect(mockNotify.error).toHaveBeenCalled());
    expect(refetch).not.toHaveBeenCalled();
  });

  it('🔑 Δ3 — η ΕΠΑΝΑΠΟΣΤΟΛΗ είναι η ΕΚΔΟΣΗ ξανά, με το email και τον ρόλο της γραμμής', async () => {
    const refetch = jest.fn();
    render(<ActionsProbe refetch={refetch} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'do-resend' }));

    // ⛔ Καμία διαδρομή `resend`: το §7.3 γεννά νέο token και ανακαλεί το παλιό στην ίδια
    //    συναλλαγή. Δεύτερη πράξη θα άφηνε **δύο** κλειδιά ζωντανά για μία πόρτα.
    await waitFor(() =>
      expect(mockIssue).toHaveBeenCalledWith({
        email: 'maria@example.com',
        role: 'internal_user',
      }),
    );
    expect(refetch).toHaveBeenCalled();
  });
});
