'use client';

// =============================================================================
// 🔐 USER ROLE CONTEXT - ROLE-BASED ACCESS CONTROL
// =============================================================================
//
// Ο ρόλος βγαίνει από τα **claims**, μέσα από τον ΕΝΑ κριτή (ADR-801/813).
//
// ⚠️ Η κεφαλίδα αυτή έγραφε μέχρι τις 2026-08-26: *«Uses EnterpriseSecurityService
// for database-driven role determination»* και *«Database-driven role management
// (no hardcoded admin emails!)»*. **Και τα δύο ήταν ψευδή**: ο ρόλος ερχόταν από
// το `NEXT_PUBLIC_ADMIN_EMAILS`, δηλαδή από **σκληροκωδικοποιημένη λίστα email**
// — ακριβώς αυτό που η επόμενη γραμμή διαφήμιζε ότι δεν υπάρχει.
// *Η περιγραφή της λύσης ΗΤΑΝ η απόκλιση* (σχήμα CHECK 3.34 · 3.37 · 3.57).
//
// Σήμερα:
// - Ο ρόλος παράγεται από `decideCapability` πάνω στα claims του `AuthContext`
// - Καμία μεταβλητή περιβάλλοντος, κανένα email, καμία λίστα ρόλων εδώ
// - **Σύγχρονα** — η απάντηση υπάρχει στο πρώτο καρέ, όχι στο δεύτερο
//
// =============================================================================

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { decideCapability } from '@/lib/auth/authority';
import { isGranted } from '@/types/capability-authority';
import type { User, FirebaseAuthUser, UserRoleContextType, SignUpData } from '../types/auth.types';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('UserRoleContext');

// =============================================================================
// CONTEXT
// =============================================================================

const UserRoleContext = createContext<UserRoleContextType | null>(null);

// ⚠️ Το singleton του EnterpriseSecurityService **έφυγε** (ADR-813 Φάση Β): το
// υποσύστημα ρόλων του δεν έχει πλέον κανέναν καταναλωτή — βλ. §7.4 του ADR.

// =============================================================================
// PROVIDER
// =============================================================================

interface UserRoleProviderProps {
  children: React.ReactNode;
}

