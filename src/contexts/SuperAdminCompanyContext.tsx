'use client';

/**
 * Super Admin Company Context — ADR-340 · ADR-354 · ADR-849 Β1
 *
 * Provides the active company for super admin users who operate across
 * multiple tenants. Regular users never interact with this context.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΕΤΑΙΡΕΙΑ ΤΗΣ ΟΘΟΝΗΣ ΠΑΡΑΓΕΤΑΙ — ΔΕΝ ΑΠΟΘΗΚΕΥΕΤΑΙ (ADR-849 Β1)
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι το Β1 το `activeCompanyId` ήταν React state από `localStorage`, και ένα effect το
 * «έσπρωχνε» στους μεταφορείς (κεφαλίδα HTTP · μητρώο Firestore). Αποτέλεσμα, μετρημένο
 * ζωντανά: η διεύθυνση έλεγε `/o/<ΠΑΓΩΝΗΣ>/…`, ο επιλογέας έλεγε «Αποχετευτικά Έργα Ροή»,
 * και η σελίδα φόρτωνε δεδομένα **του επιλογέα** — ένα email προς ακίνητο που υπάρχει
 * έδειξε «δεν βρέθηκε».
 *
 * Τώρα:
 * - **Η εταιρεία της οθόνης = η εταιρεία της διεύθυνσης** όταν υπάρχει (`/o/<εταιρεία>`),
 *   αλλιώς η επιλογή (σελίδες διαχείρισης, εκτός `/o/`). Παράγεται από το **ίδιο**
 *   `requestedWorkspace` που ρωτούν το Firestore και η κεφαλίδα — **μία** απάντηση.
 * - Το `localStorage` είναι η **«τελευταία εταιρεία»**: προσγείωση εκτός `/o/`, όπως ο
 *   τελευταίος χώρος στο Slack/Linear — ποτέ υπερισχύει ρητής διεύθυνσης.
 * - Ο επιλογέας **πλοηγεί** μέσα σε `/o/` (`CompanySwitcher`).
 *
 * Pattern: Linear / Vercel / Slack — ο οργανισμός ζει στη διεύθυνση.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/auth/contexts/AuthContext';
import { isRoleBypass } from '@/lib/auth/roles';
import {
  getClientWorkspaceScope,
  onSuperAdminActiveCompanyChange,
  requestedCompanyId,
  setSuperAdminActiveCompanyId,
} from '@/services/firestore/super-admin-active-company';
import { createModuleLogger } from '@/lib/telemetry';
import type { CompanyDocument } from '@/types/company';

const logger = createModuleLogger('SuperAdminCompanyContext');

/** Η «τελευταία εταιρεία» του super-admin — προσγείωση εκτός `/o/`. */
const STORAGE_KEY = 'super_admin_active_company_id';

// 🔑 **Η ΚΕΦΑΛΙΔΑ HTTP ΔΕΝ ΤΡΟΦΟΔΟΤΕΙΤΑΙ ΠΙΑ ΑΠΟ ΕΔΩ** (ADR-849 Β1): τη ρωτά το ίδιο το
//    store (`lib/api/company-scope-source`). Το παλιό effect εδώ έτρεχε **μετά** τα effects
//    των παιδιών, και κρατούσε αντίγραφο που έμενε πίσω από τη διεύθυνση.

// ============================================================================
// TYPES
// ============================================================================

interface SuperAdminCompanyContextValue {
  isSuperAdmin: boolean;
  /** Η εταιρεία **της οθόνης** — βλ. κεφαλίδα. `null` στον ιδιωτικό χώρο ή χωρίς επιλογή. */
  activeCompanyId: string | null;
  companies: Pick<CompanyDocument, 'id' | 'name'>[];
  loading: boolean;
  /** Αλλάζει την επιλογή **εκτός `/o/`**. Μέσα σε χώρο ο επιλογέας πλοηγεί. */
  setActiveCompanyId: (id: string) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const SuperAdminCompanyContext = createContext<SuperAdminCompanyContextValue>({
  isSuperAdmin: false,
  activeCompanyId: null,
  companies: [],
  loading: false,
  setActiveCompanyId: () => undefined,
});

/** Κράτα την εταιρεία ως «τελευταία» — επιλογή εκτός `/o/` και μνήμη για την επόμενη προσγείωση. */
function rememberCompany(id: string): void {
  setSuperAdminActiveCompanyId(id);
  localStorage.setItem(STORAGE_KEY, id);
}

// ============================================================================
// PROVIDER
// ============================================================================

export function SuperAdminCompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.globalRole && isRoleBypass(user.globalRole));
  const scope = useSyncExternalStore(
    onSuperAdminActiveCompanyChange,
    getClientWorkspaceScope,
    getClientWorkspaceScope,
  );

  const [companies, setCompanies] = useState<Pick<CompanyDocument, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(false);

  const activeCompanyId = isSuperAdmin ? requestedCompanyId(scope) : null;
  const urlCompanyId = scope.url?.kind === 'org' ? scope.url.companyId : null;

  // Η «τελευταία εταιρεία» γίνεται η επιλογή — ΜΟΝΟ για super-admin. Για κάθε άλλον ο
  // επιλογέας καθαρίζεται ρητά (και το `requireAuthContext` τον κόβει ξανά, αμυντικά).
  useEffect(() => {
    setSuperAdminActiveCompanyId(isSuperAdmin ? localStorage.getItem(STORAGE_KEY) : null);
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin || !db) return;
    setLoading(true);
    const q = query(collection(db, 'companies'), orderBy('name'));
    getDocs(q)
      .then(snap => {
        const list = snap.docs.map(d => ({
          id: d.id,
          name: (d.data() as { name?: string }).name ?? d.id,
        }));
        setCompanies(list);
        // Auto-select first company if nothing persisted
        if (getClientWorkspaceScope().switcher === null && list.length > 0) {
          rememberCompany(list[0].id);
        }
      })
      .catch(err => logger.error('Failed to load companies', { error: err }))
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  // Ο χώρος της διεύθυνσης γίνεται η «τελευταία εταιρεία»: έξοδος προς σελίδα διαχείρισης
  // ή νέα σύνδεση προσγειώνεται εκεί που ήταν ο άνθρωπος — όχι σε μια παλιά επιλογή.
  useEffect(() => {
    if (isSuperAdmin && urlCompanyId) rememberCompany(urlCompanyId);
  }, [isSuperAdmin, urlCompanyId]);

  // `users/{uid}.activeCompanyId` — η δρομολόγηση του Telegram bot (ADR-145 Option B).
  // Ο διακομιστής το διαβάζει ΜΟΝΟ μέσω `resolveVerifiedActiveWorkspace` (ADR-787 §5.2 στ).
  useEffect(() => {
    if (isSuperAdmin && activeCompanyId && user?.uid && db) {
      setDoc(doc(db, 'users', user.uid), { activeCompanyId }, { merge: true })
        .catch(err => logger.warn('Failed to persist activeCompanyId to Firestore', { error: err }));
    }
  }, [isSuperAdmin, activeCompanyId, user?.uid]);

  const setActiveCompanyId = useCallback((id: string) => rememberCompany(id), []);

  const value = useMemo(
    () => ({ isSuperAdmin, activeCompanyId, companies, loading, setActiveCompanyId }),
    [isSuperAdmin, activeCompanyId, companies, loading, setActiveCompanyId],
  );

  return (
    <SuperAdminCompanyContext.Provider value={value}>
      {children}
    </SuperAdminCompanyContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSuperAdminCompany(): SuperAdminCompanyContextValue {
  return useContext(SuperAdminCompanyContext);
}
