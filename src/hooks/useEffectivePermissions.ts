'use client';

/**
 * ADR-748 Φάση 3 — Η **ΜΙΑ** πηγή για το «τι δικαιώματα βλέπει ο browser».
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (μετρημένο 2026-08-02): ο υπολογισμός ζούσε **inline μέσα στο
 * `app-sidebar.tsx`** (γρ. 33-46) και ήταν ο **μοναδικός** ζωντανός καλών του
 * `createNavigationConfig(...)`. Η Φάση 3 προσθέτει **δύο ακόμη** καταναλωτές
 * (το χειριστήριο δουλειάς και το dashboard) ⇒ χωρίς κεντρικοποίηση θα γεννιόταν
 * τριπλότυπο με τρεις ευκαιρίες να αποκλίνει (κανόνας N.0.2, Boy Scout).
 *
 * ⚠️ ΔΕΝ ΠΡΟΣΘΕΤΕΙ, ΔΕΝ ΑΦΑΙΡΕΙ, ΔΕΝ ΑΛΛΑΖΕΙ ΔΙΚΑΙΩΜΑ. Μεταφέρει **αυτούσια**
 * τη σημερινή συμπεριφορά και προσθέτει **μόνο** μια νέα πληροφορία: **ποιες
 * πηγές απάντησαν**. Οι Φάσεις 1-4 δεν αγγίζουν permissions/ρόλους/rules (§10).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΜΕΤΡΗΜΕΝΟ: ΤΡΕΙΣ ΠΗΓΕΣ, ΜΙΑ ΦΤΑΝΕΙ ΕΔΩ (Π-15)
 *
 * `api/admin/set-user-claims/claims-handler.ts:159-164` γράφει στα claims
 * **μόνο** `PREDEFINED_ROLES[globalRole].permissions + explicit + admin_access`.
 * Άρα ο `ProjectRole` (`/projects/{pid}/members/{uid}`) και τα `PermissionSets`
 * (`members/{uid}.permissionSetIds` — όπου ζει ΟΛΟ το νομικό) **δεν φτάνουν
 * ποτέ στον browser**. Το δηλώνουμε ρητά αντί να το σιωπήσουμε: το
 * `availableSources` είναι η **ειλικρίνεια του υπολογισμού**, και ο κανόνας
 * «το `unknown` δεν κρύβεται ποτέ» (jobs-access.ts) στηρίζεται σε αυτό.
 *
 * ⛔ ΜΗΝ «διορθώσεις» το κενό εδώ φέρνοντας project roles με ερώτημα Firestore:
 * θα ήταν I/O σε hook πλοήγησης που τρέχει σε **κάθε** σελίδα, και θα άλλαζε
 * ποιος βλέπει τι — δηλαδή ασφάλεια, που το §10 απαγορεύει ρητά σε αυτές τις
 * φάσεις. Η σωστή θέση είναι τα claims ή ένα ρητό context έργου (Φάση 4+).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @see docs/centralized-systems/reference/adrs/ADR-748-role-based-workspaces.md §9/Ε-5
 */

import { useMemo } from 'react';
import { useAuth } from '@/auth/contexts/AuthContext';
import { isRoleBypass } from '@/lib/auth/roles';
import type { JobAccessInput, PermissionSourceId } from '@/config/jobs-access';

/**
 * Οι πηγές που **όντως απαντούν** στον browser σήμερα.
 *
 * Είναι σταθερά, όχι υπολογισμός: αλλάζει μόνο αν αλλάξει τι μπαίνει στα claims
 * (`claims-handler.ts`) — και τότε πρέπει να αλλάξει **συνειδητά** εδώ, με νέα
 * μέτρηση. Γι' αυτό είναι ονομασμένη και σχολιασμένη αντί για inline literal.
 */
export const CLIENT_AVAILABLE_PERMISSION_SOURCES: readonly PermissionSourceId[] = [
  'globalRole',
] as const;

/**
 * Τα permissions που βλέπει ο browser, **ακριβώς** όπως τα υπολόγιζε το
 * `app-sidebar.tsx` πριν από τη Φάση 3 — μαζί με το ποιες πηγές απάντησαν.
 *
 * Το αποτέλεσμα είναι **έτοιμη είσοδος** για το `jobs-access.ts`: ένα σχήμα,
 * χωρίς προσαρμογή σε κάθε καταναλωτή.
 */
export interface EffectivePermissions extends JobAccessInput {
  /** Ο ίδιος πίνακας που περιμένει το `createNavigationConfig(...)`. */
  readonly permissions: readonly string[];
}

export function useEffectivePermissions(): EffectivePermissions {
  const { user } = useAuth();
  const claimPermissions = user?.permissions;
  const globalRole = user?.globalRole;

  return useMemo(() => {
    const permissions = claimPermissions ? [...claimPermissions] : [];

    // ΜΕΤΑΦΕΡΕΤΑΙ ΑΥΤΟΥΣΙΟ από το app-sidebar.tsx:37-43 (fallback για την
    // περίπτωση που τα custom claims δεν έχουν ακόμη γραφτεί).
    //
    // ⚠️ ΔΥΟ ΠΡΑΓΜΑΤΑ ΠΟΥ ΔΕΝ ΑΛΛΑΖΟΥΝ ΕΔΩ, ΕΠΙΤΗΔΕΣ:
    //
    // (1) Η παλιά μορφή έλεγχε ΚΑΙ `globalRole === 'admin'`. Το `'admin'` ΔΕΝ
    //     υπάρχει στα `GLOBAL_ROLES` (super_admin | company_admin |
    //     internal_user | external_user) — είναι το legacy λεξιλόγιο του
    //     `ProtectedRoute` (Π-2) που διαρρέει, δηλαδή **νεκρός** κλάδος. Ίδιο
    //     νεκρό μοτίβο και στο `ConditionalAppShell.tsx:133-139` ('agent',
    //     'sales', 'guest'). Δεν μεταφέρεται· καταγράφεται στο ADR (Π-17).
    //
    // (2) 🔴 Ο `company_admin` **ΔΕΝ** μπαίνει εδώ, όσο κι αν «φαίνεται
    //     ξεχασμένος»: το fallback του αρχικού κώδικα κάλυπτε **μόνο** τον
    //     `super_admin`. Προσθήκη του `company_admin` θα **έδινε** ορατότητα σε
    //     στοιχεία `admin_access` που σήμερα δεν δίνει — δηλαδή το φίλτρο θα
    //     πρόσθετε δικαίωμα, ακριβώς ο χρυσός κανόνας που το §5/Ε5.η
    //     απαγορεύει, και αλλαγή permissions που το §10 απαγορεύει στη Φάση 3.
    //     (Στην πράξη τα claims του το έχουν ήδη — claims-handler.ts:161.)
    if (globalRole === 'super_admin' && !permissions.includes('admin_access')) {
      permissions.push('admin_access');
    }

    return {
      permissions,
      // 🔴 roles.ts:55-62 → `super_admin: { permissions: [], isBypass: true }`.
      // Χωρίς αυτό ο υπερδιαχειριστής θα έβλεπε ΜΟΝΟ τη Διαχείριση.
      isBypass: globalRole !== undefined && isRoleBypass(globalRole),
      availableSources: CLIENT_AVAILABLE_PERMISSION_SOURCES,
    };
  }, [claimPermissions, globalRole]);
}
