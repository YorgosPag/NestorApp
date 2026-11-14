'use client';

/**
 * @fileoverview **Ο λογαριασμός πίσω από την επαφή** — ανάγνωση για την κεφαλίδα της επαφής (ADR-915 §40).
 * @module components/contacts/details/useContactProfessionalLink
 *
 * 🔑 **`undefined` = «δεν ξέρω»** (φόρτωση · αποτυχία · χωρίς δικαίωμα) ⇒ η κεφαλίδα **δεν δείχνει τίποτα**. Ποτέ
 *    ψεύτικο «μη συνδεδεμένος»: η απουσία σήματος δεν ισχυρίζεται τίποτα.
 * 🔒 Ρωτά τον κριτή **πριν** τον server (ADR-801, πρότυπο `useOwnerPropertyStats`): χωρίς `crm:contacts:view` κανένα αίτημα.
 */

import { useEffect, useState } from 'react';
import { useCapability } from '@/auth/hooks/useCapability';
import { isGranted } from '@/types/capability-authority';
import type { PermissionId } from '@/lib/auth/types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type { ContactProfessionalLink } from '@/types/contact-professional-link';

const logger = createModuleLogger('useContactProfessionalLink');

/** Η **ίδια** άδεια που απαιτεί η διαδρομή. */
const LINK_PERMISSION: PermissionId = 'crm:contacts:view';

export function useContactProfessionalLink(contactId: string): ContactProfessionalLink | undefined {
  const gate = useCapability(LINK_PERMISSION);
  const canView = !gate.pending && isGranted(gate.verdict);
  const [state, setState] = useState<{ readonly contactId: string; readonly link: ContactProfessionalLink } | undefined>();

  useEffect(() => {
    if (!canView || !contactId) return;
    let cancelled = false;
    apiClient
      .get<ContactProfessionalLink>(API_ROUTES.CONTACTS.PROFESSIONAL_LINK(contactId))
      .then((link) => {
        if (!cancelled) setState({ contactId, link });
      })
      .catch((err) => {
        logger.warn('Professional link unavailable — header shows nothing', { contactId, error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [canView, contactId]);

  // Αποτέλεσμα **άλλης** επαφής (πλοήγηση πριν απαντήσει το προηγούμενο αίτημα) ⇒ «δεν ξέρω».
  return state?.contactId === contactId ? state.link : undefined;
}
