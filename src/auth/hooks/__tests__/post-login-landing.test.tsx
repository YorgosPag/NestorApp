/**
 * **Η ΠΡΟΣΓΕΙΩΣΗ ΡΩΤΑ ΤΟΝ ΕΝΑΝ ΕΠΙΛΥΤΗ** (ADR-660 §5.4 · ADR-817 §9)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ: Ο ΦΡΟΥΡΟΣ ΥΠΗΡΧΕ ΚΑΙ ΚΑΝΕΙΣ ΔΕΝ ΤΟΝ ΡΩΤΟΥΣΕ
 *
 * Μέχρι τις 2026-08-26 το `AuthForm` έγραφε `redirectTo = AUTH_ROUTES.home`
 * (**`/dashboard`**) ως **προεπιλογή**, και το `useAuthFormState` προωθούσε εκεί σε
 * **τέσσερα** σημεία. Ο `resolvePostLoginRoute` — που απαντά **σωστά** από το
 * ADR-660 §5.4 — είχε **μηδέν** αναφορές στο `AuthForm`, ενώ το **ίδιο του το
 * docblock** γράφει `@example router.replace(resolvePostLoginRoute(user))`.
 *
 * Αποτέλεσμα, μετρημένο ζωντανά στον emulator: ο `ext.owner@solo.local` (πολίτης,
 * **κανένα** `companyId`) προσγειωνόταν στο `/dashboard` με ολόκληρο το **εταιρικό**
 * sidebar, και το `useRealtimeProperties` πετούσε
 * `AUTHORIZATION_ERROR: User is not assigned to a company` σε κάθε φόρτωση.
 *
 * ⚠️ **Αδρανής φρουρός** (ADR-749 §5): γραμμένος, τεκμηριωμένος, **ανεκτέλεστος**.
 * Και **καμία άγκυρα δεν τον κάλυπτε** — γι' αυτό επέζησε.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **ΚΡΙΝΕΙ ΤΗ ΔΙΕΥΘΥΝΣΗ ΠΟΥ ΦΤΑΝΕΙ ΣΤΟΝ ΔΡΟΜΟΛΟΓΗΤΗ, ΟΧΙ ΤΗΝ ΥΠΑΡΞΗ ΚΛΗΣΗΣ.**
 * Ένα test «καλείται ο `resolvePostLoginRoute`;» θα έμενε **πράσινο** αν κάποιος τον
 * καλούσε και **πετούσε** το αποτέλεσμα — που είναι ακριβώς το σχήμα της βλάβης.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChangeEvent, FormEvent } from 'react';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockPrefetch = jest.fn();

jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, prefetch: mockPrefetch }),
}));

const mockUseAuth = jest.fn();
jest.mock('@/auth/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { useAuthFormState } from '../useAuthFormState';
import { PRIVATE_SPACE_HOME } from '@/lib/routes/landing';
import { AUTH_ROUTES } from '@/lib/routes';

/** Ό,τι χρειάζεται το hook από το `useAuth`, με τον χρήστη ως τη ΜΙΑ μεταβλητή. */
function authContext(user: { uid: string; companyId?: string } | null) {
  return {
    user,
    loading: false,
    error: null,
    sessionPhase: user ? 'established' : 'anonymous',
    signIn: jest.fn(),
    signInWithGoogle: jest.fn(),
    signUp: jest.fn(),
    resetPassword: jest.fn(),
    clearError: jest.fn(),
    mfaRequired: false,
    verifyMfaCode: jest.fn(),
    cancelMfaVerification: jest.fn(),
  };
}

const render = () =>
  renderHook(() => useAuthFormState({ defaultMode: 'signin' }));

beforeEach(() => jest.clearAllMocks());

