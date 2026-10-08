'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { sessionService } from '@/services/session';
import { twoFactorService } from '@/services/two-factor/EnterpriseTwoFactorService';
import { AUTH_EVENTS } from '@/config/domain-constants';
import type {
  FirebaseAuthUser,
  SecondFactorOutcome,
  SessionPhase,
  SignInOutcome,
  SignUpData,
} from '../types/auth.types';
import { RealtimeService } from '@/services/realtime';
import type { UserSettingsUpdatedPayload } from '@/services/realtime';
import { userPreferencesService } from '@/services/user/EnterpriseUserPreferencesService';
import { createModuleLogger } from '@/lib/telemetry';
import { clearCorruptedUserData, validateSession } from './auth-context/auth-context-errors';
import {
  buildAuthUser,
  clearServerSessionCookie,
  syncServerSession,
} from './auth-context/auth-context-session';
import {
  saveDeclaredOccupation,
  saveProfileNames,
  syncUserProfileToFirestore,
} from './auth-context/auth-context-profile';
import type { DeclaredOccupation } from '@/types/professional-identity';
import { readPermissionsClaim } from '@/lib/auth/claim-permissions';
import i18n from '@/i18n/config';
import { bindAuthLanguage } from '@/auth/firebase-auth-language';
import { useAuthActions } from './auth-context/useAuthActions';
import { useSecondFactor } from './auth-context/second-factor';
import { useClaimsRefresh } from './auth-context/use-claims-refresh';
import { useSignInRevocation } from './auth-context/use-sign-in-revocation';
import { useSessionRefreshEvent } from './auth-context/use-session-refresh-event';
import { observeIdentity } from './auth-context/identity-epoch';
import { endSignIn, isEndSignInActive } from '../identity-change/end-sign-in';
import type { EndSignInRequest } from '../identity-change/end-sign-in-destinations';

const logger = createModuleLogger('AuthContext');

