/**
 * ADR-798 (ζωντανό εύρημα 2026-08-24) — ΑΓΚΥΡΕΣ για τα **δύο στρώματα** του
 * ονόματος χρήστη.
 *
 * 🔴 **Η ΒΛΑΒΗ ΗΤΑΝ ΜΕΤΡΗΜΕΝΗ, ΟΧΙ ΥΠΟΘΕΤΙΚΗ**: `displayName` =
 * `"Georgios Pagonis"` → πάτημα «Αποθήκευση» στο προφίλ **χωρίς** να αγγιχτούν
 * τα πεδία ονόματος → **`null`**. Ο χρήστης πατούσε Αποθήκευση για **άλλο
 * λόγο** (δήλωση επαγγέλματος) και **έχανε το όνομά του**.
 *
 *   **Σ1** ρώτα τον πάροχο — τα `given_name`/`family_name` του OIDC υιοθετούνται
 *   **Σ2** η κενή φόρμα **δεν** είναι εντολή διαγραφής
 *
 * ⚠️ Τα δύο στρώματα είναι **ανεξάρτητα, επίτηδες** (N.7.2 #4): το Σ1 θεραπεύει
 * την **αιτία** (κενά πεδία), το Σ2 την **επίπτωση** (απώλεια). Ένας χρήστης με
 * πάροχο που δεν στέλνει τα claims εξακολουθεί να προστατεύεται από το Σ2.
 */

import { renderHook, act } from '@testing-library/react';

const updateProfileMock = jest.fn();
const signInWithPopupMock = jest.fn();
const signInWithEmailMock = jest.fn();
const additionalInfoMock = jest.fn();
const challengeMock = jest.fn();

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    addScope() {}
    setCustomParameters() {}
  },
  createUserWithEmailAndPassword: jest.fn(),
  getAdditionalUserInfo: (...args: unknown[]) => additionalInfoMock(...args),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInWithEmailAndPassword: (...args: unknown[]) => signInWithEmailMock(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
  signOut: jest.fn(),
  updateProfile: (...args: unknown[]) => updateProfileMock(...args),
}));

const stored: Record<string, string> = {};
jest.mock('@/lib/storage', () => ({
  safeSetItem: (key: string, value: string) => {
    stored[key] = value;
  },
  STORAGE_KEYS: {
    AUTH_GIVEN_NAME_PREFIX: 'given:',
    AUTH_FAMILY_NAME_PREFIX: 'family:',
    AUTH_PROFILE_COMPLETE_PREFIX: 'complete:',
  },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// ADR-851 — τα email λογαριασμού πάνε από τον δικό μας διακομιστή· εδώ δεν ρωτιούνται.
jest.mock('@/auth/account-mail.client', () => ({
  requestEmailVerificationMail: jest.fn(async () => undefined),
  requestPasswordResetMail: jest.fn(async () => undefined),
}));

import { useAuthActions } from '../useAuthActions';

const UID = 'uid-1';

function setup(currentDisplayName: string | null) {
  const auth = { currentUser: { uid: UID, displayName: currentDisplayName } };
  const { result } = renderHook(() =>
    useAuthActions({
      auth: auth as never,
      currentLanguage: () => 'el',
      setUser: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      challengeSecondFactor: (error: unknown) => challengeMock(error),
    }),
  );
  return result;
}

beforeEach(() => {
  for (const key of Object.keys(stored)) delete stored[key];
  updateProfileMock.mockReset();
  signInWithPopupMock.mockReset();
  signInWithEmailMock.mockReset();
  additionalInfoMock.mockReset();
  challengeMock.mockReset();
  challengeMock.mockReturnValue(false);
  signInWithPopupMock.mockResolvedValue({ user: { uid: UID } });
});

// =============================================================================
/**
 * ADR-859 — **Ο ΔΕΥΤΕΡΟΣ ΠΑΡΑΓΟΝΤΑΣ ΕΠΙΣΤΡΕΦΕΤΑΙ ΟΝΟΜΑΣΜΕΝΟΣ, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΟΡΤΕΣ.**
 * Εδώ ζει επειδή αυτό είναι το harness του `useAuthActions` (δεύτερο θα ήταν δίδυμο).
 * Μεταλλάξεις: αφαίρεση του `challengeSecondFactor` από το `signIn` ⇒ Ε2 κόκκινο.
 */
describe('ADR-859 — η σύνδεση λέει ΤΙ απέγινε', () => {
  it('Ε1 — Google + δεύτερος παράγοντας ⇒ `second-factor-required`, όχι επιτυχία', async () => {
    signInWithPopupMock.mockRejectedValue({ code: 'auth/multi-factor-auth-required' });
    challengeMock.mockReturnValue(true);
    const result = setup(null);
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.signInWithGoogle();
    });
    expect(outcome).toEqual({ kind: 'second-factor-required' });
  });

  it('Ε2 — EMAIL + δεύτερος παράγοντας ⇒ `second-factor-required` (πριν: σφάλμα στον άνθρωπο)', async () => {
    signInWithEmailMock.mockRejectedValue({ code: 'auth/multi-factor-auth-required' });
    challengeMock.mockReturnValue(true);
    const result = setup(null);
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.signIn('a@b.gr', 'secret');
    });
    expect(outcome).toEqual({ kind: 'second-factor-required' });
  });

  it('Ε3 — ΠΑΡΟΝΟΜΑΣΤΗΣ: άλλο σφάλμα ΠΕΤΑ, δεν βαφτίζεται δεύτερος παράγοντας', async () => {
    signInWithPopupMock.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    const result = setup(null);
    await act(async () => {
      await expect(result.current.signInWithGoogle()).rejects.toEqual({ code: 'auth/popup-closed-by-user' });
    });
  });

  it('Ε4 — επιτυχία ⇒ `signed-in`', async () => {
    const result = setup(null);
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.signInWithGoogle();
    });
    expect(outcome).toEqual({ kind: 'signed-in' });
  });
});