describe('ADR-817 §9 — πού προσγειώνεται ο συνδεδεμένος', () => {
  it('Κ1 — Ο ΠΟΛΙΤΗΣ (κανένα companyId) πάει στον ΙΔΙΩΤΙΚΟ του χώρο', async () => {
    mockUseAuth.mockReturnValue(authContext({ uid: 'uid-ext-owner' }));

    render();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(PRIVATE_SPACE_HOME));
    // ⛔ Η βλάβη ήταν ΑΚΡΙΒΩΣ αυτό: προσγείωση στον εταιρικό χώρο.
    expect(mockReplace).not.toHaveBeenCalledWith(AUTH_ROUTES.home);
  });

  it('Π1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ πάει στο dashboard, όπως πάντα', async () => {
    // 🔴 Χωρίς αυτό, το Κ1 θα ήταν πράσινο και με «στείλε ΤΑ ΠΑΝΤΑ στο /offers» —
    //    δηλαδή η διόρθωση θα είχε σπάσει τον επαγγελματία χωρίς να το δει κανείς.
    mockUseAuth.mockReturnValue(authContext({ uid: 'uid-int', companyId: 'comp_alpha' }));

    render();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(AUTH_ROUTES.home));
    expect(mockReplace).not.toHaveBeenCalledWith(PRIVATE_SPACE_HOME);
  });

  it('Κ2 — ΚΕΝΟ companyId μετρά ως ΑΠΟΥΣΙΑ, όχι ως μισθωτής', async () => {
    // ⚠️ Ίδιο δόγμα με το `extractCustomClaims` (ADR-657 §3.5): κενή συμβολοσειρά
    //    είναι απουσία. Τρίτη ερμηνεία εδώ θα έστελνε στον εταιρικό χώρο κάποιον που
    //    ο ΔΙΑΚΟΜΙΣΤΗΣ θεωρεί χωρίς οργανισμό — δηλαδή σε σελίδα που 401άρει.
    mockUseAuth.mockReturnValue(authContext({ uid: 'uid-x', companyId: '' }));

    render();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(PRIVATE_SPACE_HOME));
  });

  it('Κ3 — ο ΑΝΩΝΥΜΟΣ δεν προσγειώνεται πουθενά — και ΤΙΠΟΤΑ δεν προφορτώνεται', async () => {
    // 🔴 ADR-859: εδώ ο ισχυρισμός ήταν `mockPrefetch toHaveBeenCalled` — δηλαδή η άγκυρα
    //    ΦΥΛΑΓΕ τη βλάβη. Η ανώνυμη προφόρτωση κρατιέται 5′ από το Next και σερβίρει την
    //    ανώνυμη όψη του προορισμού ΜΕΤΑ τη σύνδεση.
    mockUseAuth.mockReturnValue(authContext(null));

    const { result } = render();

    await act(async () => undefined);
    expect(result.current.isRedirecting).toBe(false);
    expect(mockPrefetch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Κ4 — η ΡΗΤΗ παράκαμψη νικά τον επιλυτή', async () => {
    // Το `redirectTo` δεν καταργήθηκε: εξυπηρετεί το «γύρνα εκεί που ήσουν». Αυτό που
    // καταργήθηκε είναι η **προεπιλογή** του, που ήταν σιωπηλά εταιρική.
    mockUseAuth.mockReturnValue(authContext({ uid: 'uid-ext-owner' }));

    renderHook(() =>
      useAuthFormState({ defaultMode: 'signin', redirectTo: '/listings/mandates' }),
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/listings/mandates'));
  });
});

/**
 * ADR-859 — **Η ΣΥΝΔΕΣΗ ΟΛΟΚΛΗΡΩΝΕΤΑΙ ΣΕ ΕΝΑ ΣΗΜΕΙΟ.**
 *
 * 🔴 Μετρημένο ζωντανά 2026-09-14 (`/invite/<token>` → Google → λογαριασμός με MFA): η
 * φόρμα έφευγε 143ms μετά το «MFA required», χωρίς κωδικό, χωρίς cookie. Σε δημόσιο
 * προορισμό κανείς δεν την ξανάστελνε στο `/login` ⇒ «Συνδεθείτε» για πάντα.
 *
 * Μεταλλάξεις που ΠΡΕΠΕΙ να κοκκινίσουν:
 *   - `router.push(landing)` πίσω στον χειριστή Google ⇒ Λ1
 *   - `setTimeout(() => router.push(landing))` πίσω στον χειριστή MFA ⇒ Λ2
 *   - `isRedirecting = !loading && !!user` (αγνοεί τη φάση) ⇒ Λ4
 */
