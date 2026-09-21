/**
 * 🔴 **Η ΟΘΟΝΗ ΤΟΥ ΠΡΟΣΚΕΚΛΗΜΕΝΟΥ** (ADR-853 Φ6 — ΒΗΜΑ Β).
 * @related components/workspace-invite/WorkspaceInviteContent.tsx · types/workspace-invitation-view.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΕΙ — ΚΑΙ ΤΙ ΡΗΤΑ **ΔΕΝ** ΦΥΛΑΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Φυλάει τη **δομή**: ότι καμία αποτυχία δεν μένει χωρίς λέξη και χωρίς δρόμο, ότι ο
 * ανώνυμος βλέπει **πρώτα** ποιος τον καλεί, και ότι η αποδοχή λέει **με όνομα** πότε ο
 * χώρος δεν έγινε ενεργός.
 *
 * ⚠️ **ΔΕΝ φυλάει τις ΤΙΜΕΣ του `EXIT_BY_REFUSAL`** *(π.χ. «η ληγμένη πάει `home`»)*, και
 * είναι **απόφαση, όχι παράλειψη**: αυτό είναι σφάλμα **κρίσης**, και το φυλά ο
 * **μεταγλωττιστής** απαιτώντας γραμμή για κάθε νέο λόγο — ακριβώς το σκεπτικό που γράφει
 * η αδελφή σουίτα `first-contact-dead-end.test.tsx` στο Β6. Εδώ φυλάγεται το **άλλο**:
 * λόγος που γεννήθηκε και **κανείς δεν του έδωσε πράξη**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Σβήσε το `<ExitLink …>` από το `SetbackScreen` → όλη η ομάδα **Α**.
 * 2. Δείξε τα κουμπιά απάντησης και σε `respond.kind === 'sign-in'` → **Β2**.
 * 3. Κάνε το `SignInInvitation` να δείχνει σκέτο `/login` → **Β3**.
 * 4. Γύρνα το `acceptedNotActive` σε `acceptedActiveNow` → **Γ2** *(το δηλωμένο όριο §6 #1)*.
 * 5. Βάλε ωμό `preview.role` αντί για `INVITED_ROLE_KEY` → **Β4**.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mockRedeem = jest.fn();
const mockRefresh = jest.fn();

// ⚠️ Το `t` κουβαλά **και τις παραμέτρους**: αλλιώς μια ένθετη κλήση `t(roleLine, { role:
//    t(ROLE_KEY[...]) })` θα κατάπινε το κλειδί του ρόλου και η άγκυρα **Β4** θα ήταν
//    πράσινη χωρίς να μετρά τίποτα.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}|${Object.values(options).join('|')}` : key,
  }),
}));

jest.mock('@/lib/intl-formatting', () => ({
  formatRelativeTime: (iso: string) => `rel(${iso})`,
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ refresh: mockRefresh }),
}));

jest.mock('@/services/workspace/workspace-invitation.client', () => ({
  redeemWorkspaceInvitationFromScreen: (input: unknown) => mockRedeem(input),
}));

// 🔴 **ΚΑΝΕΝΑ mock στο `useSemanticColors` / `useLayoutClasses`** — μάθημα μετρημένο στη
//    σουίτα της ΒΗΜΑ Α: ένα μισό σχήμα εκεί έριξε **17 από 26** άγκυρες, επειδή το
//    `badge.tsx` καλεί το ίδιο άγκιστρο. Είναι `useMemo` πάνω σε σταθερές — τρέχουν.

import { WorkspaceInviteContent } from '../WorkspaceInviteContent';
import {
  EXIT_HREF,
  EXIT_KEY,
  INVITE_PAGE_KEYS,
  INVITED_ROLE_KEY,
  REFUSAL_KEY,
} from '../workspace-invite-labels';
import {
  WORKSPACE_INVITATION_REFUSALS,
  type WorkspaceInvitationRefusal,
} from '@/types/workspace-invitation';
import type { WorkspaceInvitationLinkView } from '@/types/workspace-invitation-view';

const PREVIEW = {
  workspaceName: 'Γραφείο Παγώνη',
  role: 'internal_user',
  expiresAt: '2026-09-20T10:00:00.000Z',
  identityAssurance: 'declared',
} as const;

function previewView(
  respond: Extract<WorkspaceInvitationLinkView, { kind: 'preview' }>['respond'],
): WorkspaceInvitationLinkView {
  return { kind: 'preview', preview: PREVIEW, token: 'tok_1', respond };
}

beforeEach(() => {
  mockRedeem.mockReset().mockResolvedValue({ kind: 'accepted', activeWorkspaceChanged: true });
});

// ===========================================================================
// Α — ΚΑΜΙΑ ΑΠΟΤΥΧΙΑ ΧΩΡΙΣ ΛΕΞΗ ΚΑΙ ΧΩΡΙΣ ΔΡΟΜΟ
// ===========================================================================

describe('Α — η σελίδα δεν είναι ποτέ αδιέξοδο', () => {
  it.each(WORKSPACE_INVITATION_REFUSALS)(
    '🔴 Α1 — «%s»: λέει τον ΔΙΚΟ ΤΗΣ λόγο και δίνει κουμπί',
    (reason: WorkspaceInvitationRefusal) => {
      render(<WorkspaceInviteContent view={{ kind: 'refused', reason, exit: 'home' }} />);

      expect(screen.getByText(REFUSAL_KEY[reason])).toBeInTheDocument();
      const exit = screen.getByRole('link');
      expect(exit).toHaveAttribute('href', EXIT_HREF.home);
      expect(exit).toHaveTextContent(EXIT_KEY.home);
    },
  );

  it('Α2 — η διέξοδος είναι ΑΥΤΗ που όρισε ο διακομιστής, όχι σταθερή', () => {
    render(
      <WorkspaceInviteContent
        view={{ kind: 'refused', reason: 'wrong-recipient', exit: 'sign-in' }}
      />,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', EXIT_HREF['sign-in']);
  });

  it('🔑 Α3 — «δεν μπορέσαμε να ρωτήσουμε»: ΚΑΝΕΝΑΣ ονομασμένος λόγος, αλλά ΥΠΑΡΧΕΙ δρόμος', () => {
    render(<WorkspaceInviteContent view={{ kind: 'unavailable', exit: 'home' }} />);

    // Το «λείπει το μυστικό μας» μιλά για **εμάς** — να το πούμε «πλαστός σύνδεσμος» θα
    // ήταν ψέμα που στέλνει τον άνθρωπο σε λάθος ενέργεια.
    expect(screen.getByText(INVITE_PAGE_KEYS.unavailableBody)).toBeInTheDocument();
    expect(screen.getByRole('link')).toBeInTheDocument();
  });
});

// ===========================================================================
// Β — Ο ΑΝΩΝΥΜΟΣ ΒΛΕΠΕΙ ΠΡΩΤΑ ΠΟΙΟΣ ΤΟΝ ΚΑΛΕΙ (ΑΝΤΙ-PHISHING, §5 #4)
// ===========================================================================

describe('Β — η όψη πριν την απόφαση', () => {
  it('🔴 Β1 — ο ΑΝΩΝΥΜΟΣ βλέπει γραφείο, ρόλο και λήξη — ΠΡΙΝ από κάθε σύνδεση', () => {
    render(<WorkspaceInviteContent view={previewView({ kind: 'sign-in', href: '/login?next=%2Finvite%2Ftok_1' })} />);

    expect(screen.getByText(new RegExp(INVITE_PAGE_KEYS.intro))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(INVITE_PAGE_KEYS.expiresLine))).toBeInTheDocument();
    // §5 #4 · ADR-798 — «δηλωμένη, ΟΧΙ επαληθευμένη», γραμμένο στην οθόνη.
    expect(screen.getByText(INVITE_PAGE_KEYS.identityDeclared)).toBeInTheDocument();
  });

  it('🔴 Β2 — ο ΑΝΩΝΥΜΟΣ ΔΕΝ παίρνει κουμπιά απάντησης', () => {
    render(<WorkspaceInviteContent view={previewView({ kind: 'sign-in', href: '/login?next=x' })} />);

    expect(screen.queryByRole('button', { name: INVITE_PAGE_KEYS.accept })).toBeNull();
    expect(screen.queryByRole('button', { name: INVITE_PAGE_KEYS.decline })).toBeNull();
    expect(screen.getByText(INVITE_PAGE_KEYS.signInHint)).toBeInTheDocument();
  });

  it('🔒 Β3 — ο σύνδεσμος σύνδεσης κουβαλά τη ΔΙΑΔΡΟΜΗ ΕΠΙΣΤΡΟΦΗΣ του διακομιστή', () => {
    const href = '/login?next=%2Finvite%2Ftok_1';
    render(<WorkspaceInviteContent view={previewView({ kind: 'sign-in', href })} />);

    // ⚠️ Η οθόνη **δεν** συναρμολογεί `?next=` μόνη της: ο φρουρός `safeReturnPath` ζει
    //    στον διακομιστή. Σκέτο `/login` εδώ θα σήμαινε ότι ο άνθρωπος συνδέεται και
    //    **χάνει** την πρόσκληση.
    expect(screen.getByRole('link', { name: INVITE_PAGE_KEYS.signInToAccept })).toHaveAttribute('href', href);
  });

  it('🔑 Β4 — ο ρόλος λέγεται με τη ΔΙΚΗ ΜΑΣ βάση, ποτέ ωμό `internal_user`', () => {
    render(<WorkspaceInviteContent view={previewView({ kind: 'ready' })} />);

    // Το `admin` namespace **δεν φορτώνεται** σε αυτή τη δημόσια σελίδα — ένα
    // `roleManagement.roleNames.*` εδώ θα έβαφε ωμό κλειδί.
    expect(screen.getByText(new RegExp(INVITED_ROLE_KEY.internal_user))).toBeInTheDocument();
  });
});

// ===========================================================================
// Γ — Η ΑΠΑΝΤΗΣΗ
// ===========================================================================

async function respondWith(
  result: unknown,
  name: string,
): Promise<void> {
  mockRedeem.mockResolvedValue(result);
  render(<WorkspaceInviteContent view={previewView({ kind: 'ready' })} />);
  await userEvent.setup().click(screen.getByRole('button', { name }));
}

describe('Γ — τι μαθαίνει ο άνθρωπος αφού απαντήσει', () => {
  it('Γ1 — αποδοχή με ενεργό χώρο: καλωσόρισμα', async () => {
    await respondWith({ kind: 'accepted', activeWorkspaceChanged: true }, INVITE_PAGE_KEYS.accept);

    expect(await screen.findByText(INVITE_PAGE_KEYS.acceptedActiveNow)).toBeInTheDocument();
    await waitFor(() =>
      expect(mockRedeem).toHaveBeenCalledWith({ token: 'tok_1', action: 'accept' }),
    );
  });

  it('🔴 Γ2 — ΜΕΛΟΣ ΑΛΛΑ ΟΧΙ ΕΝΕΡΓΟΣ ΧΩΡΟΣ: λέγεται ΜΕ ΟΝΟΜΑ (δηλωμένο όριο §6 #1)', async () => {
    await respondWith({ kind: 'accepted', activeWorkspaceChanged: false }, INVITE_PAGE_KEYS.accept);

    // 🔑 Χωρίς αυτή τη λέξη ο άνθρωπος συνδέεται και **δεν βρίσκει** τον χώρο που μόλις
    //    δέχτηκε — και νομίζει ότι κάτι έσπασε. Ο ήδη-μέλος-αλλού ΔΕΝ μετακινείται (§11).
    expect(await screen.findByText(INVITE_PAGE_KEYS.acceptedNotActive)).toBeInTheDocument();
    expect(screen.queryByText(INVITE_PAGE_KEYS.acceptedActiveNow)).toBeNull();
  });

  it('Γ3 — ρητή άρνηση: το λέει ήρεμα και δίνει δρόμο', async () => {
    await respondWith({ kind: 'declined' }, INVITE_PAGE_KEYS.decline);

    expect(await screen.findByText(INVITE_PAGE_KEYS.declinedBody)).toBeInTheDocument();
    await waitFor(() =>
      expect(mockRedeem).toHaveBeenCalledWith({ token: 'tok_1', action: 'decline' }),
    );
  });

  it('🔑 Γ4 — άρνηση ΤΗΝ ΩΡΑ ΤΗΣ ΠΡΑΞΗΣ: ο ονομασμένος λόγος, όχι γενικό σφάλμα', async () => {
    await respondWith({ kind: 'refused', reason: 'wrong-recipient' }, INVITE_PAGE_KEYS.accept);

    // Τέσσερις λόγοι είναι **άφταστοι** από τη δημόσια όψη και φτάνουν **μόνο** από εδώ —
    // γι' αυτό ο πίνακας ετικετών καλύπτει **και τους εννέα**.
    expect(await screen.findByText(REFUSAL_KEY['wrong-recipient'])).toBeInTheDocument();
  });

  it('Γ5 — απρόβλεπτη αποτυχία: γενικό μήνυμα, ποτέ ωμός κωδικός', async () => {
    await respondWith({ kind: 'failed' }, INVITE_PAGE_KEYS.accept);

    expect(await screen.findByText(INVITE_PAGE_KEYS.unavailableBody)).toBeInTheDocument();
  });
});

// ===========================================================================
// Δ — ΤΟ «ΔΟΚΙΜΑΣΤΕ ΞΑΝΑ» (2026-09-21): το παροδικό ΠΡΟΣΦΕΡΕΙ επανάληψη
// ===========================================================================

describe('Δ — το παροδικό προσφέρει επανάληψη, το οριστικό όχι', () => {
  it('🔑 Δ1 — η ΟΨΗ δεν δόθηκε: «Δοκιμάστε ξανά» ξαναρωτά τον διακομιστή (router.refresh)', async () => {
    mockRefresh.mockReset();
    render(<WorkspaceInviteContent view={{ kind: 'unavailable', exit: 'home' }} />);

    await userEvent.setup().click(screen.getByRole('button', { name: INVITE_PAGE_KEYS.retry }));

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('🔴 Δ2 — αποτυχία της ΠΡΑΞΗΣ: η επανάληψη στέλνει την ΙΔΙΑ πράξη, όχι άλλη', async () => {
    await respondWith({ kind: 'failed' }, INVITE_PAGE_KEYS.decline);
    mockRedeem.mockResolvedValue({ kind: 'declined' });

    await userEvent.setup().click(
      await screen.findByRole('button', { name: INVITE_PAGE_KEYS.retry }),
    );

    expect(await screen.findByText(INVITE_PAGE_KEYS.declinedBody)).toBeInTheDocument();
    expect(mockRedeem).toHaveBeenNthCalledWith(2, { token: 'tok_1', action: 'decline' });
  });

  it('⛔ Δ3 — ονομασμένη άρνηση: ΚΑΝΕΝΑ «Δοκιμάστε ξανά» (η επανάληψη δεν αλλάζει τίποτα)', async () => {
    await respondWith({ kind: 'refused', reason: 'wrong-recipient' }, INVITE_PAGE_KEYS.accept);

    await screen.findByText(REFUSAL_KEY['wrong-recipient']);
    expect(screen.queryByRole('button', { name: INVITE_PAGE_KEYS.retry })).toBeNull();
  });

  it('⛔ Δ4 — ονομασμένη άρνηση στην ΟΨΗ: ΚΑΝΕΝΑ «Δοκιμάστε ξανά»', () => {
    render(<WorkspaceInviteContent view={{ kind: 'refused', reason: 'expired', exit: 'home' }} />);

    expect(screen.queryByRole('button', { name: INVITE_PAGE_KEYS.retry })).toBeNull();
  });
});