// =============================================================================
describe('Σ1 — ρώτα τον πάροχο, μην μαντέψεις', () => {
  it('Σ1.1: τα `given_name`/`family_name` του Google υιοθετούνται αυτούσια', async () => {
    additionalInfoMock.mockReturnValue({
      profile: { given_name: 'Georgios', family_name: 'Pagonis' },
    });
    const result = setup(null);
    await act(async () => {
      await result.current.signInWithGoogle();
    });
    expect(stored[`given:${UID}`]).toBe('Georgios');
    expect(stored[`family:${UID}`]).toBe('Pagonis');
  });

  it('Σ1.2 🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς claims ΔΕΝ γράφεται τίποτα — καμία μαντεψιά', async () => {
    // Ένας πάροχος που στέλνει ΜΟΝΟ `name` δεν επιτρέπεται να γεννήσει
    // given/family με κόψιμο στο κενό: αυτό ακριβώς απαγορεύει το ΣΤΡΩΜΑ 1.
    additionalInfoMock.mockReturnValue({ profile: { name: 'Maria del Carmen García López' } });
    const result = setup(null);
    await act(async () => {
      await result.current.signInWithGoogle();
    });
    expect(stored[`given:${UID}`]).toBeUndefined();
    expect(stored[`family:${UID}`]).toBeUndefined();
  });

  it('Σ1.3: κενό ή απόν claim δεν πατάει υπάρχουσα τιμή του χρήστη', async () => {
    stored[`family:${UID}`] = 'Ήδη-Γραμμένο';
    additionalInfoMock.mockReturnValue({ profile: { given_name: 'Georgios', family_name: '   ' } });
    const result = setup(null);
    await act(async () => {
      await result.current.signInWithGoogle();
    });
    expect(stored[`given:${UID}`]).toBe('Georgios');
    expect(stored[`family:${UID}`]).toBe('Ήδη-Γραμμένο');
  });

  it('Σ1.4: απουσία `additionalUserInfo` δεν σπάει τη σύνδεση', async () => {
    additionalInfoMock.mockReturnValue(null);
    const result = setup(null);
    await expect(
      act(async () => {
        await result.current.signInWithGoogle();
      }),
    ).resolves.not.toThrow();
  });
});

// =============================================================================
describe('Σ2 — η κενή φόρμα ΔΕΝ είναι εντολή διαγραφής', () => {
  it('Σ2.1 🔴 Η ΒΛΑΒΗ: κενά και τα δύο πεδία ⇒ το `displayName` ΔΕΝ αγγίζεται', async () => {
    const result = setup('Georgios Pagonis');
    await act(async () => {
      await result.current.updateUserProfile('', '');
    });
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('Σ2.2: ούτε τα αποθηκευμένα given/family πατιούνται με κενό', async () => {
    stored[`given:${UID}`] = 'Georgios';
    stored[`family:${UID}`] = 'Pagonis';
    const result = setup('Georgios Pagonis');
    await act(async () => {
      await result.current.updateUserProfile('   ', '   ');
    });
    expect(stored[`given:${UID}`]).toBe('Georgios');
    expect(stored[`family:${UID}`]).toBe('Pagonis');
  });

  it('Σ2.3 🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: γεμάτα πεδία γράφονται κανονικά', async () => {
    const result = setup(null);
    await act(async () => {
      await result.current.updateUserProfile('Georgios', 'Pagonis');
    });
    expect(updateProfileMock).toHaveBeenCalledWith(expect.anything(), {
      displayName: 'Georgios Pagonis',
    });
    expect(stored[`given:${UID}`]).toBe('Georgios');
  });

  it('Σ2.4: ΜΕΡΙΚΗ συμπλήρωση γράφεται — μόνο το «και τα δύο κενά» είναι μη-εντολή', async () => {
    // Χωρίς αυτό, ο κανόνας θα κλείδωνε τον χρήστη έξω από το να αφαιρέσει
    // **μόνο** το επώνυμό του, που είναι νόμιμη πράξη.
    const result = setup('Georgios Pagonis');
    await act(async () => {
      await result.current.updateUserProfile('Georgios', '');
    });
    expect(updateProfileMock).toHaveBeenCalledWith(expect.anything(), { displayName: 'Georgios' });
    expect(stored[`family:${UID}`]).toBe('');
  });
});