describe('ADR-859 — καμία πλοήγηση από το αποτέλεσμα μιας πράξης', () => {
  const INVITE = '/invite/tok';
  const pending = (overrides: Record<string, unknown>) => ({ ...authContext(null), ...overrides });
  const renderAt = () =>
    renderHook(() => useAuthFormState({ defaultMode: 'signin', redirectTo: INVITE }));
  const noNavigation = () => {
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  };

  it('Λ1 — Google ζητά δεύτερο παράγοντα ⇒ ΜΕΝΟΥΜΕ, καμία φόρτωση', async () => {
    const signInWithGoogle = jest.fn(async () => ({ kind: 'second-factor-required' }));
    mockUseAuth.mockReturnValue(pending({ signInWithGoogle }));
    const { result, rerender } = renderAt();

    await act(async () => {
      await result.current.handleGoogleSignIn();
    });
    mockUseAuth.mockReturnValue(pending({ signInWithGoogle, mfaRequired: true }));
    rerender();

    noNavigation();
    expect(result.current.isRedirecting).toBe(false);
    expect(result.current.mfaRequired).toBe(true);
  });

  it('Λ2 — ΛΑΘΟΣ κωδικός MFA ⇒ καμία πλοήγηση', async () => {
    const verifyMfaCode = jest.fn(async () => ({ kind: 'rejected', reason: 'invalid-code' }));
    mockUseAuth.mockReturnValue(pending({ verifyMfaCode, mfaRequired: true }));
    const { result } = renderAt();

    act(() => result.current.handleMfaCodeChange('000000'));
    await act(async () => {
      await result.current.handleMfaVerification({ preventDefault: () => undefined } as FormEvent);
    });

    expect(verifyMfaCode).toHaveBeenCalledWith('000000');
    noNavigation();
  });

  it('Λ3 — email ζητά δεύτερο παράγοντα ⇒ μένουμε, και το `onSuccess` ΔΕΝ καλείται', async () => {
    const signIn = jest.fn(async () => ({ kind: 'second-factor-required' }));
    const onSuccess = jest.fn();
    mockUseAuth.mockReturnValue(pending({ signIn }));
    const { result } = renderHook(() =>
      useAuthFormState({ defaultMode: 'signin', redirectTo: INVITE, onSuccess }),
    );

    act(() => {
      result.current.handleInputChange('email')({ target: { value: 'a@b.gr' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleInputChange('password')({ target: { value: 'secret' } } as ChangeEvent<HTMLInputElement>);
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => undefined } as FormEvent);
    });

    expect(signIn).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    noNavigation();
  });

  it('Λ4 — ο πάροχος δέχτηκε αλλά η συνεδρία ΣΤΗΝΕΤΑΙ ⇒ φόρτωση, ΟΧΙ πλοήγηση· μετά ΜΙΑ', async () => {
    mockUseAuth.mockReturnValue(pending({ sessionPhase: 'establishing' }));
    const { result, rerender } = renderAt();
    await act(async () => undefined);

    expect(result.current.isRedirecting).toBe(true);
    noNavigation();

    mockUseAuth.mockReturnValue(authContext({ uid: 'uid-oe', companyId: 'comp_x' }));
    rerender();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(INVITE));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('ADR-817 §9 — καμία ΣΙΩΠΗΛΗ προεπιλογή στο σύνορο του component', () => {
  /**
   * 🔴 **ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΕΜΕΙΝΕ ΠΡΑΣΙΝΗ (Λ5).** Οι άγκυρες από πάνω
   * δοκιμάζουν το **hook**· το `AuthForm` μπορούσε να ξαναδώσει στο `redirectTo` μια
   * καρφωτή προεπιλογή και **καμία** από αυτές δεν θα το έβλεπε — δηλαδή η βλάβη θα
   * επέστρεφε από την **ίδια** πόρτα απ' την οποία έφυγε.
   *
   * ⚠️ **ΚΑΜΙΑ ΑΦΑΙΡΕΣΗ ΣΧΟΛΙΩΝ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΑΠΟ ΜΕΤΡΗΣΗ.** Η πρώτη γραφή
   * έκοβε σχόλια με regex (πρότυπο `Κ7β` του CHECK 3.50) και **κατάπινε μεγάλο μέρος
   * του αρχείου**: σε **TSX** τα σχόλια μέσα σε JSX δίνουν ζεύγη ανοίγματος και
   * κλεισίματος μπλοκ που η
   * αφαίρεση δεν ξεχωρίζει από σχόλια κώδικα. Το κριτήριο εδώ **δεν το χρειάζεται**:
   * ψάχνει `redirectTo` **αμέσως πριν από `=`**, μορφή που κανένα σχόλιο αυτού του
   * αρχείου δεν παράγει.
   *
   * 🔶 **Δηλωμένο όριο**: σχόλιο που γράφει κατά λέξη `redirectTo =` θα ήταν ψευδώς
   * θετικό. Προτιμήθηκε από έναν αφαιρέτη που **αποδεδειγμένα** αλλοιώνει την είσοδο.
   */
  it('Κ5 — το AuthForm ΔΕΝ δίνει προεπιλογή στο redirectTo', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../components/AuthForm.tsx'),
      'utf8',
    );

    // 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΠΡΩΤΑ: αν το prop δεν υπάρχει καν, η άρνηση από κάτω θα ήταν
    //    πράσινη επειδή δεν κοίταξε τίποτα.
    expect(src).toContain('redirectTo');

    // ⛔ Απουσία προεπιλογής = «ρώτα τον επιλυτή». Προεπιλογή = «πήγαινε εκεί που
    //    λέω εγώ» — και η τιμή που έλεγε ήταν ο ΕΤΑΙΡΙΚΟΣ χώρος, για ΚΑΘΕ άνθρωπο.
    expect(/redirectTo\s*=/.test(src)).toBe(false);
  });
});