export interface AuthContextType {
  user: FirebaseAuthUser | null;
  /**
   * 🆕 Το **δηλωμένο επάγγελμα** του συνδεδεμένου ανθρώπου (ADR-798 Φάση 2).
   *
   * Ζει στο `users/{uid}` και **ποτέ στα claims** (Α4) — άρα δεν βρίσκεται πάνω
   * στο `user`, που χτίζεται από το token. Γεμίζει από το `getDoc` που το
   * `syncUserProfileToFirestore` έκανε **ήδη**, με **μηδέν επιπλέον αίτημα**.
   *
   * ⚠️ **`null` σημαίνει «δεν ρωτήθηκε ακόμη» (`unknown`), ΠΟΤΕ «δεν έχει».**
   * Κάθε πεδίο μέσα του είναι επίσης προαιρετικό: ένας άνθρωπος **μπορεί** να
   * μην έχει δηλώσει επάγγελμα, και αυτό είναι νόμιμη κατάσταση, όχι κενό προς
   * συμπλήρωση (ADR-798 §7 · Α5: καμία ερώτηση, καμία modal).
   *
   * ⛔ **ΠΟΤΕ ως πηγή δικαιώματος** — είναι **αυτο-δηλωμένο**.
   */
  declaredOccupation: DeclaredOccupation | null;
  /** **ΑΦΜ** του ίδιου του χρήστη (ADR-827 §9.20). `null` = δεν δηλώθηκε. */
  vatNumber: string | null;
  /**
   * ADR-798 Φάση 3 (Κ4) — η **δήλωση** του επαγγέλματος από τον ίδιο τον χρήστη.
   *
   * ⚠️ **Α5: ΚΑΜΙΑ modal, καμία ερώτηση πριν ή μετά το login.** Καλείται **μόνο**
   * από σελίδα προφίλ, όποτε το θελήσει **ο ίδιος**.
   *
   * ⛔ **ΔΕΝ δίνει κανένα δικαίωμα** — το αποτέλεσμα σπάει **ισοβαθμία** στην
   * πρόταση δουλειάς και τίποτε άλλο (`isco-job-affinity.ts`).
   */
  updateDeclaredOccupation: (occupation: DeclaredOccupation) => Promise<void>;
  /**
   * Γράφει το ΑΦΜ **μέσω του διακομιστή** — ποτέ απευθείας στο Firestore.
   * @returns `null` αν αποθηκεύτηκε, αλλιώς ο **κωδικός άρνησης** για κλειδί i18n.
   */
  updateVatNumber: (raw: string) => Promise<string | null>;
  loading: boolean;
  error: string | null;
  /**
   * 🔴 **ADR-859 — Η ΜΙΑ ΑΠΑΝΤΗΣΗ ΣΤΟ «ΟΛΟΚΛΗΡΩΘΗΚΕ Η ΣΥΝΔΕΣΗ;»**.
   * Γίνεται `established` **μόνο αφού** στηθεί το `__session` (ADR-819 §4.2). Καμία
   * φόρμα δεν πλοηγεί από το αποτέλεσμα μιας πράξης· πλοηγεί από εδώ.
   */
  sessionPhase: SessionPhase;
  signIn: (email: string, password: string) => Promise<SignInOutcome>;
  signInWithGoogle: () => Promise<SignInOutcome>;
  signUp: (data: SignUpData) => Promise<void>;
  /**
   * 🔴 **ADR-908 — Ο ΛΟΓΟΣ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ, ΚΑΙ Ο ΚΑΛΩΝ ΔΕΝ ΠΛΟΗΓΕΙ.** Ο προορισμός βγαίνει από τον ΕΝΑΝ
   * πίνακα (`end-sign-in-destinations`)· η πλοήγηση είναι **εγγράφου** και γίνεται **μετά** το τελευταίο `await`.
   */
  signOut: (request: EndSignInRequest) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (givenName: string, familyName: string) => Promise<void>;
  /**
   * 🖼️ ADR-798 §16 — η φωτογραφία προφίλ. `null` = **επαναφορά στην εικόνα του
   * παρόχου** (Google), ΟΧΙ «καμία εικόνα». Γράφει μόνο στο Firebase Auth —
   * ποτέ στον λογαριασμό Google.
   */
  updateUserPhoto: (photoURL: string | null) => Promise<void>;
  completeProfile: (givenName: string, familyName: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  mfaRequired: boolean;
  verifyMfaCode: (code: string) => Promise<SecondFactorOutcome>;
  cancelMfaVerification: () => void;
  clearError: () => void;
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * «Αυτός ο browser είναι ενεργός» (ADR-894). Ο server γράφει την εγγραφή — UA, IP και τοποθεσία από το
 * ίδιο το αίτημα. Μία εγγραφή ανά browser: το id ζει στο localStorage και οι καρτέλες σειριοποιούνται.
 */
async function syncActiveSession(firebaseUser: FirebaseUser): Promise<string | null> {
  try {
    const loginMethod = firebaseUser.providerData.some(
      (provider) => provider.providerId === 'google.com',
    ) ? 'google' : 'email';

    const { sessionId, created } = await sessionService.syncActiveSession(firebaseUser.uid, loginMethod);
    logger.debug('[AuthContext] Active session synced', { sessionId, created });
    return sessionId;
  } catch (sessionError) {
    logger.warn('[AuthContext] Failed to manage session (non-blocking)', { error: sessionError });
    return null;
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [declaredOccupation, setDeclaredOccupation] = useState<DeclaredOccupation | null>(null);
  const [vatNumber, setVatNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('anonymous');
  // ADR-894 — η εγγραφή «αυτή η συσκευή», όταν την επιβεβαιώσει ο server (δένει τη συνδρομή ανάκλησης).
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // ADR-859 — ο δεύτερος παράγοντας έχει ΕΝΑΝ κάτοχο (ήταν γραμμένος δύο φορές).
  // ⚠️ Αποδομημένο: το αντικείμενο είναι νέο σε κάθε απόδοση, οι συναρτήσεις σταθερές —
  //    ως εξάρτηση του `useMemo` θα ξαναέφτιαχνε το context σε ΚΑΘΕ απόδοση.
  const {
    mfaRequired,
    challenge: challengeSecondFactor,
    verify: verifyMfaCode,
    cancel: cancelMfaVerification,
  } = useSecondFactor({ twoFactorService, setLoading, setError });

  const actions = useAuthActions({
    auth,
    currentLanguage: () => i18n.language,
    setUser,
    setLoading,
    setError,
    challengeSecondFactor,
  });

  // 🔴 ADR-908 §3.1/§3.3 — η αποσύνδεση ΑΝΑΤΙΘΕΤΑΙ στον ΕΝΑΝ κάτοχο. Το `loading` ανεβαίνει εδώ και το
  //    κατεβάζει ΜΟΝΟ η έκβαση `stay`· στο `navigate` το έγγραφο φεύγει και δεν το κατεβάζει κανείς.
  const signOut = useCallback(async (request: EndSignInRequest): Promise<void> => {
    setLoading(true);
    setError(null);
    if ((await endSignIn(request)) === 'stay') setLoading(false);
  }, []);

  // 🌐 ADR-851 — η γλώσσα των μηνυμάτων της ίδιας της Firebase ακολουθεί την οθόνη.
  useEffect(() => bindAuthLanguage(auth, i18n), []);

  useEffect(() => {
    // ⛔ **ΤΟ `ensureDevUserProfile()` ΣΒΗΣΤΗΚΕ ΑΠΟ ΕΔΩ — 2026-08-27 (ADR-821 §2.6).**
    //    Έγραφε `users/dev-admin` με `globalRole: 'super_admin'` μέσω Admin SDK, σε
    //    **κάθε** φόρτωση του provider. Το έγγραφο **υπάρχει στην παραγωγή** από
    //    2026-03-13, με `authProvider: 'development-bypass'`.
    //
    // 🔴 **ΠΩΣ ΠΕΡΑΣΕ ΤΟΝ ΦΡΟΥΡΟ**: η διαδρομή `/api/admin/ensure-user-profile`
    //    απαιτεί `requiredGlobalRoles: ['super_admin','company_admin']` — και η
    //    ανώνυμη κλήση την **ικανοποιούσε**, επειδή το `buildApiIdentity` της
    //    κατασκεύαζε `company_admin`. Ο φρουρός δεν παρακάμφθηκε· τον πέρασε
    //    ταυτότητα που έφτιαξε το ίδιο το σύστημα (ADR-821 §2.7).
    //
    // ⛔ **ΜΗΝ ΤΟ ΞΑΝΑΦΕΡΕΙΣ.** Η **επιμονή** μιας κατασκευής είναι κατηγοριακά
    //    διαφορετική από την κατασκευή: παύει να είναι τοπική ευκολία και γίνεται
    //    **δεδομένο παραγωγής**. Καμία από τις πέντε πλατφόρμες της έρευνας (§3)
    //    δεν γράφει ποτέ κατασκευασμένη ταυτότητα σε βάση.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      logger.debug('[AuthContext] Auth state changed:', { uid: firebaseUser?.uid || 'No user' });
      // ADR-908 §3.2 — ΣΥΓΧΡΟΝΑ, πριν από κάθε `await`: άλλος άνθρωπος ⇒ ό,τι εκκρεμεί παραιτείται.
      observeIdentity(firebaseUser?.uid ?? null);

      const validation = validateSession(firebaseUser);
      logger.debug('[AuthContext] Session validation:', { status: validation.status });

      if (!validation.isValid && validation.recommendation === 'LOGOUT') {
        logger.error('[AuthContext] INVALID SESSION DETECTED:', { status: validation.status });
        logger.error('[AuthContext] Issues:', { issues: validation.issues });

        if (firebaseUser?.uid) {
          clearCorruptedUserData(firebaseUser.uid);
        }

        try {
          logger.debug('[AuthContext] Auto-logout triggered for security');
          await auth.signOut();
        } catch (logoutError) {
          logger.error('[AuthContext] Auto-logout failed', { error: logoutError });
        }

        setSessionPhase('anonymous');
        setUser(null);
        setDeclaredOccupation(null);
        setVatNumber(null);
        setActiveSessionId(null);
        setLoading(false);
        return;
      }

      if (!firebaseUser) {
        // 🔴 ADR-908 §3.3 — όσο τρέχει ο κάτοχος της αποσύνδεσης, το cookie το σβήνει ΕΚΕΙΝΟΣ (ήταν δύο `DELETE`)
        //    και το `loading` ΜΕΝΕΙ: αν έπεφτε εδώ, οι φρουροί θα πλοηγούσαν πριν φύγει το έγγραφο.
        const ownedByEndSignIn = isEndSignInActive();
        if (!ownedByEndSignIn) {
          try {
            await clearServerSessionCookie();
            logger.debug('[AuthContext] Server session cookie cleared');
          } catch (sessionError) {
            logger.warn('[AuthContext] Failed to clear server session cookie (non-blocking)', { error: sessionError });
          }
        }
        setSessionPhase('anonymous');
        setUser(null);
        setDeclaredOccupation(null);
        setVatNumber(null);
        setActiveSessionId(null);
        if (!ownedByEndSignIn) setLoading(false);
        return;
      }

      // ADR-859 — ο πάροχος δέχτηκε· ό,τι ακολουθεί (claims · προφίλ · cookie) ΣΤΗΝΕΙ τη
      // συνεδρία. Η οθόνη σύνδεσης δείχνει φόρτωση, αλλά ΔΕΝ πλοηγεί ακόμη.
      setSessionPhase('establishing');

      let customClaims: Record<string, unknown> = {};
      try {
        const idTokenResult = await firebaseUser.getIdTokenResult(true);
        customClaims = idTokenResult.claims;
        logger.debug('[AuthContext] Custom claims loaded:', {
          globalRole: customClaims.globalRole,
          companyId: customClaims.companyId,
          // ADR-801 §2.8 — ο **ίδιος** αναγνώστης με την κρίση: ένα log που
          // μετρά αλλιώς από ό,τι κρίνεται είναι διαγνωστικό που παραπλανά
          // ακριβώς όταν το χρειάζεσαι.
          permissions: readPermissionsClaim(customClaims.permissions)?.length ?? 0,
        });
      } catch (claimsError) {
        logger.warn('[AuthContext] Failed to load custom claims (non-blocking)', { error: claimsError });
      }

      const synced = await syncUserProfileToFirestore(db, firebaseUser, customClaims);
      setDeclaredOccupation(synced.occupation);
      setVatNumber(synced.vatNumber);
      const authUser = buildAuthUser(firebaseUser, customClaims);

      // 🔴 ADR-819 §4.2 — Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: ΤΟ COOKIE **ΠΡΙΝ** ΤΟΝ `user`.
      //
      // Μέχρι τις 2026-08-26 το `setUser` έτρεχε **εδώ**, και το `syncServerSession`
      // **δύο await παρακάτω**. Το `useAuthFormState` πλοηγεί σε `useEffect` που
      // πυροδοτεί ο **ίδιος ο `user`** (`useAuthFormState.ts:107`) ⇒ ο React
      // ξαναπέδιδε και **έφευγε** ενώ το `__session` δεν είχε ακόμη στηθεί.
      //
      // Το server component `(app)/[...unprefixed]` έτρεχε τότε **χωρίς cookie**,
      // έπεφτε στο dev bypass του `page-identity.ts` και **κατασκεύαζε** companyId
      // από το `.env.local` (`NEXT_PUBLIC_DEFAULT_COMPANY_ID`) — μετρημένο ζωντανά:
      // ο `int.architect@alpha.local` προσγειωνόταν σε `/o/comp_9c7c1a50-…/dashboard`
      // και έπαιρνε **404**, επειδή το claim του έλεγε άλλον χώρο.
      //
      // ⛔ **ΜΗΝ το «λύσεις» με `setTimeout`** (ADR-819 §5 Α6): ο αγώνας γίνεται
      //    λιγότερο **πιθανός**, όχι **αδύνατος** — πράσινο για λάθος λόγο.
      //    Ο `user` γίνεται μη-κενός **μόνο αφού** υπάρχει το cookie: η πλοήγηση
      //    δεν **μπορεί** πλέον να προσπεράσει τη συνεδρία (N.7.2 Q2).
      //
      // ⚠️ Παραμένει **non-blocking**: αποτυχία του cookie δεν επιτρέπεται να
      //    αφήσει τον άνθρωπο κολλημένο σε οθόνη φόρτωσης — προχωρά, και οι
      //    φρουροί του διακομιστή θα τον στείλουν στη σύνδεση.
      try {
        await syncServerSession(firebaseUser);
        logger.debug('[AuthContext] Server session cookie synced');
      } catch (sessionError) {
        logger.warn('[AuthContext] Failed to sync server session cookie (non-blocking)', { error: sessionError });
      }

      logger.info('[AuthContext] Valid session established:', { email: authUser.email });
      setSessionPhase('established');
      setUser(authUser);

      // Παράπλευρη ενέργεια — δεν καθυστερεί την οθόνη (N.7.2 #6).
      void syncActiveSession(firebaseUser).then(setActiveSessionId);

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ADR-894 §10.1 + §10.7: ανάκληση ΑΥΤΗΣ της συσκευής — από την εγγραφή της ή από το ίδιο της το token.
  useSignInRevocation({ uid: user?.uid, activeSessionId, signOut });

  // ADR-360: Auto-refresh ID token when server bumps claimsUpdatedAt mirror
  useClaimsRefresh({
    uid: user?.uid,
    tokenClaimsUpdatedAt: user?.claimsUpdatedAt,
    setUser,
  });

  useSessionRefreshEvent(setUser);

  useEffect(() => {
    if (!user) {
      return;
    }

    const handleSettingsUpdated = (payload: UserSettingsUpdatedPayload) => {
      if (payload.userId === user.uid) {
        userPreferencesService.clearCacheForUser(user.uid);
      }
    };

    return RealtimeService.subscribe('USER_SETTINGS_UPDATED', handleSettingsUpdated);
  }, [user]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    declaredOccupation,
    vatNumber,
    loading,
    error,
    sessionPhase,
    signIn: actions.signIn,
    signInWithGoogle: actions.signInWithGoogle,
    /**
     * 🔴 **ADR-834 §6.6** — η **τρίτη** διαδρομή του ονόματος, που έλειπε: η εγγραφή με
     * email/κωδικό έγραφε το όνομα **μόνο** σε Firebase Auth + `localStorage`, και ο
     * ολοκαίνουργιος χρήστης έβρισκε `givenName: null` στο `users/{uid}`.
     *
     * 🔑 **Ίδιος γραφέας, ίδιος κριτής, ίδιο σχήμα** με τις δύο από κάτω — καμία νέα έννοια:
     * μόνο η έκβαση `declared` κουβαλά `names`, άρα «καμία δήλωση» **δεν μπορεί** να γραφτεί.
     */
    signUp: async (data: SignUpData) => {
      const outcome = await actions.signUp(data);
      if (outcome.kind === 'declared') {
        await saveProfileNames(db, outcome.uid, outcome.names);
      }
    },
    signOut,
    resetPassword: actions.resetPassword,
    /**
     * 🔴 **ADR-834 §6.2 — ΤΟ ΔΕΥΤΕΡΟ ΑΠΟΘΕΤΗΡΙΟ, ΠΟΥ ΕΛΕΙΠΕ ΟΛΟΚΛΗΡΟ.**
     *
     * Το `actions.updateUserProfile` γράφει **Firebase Auth + `localStorage`**· το
     * `users/{uid}` δεν το άγγιζε **κανείς** (μετρημένο ζωντανά: `givenName: null`
     * σε λογαριασμό με `displayName: "Georgios Pagonis"`). Ο κριτής ταυτότητας του
     * ADR-834 διαβάζει **το έγγραφο** — άρα χωρίς αυτή τη γραμμή η άρνησή του θα
     * ήταν **αδιέξοδο**: ο άνθρωπος διορθώνει και τίποτα δεν αλλάζει.
     *
     * 🔑 **Ίδιο σχήμα με το επάγγελμα ακριβώς από κάτω**: ο γραφέας του Firestore
     * ζει στο `auth-context-profile.ts`, όχι στο `useAuthActions`. Δύο αποθετήρια,
     * δύο ιδιοκτήτες, **ένας** κριτής για το «δηλώθηκε κάτι;».
     *
     * ⚠️ **Το `unchanged` ΔΕΝ γράφει**, και το επιβάλλει ο **τύπος**: μόνο η έκβαση
     * `declared` κουβαλά `names`. Είναι η θεραπεία της 2026-08-24, μεταφερμένη στο
     * δεύτερο αποθετήριο **χωρίς** να ξαναγραφτεί ο κανόνας.
     */
    updateUserProfile: async (givenName: string, familyName: string) => {
      const outcome = await actions.updateUserProfile(givenName, familyName);
      if (outcome.kind === 'declared') {
        await saveProfileNames(db, outcome.uid, outcome.names);
      }
    },
    updateUserPhoto: actions.updateUserPhoto,
    /**
     * ⚠️ **ΚΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ Η ΠΙΟ ΣΗΜΑΝΤΙΚΗ ΑΠΟ ΤΙΣ ΔΥΟ**: αυτή είναι η διαδρομή
     * του χρήστη **Google**, δηλαδή ακριβώς εκείνου που δεν πέρασε ποτέ από φόρμα
     * εγγραφής και του οποίου τα δύο πεδία έμεναν `null` για πάντα (§2.1 ρίζα).
     */
    completeProfile: async (givenName: string, familyName: string) => {
      const outcome = await actions.completeProfile(givenName, familyName);
      if (outcome.kind === 'declared') {
        await saveProfileNames(db, outcome.uid, outcome.names);
      }
    },
    // ADR-798 Φάση 3 (Κ4) — ζει **εδώ** και όχι στο `useAuthActions`: εκείνο
    // γράφει σε Firebase Auth + localStorage και **δεν αγγίζει Firestore**
    // πουθενά, ενώ το επάγγελμα ζει στο `users/{uid}`. Δύο αποθετήρια, δύο
    // ιδιοκτήτες. 🔑 Η κατάσταση τίθεται από ό,τι **γράφτηκε πραγματικά**
    // (`written`), ποτέ από ό,τι πληκτρολογήθηκε: ο γραφέας καθαρίζει κενά και
    // **σβήνει** τη μισή ταξινόμηση, οπότε η οθόνη οφείλει να δει το αληθινό
    // αποτέλεσμα — αλλιώς θα έδειχνε ταξινομημένο κάτι που δεν αποθηκεύτηκε.
    updateDeclaredOccupation: async (occupation: DeclaredOccupation) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('No authenticated user');
      setDeclaredOccupation(await saveDeclaredOccupation(db, uid, occupation));
    },
    /**
     * 🔴 **ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ, ΚΑΙ ΕΙΝΑΙ Ο ΜΟΝΟΣ ΔΡΟΜΟΣ** (ADR-827 §9.20).
     *
     * Το `vatNumber` είναι `serverOwnedUserFields()` στα `firestore.rules`, άρα
     * ένα `setDoc` από εδώ **θα απορριπτόταν** — σωστά: ο **mod-11 ελεγκτής** δεν
     * εκφράζεται σε κανόνα, και ελεύθερη πελατική γραφή θα σήμαινε «κάθε εννιάδα
     * ψηφίων είναι ΑΦΜ» ⇒ **σύμβαση με άκυρο στοιχείο** (άρθρο 200 §2).
     *
     * 🔑 Η κατάσταση τίθεται από ό,τι **γράφτηκε πραγματικά** (η απάντηση του
     * διακομιστή), ποτέ από ό,τι πληκτρολογήθηκε — ίδιο δόγμα με το επάγγελμα:
     * ο γραφέας **κανονικοποιεί** (αφαιρεί κενά), οπότε η οθόνη οφείλει να δει το
     * αληθινό αποτέλεσμα.
     */
    updateVatNumber: async (raw: string): Promise<string | null> => {
      const response = await fetch('/api/account/vat-number', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vatNumber: raw }),
      });
      const payload: unknown = await response.json();

      if (response.ok && payload !== null && typeof payload === 'object' && 'vatNumber' in payload) {
        const saved = (payload as { vatNumber: string | null }).vatNumber;
        setVatNumber(saved);
        return null;
      }

      // ⚠️ **Ονομαστικός** λόγος όταν υπάρχει· αλλιώς η γενική βλάβη. Ποτέ τα δύο
      //    ίδια (N.12): «δεν έγραψα» ≠ «λάθος ΑΦΜ».
      const reason =
        payload !== null && typeof payload === 'object' && 'reason' in payload
          ? String((payload as { reason: unknown }).reason)
          : null;
      return reason ?? 'write-failed';
    },
    sendVerificationEmail: actions.sendVerificationEmail,
    mfaRequired,
    verifyMfaCode,
    cancelMfaVerification,
    refreshToken: actions.refreshToken,
    clearError: actions.clearError,
    isAuthenticated: !!user,
    needsProfileCompletion: user?.profileIncomplete ?? false,
    // ⚠️ Το `declaredOccupation` ΠΡΕΠΕΙ να είναι εδώ: χωρίς αυτό η τιμή του
    // context παγώνει στο `null` της πρώτης απόδοσης, και το επάγγελμα θα
    // φαινόταν «μη δηλωμένο» για πάντα — σφάλμα που **καμία** πύλη δεν πιάνει
    // και που στην οθόνη μοιάζει με «ο χρήστης δεν έχει επάγγελμα».
  }), [
    actions, cancelMfaVerification, declaredOccupation, error, loading, mfaRequired,
    sessionPhase, signOut, user, vatNumber, verifyMfaCode,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('🔴 useAuth must be used within an AuthProvider. Wrap your component tree with <AuthProvider>.');
  }
  return context;
}

export function useAuthOptional(): AuthContextType | null {
  return useContext(AuthContext);
}

export { AuthProvider as FirebaseAuthProvider };
export { useAuth as useFirebaseAuth };
export default AuthContext;
