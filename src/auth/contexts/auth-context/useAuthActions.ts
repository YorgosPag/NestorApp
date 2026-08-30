import { useCallback } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type Auth,
  type MultiFactorResolver,
  type UserCredential,
} from 'firebase/auth';
import type { Dispatch, SetStateAction } from 'react';
import type { FirebaseAuthUser, SignUpData } from '@/auth/types/auth.types';
import { safeSetItem, STORAGE_KEYS } from '@/lib/storage';
import { createModuleLogger } from '@/lib/telemetry';
import { readPermissionsClaim } from '@/lib/auth/claim-permissions';
import {
  composedDisplayName,
  isNameDeclaration,
  type ProfileNames,
} from '@/auth/utils/profile-names';
import { getAuthErrorMessage } from './auth-context-errors';

const logger = createModuleLogger('AuthContextActions');

interface UseAuthActionsParams {
  auth: Auth;
  setUser: Dispatch<SetStateAction<FirebaseAuthUser | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setMfaRequired: Dispatch<SetStateAction<boolean>>;
  setMfaResolver: Dispatch<SetStateAction<MultiFactorResolver | null>>;
  twoFactorService: {
    getMfaResolver: (error: unknown) => MultiFactorResolver | null;
    verifyTotpForSignIn: (resolver: MultiFactorResolver, code: string, hintIndex: number) => Promise<{ result: string; error?: string }>;
  };
}

/**
 * **Τι απέγινε η δήλωση ονόματος** — κλειστό σύνολο, ποτέ `boolean` + τιμή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΟ `unchanged` ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΦΤΑΣΕΙ ΣΤΟ FIRESTORE
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Πριν το ADR-834 η συνάρτηση επέστρεφε `{ displayName, uid }` και **οι δύο**
 * περιπτώσεις έμοιαζαν ίδιες: η «καμία αλλαγή» γύριζε το **παλιό** `displayName`,
 * δηλαδή ένα κείμενο που ο καλών δεν μπορούσε να ξεχωρίσει από νέο. Όσο ο μόνος
 * καταναλωτής ήταν η κατάσταση της οθόνης, δεν πείραζε.
 *
 * ⚠️ **Με δεύτερο αποθετήριο πειράζει, και είναι ακριβώς το περιστατικό της
 * 2026-08-24 ξαναγεννημένο**: ένας γραφέας που έγραφε άνευ όρων ό,τι του γύρισε θα
 * αντέγραφε το «καμία αλλαγή» στο `users/{uid}` ως **γραφή**. Το κλειστό σύνολο το
 * κάνει **αδύνατο να εκφραστεί**: χωρίς `kind: 'declared'` δεν υπάρχουν `names` να
 * γραφτούν.
 */
export type ProfileNamesOutcome =
  /** Και τα δύο πεδία κενά ⇒ **μη-εντολή**. Τίποτα δεν γράφτηκε, πουθενά. */
  | { readonly kind: 'unchanged'; readonly uid: string; readonly displayName: string }
  /** Ο άνθρωπος **δήλωσε**. Γράφτηκε σε Auth + `localStorage`· το Firestore ακολουθεί. */
  | {
      readonly kind: 'declared';
      readonly uid: string;
      readonly displayName: string;
      readonly names: ProfileNames;
    };