export function UserRoleProvider({ children }: UserRoleProviderProps) {
  const {
    user: firebaseUser,
    loading: authLoading,
    signIn,
    signUp: authSignUp,
    signOut,
    resetPassword: authResetPassword
  } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================================================
  // 🔴 Η ΑΠΟΦΑΣΗ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟΝ ΚΡΙΤΗ, ΟΧΙ ΑΠΟ ΤΟ EMAIL (ADR-813 Φάση Β)
  // ==========================================================================
  //
  // 🔑 **ΤΙ ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ**: `securityService.checkUserRole(email)` — η
  //    **μοναδική** πηγή που έβαζε το `NEXT_PUBLIC_ADMIN_EMAILS` **μέσα στο
  //    bundle του φυλλομετρητή**. Μετρημένο στο χτισμένο bundle: η τιμή
  //    ταξίδευε inlined από το Turbopack σε **2 εκτελέσιμα `.js` chunks`**.
  //    Δηλαδή η λίστα των διαχειριστών ήταν **αναγνώσιμη από οποιονδήποτε**
  //    άνοιγε τα devtools — και ταυτόχρονα **πάγωνε στο build**, άρα η
  //    ανάκληση διαχειριστή απαιτούσε redeploy (ADR-813 §3.1/§3.2).
  //
  // ✅ **ΤΩΡΑ**: ο **ΕΝΑΣ** κριτής (`decideCapability`, ADR-801) πάνω στα claims
  //    που έχει **ήδη** ο `AuthContext`. Καμία νέα πηγή, καμία νέα εξάρτηση.
  //
  // 🔑 **ΚΑΙ ΕΓΙΝΕ ΣΥΓΧΡΟΝΟ — ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ ΠΑΡΕΝΕΡΓΕΙΑ, ΕΙΝΑΙ ΘΕΡΑΠΕΙΑ.** Η
  //    παλιά μορφή ήταν `async` μέσα σε `useEffect`, δηλαδή ο ρόλος
  //    **αρχικοποιούνταν λάθος και διορθωνόταν σε δεύτερο καρέ**. Είναι το ίδιο
  //    σχήμα που το CHECK 3.51 (ADR-781) μέτρησε ως **17 ωμά κλειδιά × 141
  //    διαδρομές** στο SSR: `useEffect` **δεν τρέχει στον server**. Ο κριτής
  //    είναι **καθαρή συνάρτηση** — η απάντηση υπάρχει στο πρώτο καρέ.
  //
  // ⚠️ **ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ ΙΚΑΝΟΤΗΤΑ (`admin_access`), ΟΧΙ ΤΑΒΑΝΙ.** Διαφέρει
  //    **σκόπιμα** από τον server guard του `/admin` (`ADMINISTRATIVE_ROLES`):
  //    εκεί κρίνεται *«ποιος βλέπει την επιφάνεια της πλατφόρμας;»*, εδώ *«τι
  //    μπορεί να κάνει αυτός ο άνθρωπος;»* για **λειτουργικές** οθόνες (ο
  //    προβολέας DXF, το CRM). Ένωσή τους θα ανέφερε άρνηση ικανότητας ως
  //    άρνηση πλατφόρμας (ADR-775).
  //
  // ⛔ **ΜΗΝ ξαναφέρεις εδώ email, `NEXT_PUBLIC_*`, ή λίστα ρόλων.**
  useEffect(() => {
    // 🏢 ENTERPRISE: Wait for Firebase auth to resolve
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (firebaseUser) {
      const decision = decideCapability({
        subject: {
          globalRole: firebaseUser.globalRole ?? null,
          permissions: firebaseUser.permissions ?? null,
        },
        action: 'admin_access',
      });

      // ⚠️ `isGranted`, ΠΟΤΕ `verdict === 'granted-…'`: οι ετυμηγορίες
      //    παραχώρησης είναι **τρεις** (bypass · permission · role) και ο
      //    έλεγχος μιας μόνο θα έκλεινε σιωπηλά έξω τον υπερδιαχειριστή.
      const role: User['role'] = isGranted(decision.verdict) ? 'admin' : 'authenticated';

      setUser({
        email: firebaseUser.email || '',
        role,
        isAuthenticated: true,
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
      });
      logger.info('[UserRoleContext] User role determined', {
        role,
        verdict: decision.verdict,
      });
    } else {
      // No Firebase user - clear user state
      setUser(null);
    }

    // 🏢 ENTERPRISE: Loading is false ONLY after all checks complete
    setIsLoading(false);
  }, [firebaseUser, authLoading]);

  // ==========================================================================
  // AUTH METHODS
  // ==========================================================================

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      logger.info('[UserRoleContext] Login attempt', { email });
      await signIn(email, password);
      return true;
    } catch (error) {
      logger.error('[UserRoleContext] Login failed', { error });
      return false;
    }
  };

  const signUp = async (data: SignUpData): Promise<boolean> => {
    try {
      logger.info('[UserRoleContext] Sign up attempt', { email: data.email });
      // 🏢 ENTERPRISE: Pass SignUpData directly to AuthContext
      await authSignUp(data);
      return true;
    } catch (error) {
      logger.error('[UserRoleContext] Sign up failed', { error });
      return false;
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      logger.info('[UserRoleContext] Password reset attempt', { email });
      await authResetPassword(email);
      return true;
    } catch (error) {
      logger.error('[UserRoleContext] Password reset failed', { error });
      return false;
    }
  };

  const logout = async () => {
    try {
      logger.info('[UserRoleContext] Logout');
      await signOut();
    } catch (error) {
      logger.error('[UserRoleContext] Logout failed', { error });
    }
  };

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const value = useMemo<UserRoleContextType>(() => ({
    user,
    isLoading,
    login,
    logout,
    signUp,
    resetPassword,
    isAdmin: user?.role === 'admin',
    isPublic: !user?.isAuthenticated,
    isAuthenticated: user?.isAuthenticated || false,
    firebaseUser: firebaseUser as FirebaseAuthUser | null
  }), [user, isLoading, firebaseUser]);

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Main hook for user role context
 */
export function useUserRole(): UserRoleContextType {
  const context = useContext(UserRoleContext);

  if (!context) {
    throw new Error(
      '🔴 useUserRole must be used within a UserRoleProvider. ' +
      'Wrap your component tree with <UserRoleProvider>.'
    );
  }

  return context;
}

/**
 * Hook to determine sidebar type based on role
 */
export function useSidebarType(): 'admin' | 'public' {
  const { isAdmin } = useUserRole();
  return isAdmin ? 'admin' : 'public';
}

/**
 * Hook to get Firebase user directly
 */
export function useFirebaseAuthUser(): FirebaseAuthUser | null {
  const { firebaseUser } = useUserRole();
  return firebaseUser;
}

// =============================================================================
// DEPRECATED - FOR BACKWARD COMPATIBILITY ONLY
// =============================================================================

/**
 * @deprecated Use useUserRole instead
 */
export function useLegacyAuth() {
  logger.warn('useLegacyAuth is deprecated. Use useUserRole instead.');
  return useUserRole();
}

export default UserRoleContext;
