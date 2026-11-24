'use client';

/**
 * @fileoverview **Το οργανόγραμμα της σελίδας «Ρυθμίσεις Εταιρείας» — φορτώνεται ΜΟΝΟ όταν το ζητήσει καρτέλα**
 *   (ADR-ACC-018 §17.4).
 * @module components/settings/company/useOrgStructureSettings
 *
 * Πριν: η σελίδα φόρτωνε το οργανόγραμμα στο άνοιγμα και **όλες** οι καρτέλες (λογότυπο, φορολογικά, AI…) περίμεναν
 * πίσω από αυτό. Τώρα: `enabled` ⇒ μία ανάγνωση, **μία φορά** (η επιστροφή στη Δομή δεν ξαναδιαβάζει).
 *
 * 🔑 **Αποτυχία ανάγνωσης ≠ αποτυχία αποθήκευσης.** Αν η ανάγνωση αποτύχει, ο επεξεργαστής **δεν** δείχνεται: με
 *    `orgStructure: null` ένα «Αποθήκευση» θα έγραφε κενή δομή πάνω στην πραγματική. Η αποτυχία αποθήκευσης αφήνει
 *    τον επεξεργαστή ανοιχτό με ό,τι έγραφε ο άνθρωπος.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
// 🔑 ADR-787 §5.3 ζ (όριο 1) — ΕΝΑΣ δρόμος προς το API, άρα ΕΝΑΣ συγγραφέας της δήλωσης χώρου (το παλιό
//    χειροποίητο `getAuthHeaders` έγραφε μόνο του την κεφαλίδα και μόνο για super-admin).
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { OrgStructure } from '@/types/org/org-structure';

export type OrgStructureLoad = 'idle' | 'loading' | 'ready' | 'failed';

export interface OrgStructureSettings {
  readonly load: OrgStructureLoad;
  readonly orgStructure: OrgStructure | null;
  readonly saving: boolean;
  /** Ο λόγος της τελευταίας αποτυχίας (ανάγνωσης ή αποθήκευσης), όπως τον είπε ο διακομιστής. */
  readonly error: string | null;
  readonly save: (updated: OrgStructure) => Promise<void>;
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : 'error');

export function useOrgStructureSettings(enabled: boolean): OrgStructureSettings {
  const [load, setLoad] = useState<OrgStructureLoad>('idle');
  const [orgStructure, setOrgStructure] = useState<OrgStructure | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  // ⚠️ ΚΑΝΕΝΑΣ έλεγχος `if (!user) return;` εδώ (ADR-929 §1 εύρημα, 2026-11-05): την αναμονή ταυτότητας την
  //    κατέχει ο `apiClient` (`waitForAuthReady`)· ο αποσυνδεδεμένος παίρνει γρήγορο 401 → σφάλμα, όχι αιώνια φόρτωση.
  useEffect(() => {
    if (!enabled || requested.current) return;
    requested.current = true;
    setLoad('loading');
    apiClient
      .get<{ orgStructure: OrgStructure | null }>(API_ROUTES.ORG_STRUCTURE)
      .then((data) => {
        setOrgStructure(data.orgStructure);
        setLoad('ready');
      })
      .catch((err: unknown) => {
        setError(errorMessage(err));
        setLoad('failed');
      });
  }, [enabled]);

  const save = useCallback(async (updated: OrgStructure) => {
    setSaving(true);
    setError(null);
    try {
      // Ο `apiClient` διαβάζει το σώμα **μία** φορά (ADR-834 §6.5.ε) — ο παλιός κώδικας το διάβαζε δύο.
      const data = await apiClient.put<{ orgStructure: OrgStructure }>(API_ROUTES.ORG_STRUCTURE, updated);
      setOrgStructure(data.orgStructure);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }, []);

  return { load, orgStructure, saving, error, save };
}
