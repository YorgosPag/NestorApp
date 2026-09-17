/**
 * useEntityFilesTabSession — ποιος ανεβάζει, για ποια εταιρεία, με ποιο όνομα
 *
 * Κάθε καρτέλα αρχείων (κτίριο · έργο · ακίνητο · χώρος) ξεκινούσε με τις ίδιες τρεις
 * ερωτήσεις γραμμένες με το χέρι: `useAuth()` → `uid`, `useCompanyId()` → εταιρεία, και
 * ένα αντιγραμμένο `useEffect` για το όνομα της εταιρείας — **χωρίς** φρουρό ακύρωσης,
 * δηλαδή γρήγορη εναλλαγή οντότητας μπορούσε να γράψει το όνομα της **προηγούμενης**.
 * Το CHECK 3.28 μέτρησε 27 δίδυμα όταν τα αρχεία στάλθηκαν μαζί (ADR-866 Φ0 βήμα 2β).
 *
 * Το όνομα λύνεται από το ΕΝΑ hook `useCompanyDisplayName` (με φρουρό ακύρωσης).
 *
 * @module components/shared/files/useEntityFilesTabSession
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useCompanyDisplayName } from '@/hooks/useCompanyDisplayName';

export interface EntityFilesTabSessionOptions {
  /**
   * Εταιρεία που έλυσε ο καλών (π.χ. `tryResolveCompanyId({ building, user })` για super_admin
   * σε ξένο μισθωτή). Αν το κλειδί **υπάρχει**, χρησιμοποιείται αυτούσιο — ακόμη κι αν είναι
   * `undefined` — και **δεν** πέφτει σιωπηλά στην εταιρεία της συνεδρίας.
   */
  readonly companyId?: string;
  /** Φέρε και το όνομα της εταιρείας (δέντρο τεχνικής προβολής, ADR-031). */
  readonly withCompanyName?: boolean;
}

export interface EntityFilesTabSession {
  readonly companyId: string | undefined;
  readonly currentUserId: string | undefined;
  readonly companyName: string | undefined;
}

export function useEntityFilesTabSession(
  options: EntityFilesTabSessionOptions = {},
): EntityFilesTabSession {
  const { user } = useAuth();
  const sessionCompanyId = useCompanyId()?.companyId;
  const companyId = 'companyId' in options ? options.companyId : sessionCompanyId;
  const companyName = useCompanyDisplayName(options.withCompanyName ? companyId : undefined);

  return { companyId, currentUserId: user?.uid, companyName };
}