/**
 * 🏆 ΣΤΡΩΜΑ 1 — **ΡΩΤΑ ΤΟΝ ΠΑΡΟΧΟ, ΜΗΝ ΜΑΝΤΕΨΕΙΣ** (ADR-798, ζωντανό εύρημα).
 *
 * 🔴 **Το πρόβλημα δεν ήταν ποτέ «πώς σπάμε ένα ονοματεπώνυμο στα δύο».** Το
 * OpenID Connect ορίζει `given_name` και `family_name` ως **ξεχωριστά, πρώτης
 * τάξης claims**, και ο πάροχος Google τα **στέλνει ήδη**. Μέχρι σήμερα η κλήση
 * ήταν `await signInWithPopup(...)` **χωρίς να κρατηθεί το αποτέλεσμα** — δηλαδή
 * ο διαχωρισμός ερχόταν **δωρεάν από τον πάροχο και πετιόταν**. Αποτέλεσμα: τα
 * δύο πεδία της οθόνης προφίλ έμεναν **κενά** για κάθε χρήστη Google, ενώ η
 * εφαρμογή «ήξερε» το ονοματεπώνυμο μέσω του `displayName`.
 *
 * ⛔ **ΜΗΝ γράψεις ΠΟΤΕ επιλυτή που σπάει το `displayName` στα δύο.** Είναι το
 * κλασικό *falsehood programmers believe about names*: η σειρά ονόματος/επωνύμου
 * αλλάζει ανά πολιτισμό, τα σύνθετα επώνυμα (`García López`) και τα σύνθετα
 * ονόματα (`del Carmen`) δεν κόβονται στο κενό. Και **κανένας** από τους
 * μεγάλους δεν το κάνει: Google People API, Microsoft Graph
 * (`givenName`/`surname`) και Auth0 κρατούν **ό,τι έδωσε ο πάροχος**, ποτέ
 * συμπέρασμα.
 *
 * ⚠️ Γράφει στα **ίδια** κλειδιά αποθήκευσης που ήδη διαβάζει ο `buildAuthUser`
 * (`auth-context-session.ts`) — καμία δεύτερη θέση, κανένα νέο σχήμα. Είναι
 * **συμπλήρωση κενού**, όχι νέο υποσύστημα.
 *
 * ⚠️ **Δεν αγγίζει το `AUTH_PROFILE_COMPLETE_PREFIX`**: το αν ο χρήστης έχει
 * «ολοκληρώσει το προφίλ» είναι **άλλο ερώτημα**, με δική του ροή.
 */
function adoptProviderNames(credential: UserCredential): void {
  const profile = getAdditionalUserInfo(credential)?.profile as
    | { given_name?: unknown; family_name?: unknown }
    | undefined;
  if (!profile) return;

  const { uid } = credential.user;
  const given = typeof profile.given_name === 'string' ? profile.given_name.trim() : '';
  const family = typeof profile.family_name === 'string' ? profile.family_name.trim() : '';

  // Μόνο ό,τι όντως ήρθε. Κενό claim ⇒ **καμία** εγγραφή — ώστε να μην πατηθεί
  // τιμή που ο ίδιος ο χρήστης έγραψε σε προηγούμενη σύνδεση.
  if (given.length > 0) {
    safeSetItem(`${STORAGE_KEYS.AUTH_GIVEN_NAME_PREFIX}${uid}`, given);
  }
  if (family.length > 0) {
    safeSetItem(`${STORAGE_KEYS.AUTH_FAMILY_NAME_PREFIX}${uid}`, family);
  }
}

export function useAuthActions(params: UseAuthActionsParams) {
  const {
    auth,
    setUser,
    setLoading,
    setError,
    setMfaRequired,
    setMfaResolver,
    twoFactorService,
  } = params;

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const handleError = useCallback((error: unknown) => {
    const message = getAuthErrorMessage(error);
    setError(message);
    logger.error('[AuthContext] Error', { message });
  }, [setError]);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      logger.info('[AuthContext] Signing in:', { email });
      const credential = await signInWithEmailAndPassword(auth, email, password);
      // Force-refresh token so latest custom claims (companyId, globalRole) are
      // available immediately without waiting for the 1-hour auto-refresh cycle.
      if (credential.user) {
        await credential.user.getIdToken(true);
      }
      logger.info('[AuthContext] Sign in successful');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [auth, handleError, setError, setLoading]);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      logger.info('[AuthContext] Starting Google Sign-In');

      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });

      const credential = await signInWithPopup(auth, provider);
      adoptProviderNames(credential);
      logger.info('[AuthContext] Google Sign-In successful');
    } catch (error) {
      const resolver = twoFactorService.getMfaResolver(error);
      if (resolver) {
        logger.info('[AuthContext] MFA required - showing verification UI');
        setMfaResolver(resolver);
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [auth, handleError, setError, setLoading, setMfaRequired, setMfaResolver, twoFactorService]);

  const verifyMfaCode = useCallback(async (code: string): Promise<void> => {
    let resolverSnapshot: MultiFactorResolver | null = null;
    setMfaResolver((current) => {
      resolverSnapshot = current;
      return current;
    });

    if (!resolverSnapshot) {
      setError('Δεν υπάρχει ενεργή διαδικασία MFA');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      logger.info('[AuthContext] Verifying MFA code...');

      const result = await twoFactorService.verifyTotpForSignIn(resolverSnapshot, code, 0);
      if (result.result === 'success') {
        logger.info('[AuthContext] MFA verification successful');
        setMfaResolver(null);
        setMfaRequired(false);
        return;
      }

      const errorMessage = result.error || 'Μη έγκυρος κωδικός επαλήθευσης';
      setError(errorMessage);
      logger.error('[AuthContext] MFA verification failed', { errorMessage });
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError, setError, setLoading, setMfaRequired, setMfaResolver, twoFactorService]);

  const cancelMfaVerification = useCallback((): void => {
    logger.info('[AuthContext] MFA verification cancelled');
    setMfaResolver(null);
    setMfaRequired(false);
    setError(null);
    setLoading(false);
  }, [setError, setLoading, setMfaRequired, setMfaResolver]);

  const signUp = useCallback(async (data: SignUpData): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const { email, password, givenName, familyName } = data;
      logger.info('[AuthContext] Signing up:', { email });
      const result = await createUserWithEmailAndPassword(auth, email, password);

      if (result.user) {
        const displayName = composedDisplayName({ givenName, familyName });
        await updateProfile(result.user, { displayName });
        safeSetItem(`${STORAGE_KEYS.AUTH_GIVEN_NAME_PREFIX}${result.user.uid}`, givenName);
        safeSetItem(`${STORAGE_KEYS.AUTH_FAMILY_NAME_PREFIX}${result.user.uid}`, familyName);
        safeSetItem(`${STORAGE_KEYS.AUTH_PROFILE_COMPLETE_PREFIX}${result.user.uid}`, 'true');
        await sendEmailVerification(result.user);

        // ADR-660: ΔΕΝ καλούμε πλέον το complete-registration εδώ. Το provisioning
        // (pending record + ειδοποίηση admin) γίνεται server-side από το universal
        // login chokepoint `POST /api/auth/session`, το οποίο πυροδοτεί το
        // onAuthStateChanged μετά το createUserWithEmailAndPassword. Ο χρήστης μένει
        // pending μέχρι έγκριση admin — δεν παίρνει claims/tenant αυτόματα.

        setUser({
          uid: result.user.uid,
          email: result.user.email,
          displayName,
          givenName,
          familyName,
          emailVerified: result.user.emailVerified,
          photoURL: result.user.photoURL,
          profileIncomplete: false,
        });
      }

      logger.info('[AuthContext] Sign up successful');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [auth, handleError, setError, setLoading, setUser]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      logger.info('[AuthContext] Signing out');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:logout'));
        logger.info('[AuthContext] Dispatched auth:logout event');
      }

      await firebaseSignOut(auth);
      logger.info('[AuthContext] Sign out successful');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [auth, handleError, setError, setLoading]);

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    try {
      setError(null);
      logger.info('[AuthContext] Sending password reset to:', { email });
      await sendPasswordResetEmail(auth, email);
      logger.info('[AuthContext] Password reset email sent successfully!');
    } catch (error) {
      logger.error('[AuthContext] Password reset failed', { error });
      handleError(error);
      throw error;
    }
  }, [auth, handleError, setError]);

  // Shared core for updateUserProfile / completeProfile — persist the display name +
  // given/family name on the Firebase user and local storage. Callers add their own
  // post-step (profile-complete flag, user-state shape) so no logic is duplicated.
  const applyProfileNames = useCallback(
    async (givenName: string, familyName: string): Promise<ProfileNamesOutcome> => {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }
      setError(null);
      const { uid } = auth.currentUser;
      const names: ProfileNames = { givenName, familyName };
      const composed = composedDisplayName(names);

      // 🔴 ΣΤΡΩΜΑ 2 — Η ΚΕΝΗ ΦΟΡΜΑ ΔΕΝ ΕΙΝΑΙ ΕΝΤΟΛΗ ΔΙΑΓΡΑΦΗΣ.
      //
      // **Μετρημένη απώλεια δεδομένων (ζωντανά, 2026-08-24)**: το `displayName`
      // υπολογιζόταν άνευ όρων και γραφόταν, οπότε ένα πάτημα «Αποθήκευση» με
      // **κενά** τα δύο πεδία έγραφε κενή συμβολοσειρά στο Firebase Auth — και
      // το επόμενο `syncUserProfileToFirestore` την αντέγραφε ως `null` στο
      // `users/{uid}`. Παρατηρήθηκε `"Georgios Pagonis"` → `null`, από χρήστη
      // που πάτησε Αποθήκευση για **εντελώς άλλο λόγο** (δήλωση επαγγέλματος,
      // ADR-798 Φάση 3 Κ4). Τα πεδία ήταν κενά επειδή η σύνδεση Google δεν είχε
      // ποτέ γεμίσει `givenName`/`familyName` — αυτό το θεραπεύει το ΣΤΡΩΜΑ 1.
      //
      // 🏆 **Το «κανένας ανώνυμος λογαριασμός» ΕΙΝΑΙ η πρακτική των μεγάλων**:
      // Google Account, Microsoft Entra (`displayName` υποχρεωτικό) και το OIDC
      // (`name`) δεν προβλέπουν χρήστη χωρίς όνομα. Άρα η κενή φόρμα διαβάζεται
      // ως **«καμία αλλαγή»**, όχι ως «σβήσ᾽ το» — δεν είναι περιορισμός, είναι
      // το πρότυπο.
      //
      // ⚠️ Η **μερική** συμπλήρωση γράφεται κανονικά: μόνο το «και τα δύο κενά»
      // είναι μη-εντολή. Αλλιώς δεν θα μπορούσες να αφαιρέσεις μόνο το επώνυμο.
      //
      // 🔑 **ΚΑΙ Ο ΚΡΙΤΗΣ ΕΞΗΧΘΗ** (ADR-834 §6.2): τον ρωτά πλέον **και** ο γραφέας του
      //    `users/{uid}`. Γραμμένος δεύτερη φορά εκεί, η πρώτη απόκλιση θα έσβηνε το
      //    όνομα από το ένα αποθετήριο και θα το κρατούσε στο άλλο — το περιστατικό
      //    ξαναγεννημένο **μισό**, που είναι και το δυσκολότερο να παρατηρηθεί.
      if (!isNameDeclaration(names)) {
        return { kind: 'unchanged', uid, displayName: auth.currentUser.displayName ?? '' };
      }

      await updateProfile(auth.currentUser, { displayName: composed });
      safeSetItem(`${STORAGE_KEYS.AUTH_GIVEN_NAME_PREFIX}${uid}`, givenName);
      safeSetItem(`${STORAGE_KEYS.AUTH_FAMILY_NAME_PREFIX}${uid}`, familyName);
      return { kind: 'declared', uid, displayName: composed, names };
    },
    [auth, setError],
  );

  // ⚠️ **ΕΠΙΣΤΡΕΦΟΥΝ ΤΗΝ ΕΚΒΑΣΗ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΔΙΑΡΡΟΗ ΛΕΠΤΟΜΕΡΕΙΑΣ** (ADR-834 §6.2):
  //    το `users/{uid}` ζει σε **άλλο αποθετήριο** και ο γραφέας του δεν ανήκει εδώ
  //    (δες την κεφαλίδα του `saveDeclaredOccupation` — ίδια απόφαση, ίδιος λόγος).
  //    Ο συνθέτης (`AuthContext`) οφείλει να μάθει **αν δηλώθηκε κάτι**, αλλιώς θα
  //    γράφει το «καμία αλλαγή» ως αλλαγή.
  const updateUserProfile = useCallback(async (givenName: string, familyName: string): Promise<ProfileNamesOutcome> => {
    try {
      const outcome = await applyProfileNames(givenName, familyName);
      const { displayName } = outcome;
      setUser((prev) => prev ? { ...prev, displayName, givenName, familyName } : null);
      logger.info('[AuthContext] Profile updated:', { displayName });
      return outcome;
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [applyProfileNames, handleError, setUser]);

  const completeProfile = useCallback(async (givenName: string, familyName: string): Promise<ProfileNamesOutcome> => {
    try {
      const outcome = await applyProfileNames(givenName, familyName);
      const { displayName, uid } = outcome;
      safeSetItem(`${STORAGE_KEYS.AUTH_PROFILE_COMPLETE_PREFIX}${uid}`, 'true');
      setUser((prev) => prev ? { ...prev, displayName, givenName, familyName, profileIncomplete: false } : null);
      logger.info('[AuthContext] Profile completed for Google user:', { displayName });
      return outcome;
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [applyProfileNames, handleError, setUser]);

  const sendVerificationEmailAction = useCallback(async (): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);
      await sendEmailVerification(auth.currentUser);
      logger.info('[AuthContext] Verification email sent');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [auth, handleError, setError]);

  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);
      logger.info('[AuthContext] Force refreshing ID token...');
      const idTokenResult = await auth.currentUser.getIdTokenResult(true);
      setUser((prev) => prev ? {
        ...prev,
        globalRole: typeof idTokenResult.claims.globalRole === 'string' ? idTokenResult.claims.globalRole : prev.globalRole,
        companyId: typeof idTokenResult.claims.companyId === 'string' ? idTokenResult.claims.companyId : prev.companyId,
        // 🔴 ADR-801 §2.8 — ΗΤΑΝ `: prev.permissions`, και αυτό ήταν ο **δεύτερος**
        //    κανόνας ανάγνωσης του ίδιου claim: αν το ανανεωμένο token **δεν**
        //    έφερνε το κανάλι, η συνάρτηση που λογάρει «new permissions loaded»
        //    κρατούσε τα **παλιά** — δηλαδή μια **ανάκληση δεν προσγειωνόταν**.
        //    Πλέον η απουσία του claim σημαίνει το ίδιο εδώ και στον server:
        //    **καμία ρητή παραχώρηση**.
        permissions: readPermissionsClaim(idTokenResult.claims.permissions),
        mfaEnrolled: typeof idTokenResult.claims.mfaEnrolled === 'boolean' ? idTokenResult.claims.mfaEnrolled : prev.mfaEnrolled,
      } : prev);
      logger.info('[AuthContext] Token refreshed successfully - new permissions loaded');
    } catch (error) {
      logger.error('[AuthContext] Token refresh failed', { error });
      handleError(error);
      throw error;
    }
  }, [auth, handleError, setError, setUser]);

  /**
   * 🖼️ ADR-798 §16 — Η ΦΩΤΟΓΡΑΦΙΑ ΠΡΟΦΙΛ.
   *
   * Γράφει **μόνο** στο Firebase Auth. ⚠️ **ΔΕΝ αγγίζει ΠΟΤΕ τον λογαριασμό
   * Google του ανθρώπου**: το Google είναι **πάροχος ταυτότητας** — δίνει
   * δεδομένα στη σύνδεση, δεν τα παίρνει πίσω. Ρωτήθηκε ρητά και απαντήθηκε.
   *
   * 🔑 **ΤΟ `null` ΔΕΝ ΣΗΜΑΙΝΕΙ «ΚΑΜΙΑ ΦΩΤΟΓΡΑΦΙΑ» — ΣΗΜΑΙΝΕΙ «ΠΙΣΩ ΣΤΟΝ
   * ΠΑΡΟΧΟ».** Ένα σκέτο `updateProfile({ photoURL: null })` θα άφηνε τον
   * άνθρωπο με **κενό** avatar, ενώ αυτό που ζήτησε ήταν να **αφαιρέσει τη δική
   * του** εικόνα — και είχε ήδη μία από το Google πριν ανεβάσει. Η επαναφορά
   * διαβάζεται από το `providerData`, που το κρατά ο **πάροχος** και δεν το
   * πειράζει το `updateProfile` (γι' αυτό επιβιώνει της αντικατάστασης).
   *
   * Ιδεμπόταντ: δεύτερη κλήση με την ίδια τιμή = ίδιο αποτέλεσμα.
   */
  const updateUserPhoto = useCallback(async (photoURL: string | null): Promise<void> => {
    try {
      if (!auth.currentUser) throw new Error('No authenticated user');
      setError(null);
      const fallback = auth.currentUser.providerData.find((p) => p.photoURL)?.photoURL ?? null;
      const next = photoURL ?? fallback;
      await updateProfile(auth.currentUser, { photoURL: next });
      setUser((prev) => (prev ? { ...prev, photoURL: next } : null));
      logger.info('[AuthContext] Profile photo updated', { restored: photoURL === null });
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [auth, handleError, setError, setUser]);

  return {
    clearError,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updateUserProfile,
    updateUserPhoto,
    completeProfile,
    sendVerificationEmail: sendVerificationEmailAction,
    verifyMfaCode,
    cancelMfaVerification,
    refreshToken,
  };
}
