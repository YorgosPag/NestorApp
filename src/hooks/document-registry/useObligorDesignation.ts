'use client';

/**
 * @fileoverview ADR-915 §26 — **ο ορισμός υπευθύνου από την οθόνη**: αισιόδοξα, χωρίς αγώνα, χωρίς «φορτώνει».
 * @related components/document-registry/registry-obligors.ts (`withPendingDesignations`) ·
 *   services/document-registry/document-registry.client.ts (`saveObligorDesignation`) · useDocumentRegistry.ts (`revalidate`)
 * @module hooks/document-registry/useObligorDesignation
 *
 * 🔑 **Αισιόδοξα** (Gmail): η επιλογή φαίνεται **αμέσως**· ο διακομιστής επιβεβαιώνει στο παρασκήνιο και το μητρώο
 *    ξαναδιαβάζεται χωρίς να σβήσει η σελίδα. Αποτυχία ⇒ η γραμμή γυρίζει πίσω **και** το λέει (μήνυμα με τον λόγο).
 * 🔑 **Χωρίς αγώνα**: οι αλλαγές του **ίδιου** ακινήτου στέλνονται **σειριακά** — ο κοινός μηχανισμός
 *    `useSerialOptimistic` (§27 Boy Scout: ο ίδιος κρατά και την ανάθεση έκδοσης).
 */

import { useCallback, useMemo } from 'react';

import { withPendingDesignations } from '@/components/document-registry/registry-obligors';
import {
  LEAD_PICKER_ERROR_KEYS,
  LEAD_PICKER_REFUSAL_CODES,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isOneOf } from '@/lib/type-guards';
import { useNotifications } from '@/providers/NotificationProvider';
import { saveObligorDesignation } from '@/services/document-registry/document-registry.client';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { useSerialOptimistic } from './useSerialOptimistic';

export interface ObligorDesignationApi {
  /** Το μητρώο **με** τις εκκρεμείς επιλογές ήδη ορατές. */
  readonly registry: DocumentRegistryResponse;
  readonly designate: (propertyId: string, contactId: string | null) => void;
  /** Ακίνητα με αλλαγή σε πτήση — η γραμμή λέει «Αποθηκεύεται…». */
  readonly pending: ReadonlySet<string>;
}

/**
 * Ο κωδικός άρνησης του διακομιστή → η γραμμή του πίνακα μηνυμάτων· δίκτυο ή άγνωστος κωδικός ⇒ «δεν αποθηκεύτηκε».
 * ⚠️ Επιστρέφει **γραμμή**, όχι κλειδί: η κλήση μένει `t(LEAD_PICKER_ERROR_KEYS[…])`, που ο τεμαχιστής του CHECK 3.34 λύνει.
 */
function errorRowOf(code: string | null): keyof typeof LEAD_PICKER_ERROR_KEYS {
  return isOneOf(LEAD_PICKER_REFUSAL_CODES, code) ? code : 'failed';
}

export function useObligorDesignation(registry: DocumentRegistryResponse, revalidate: () => Promise<void>): ObligorDesignationApi {
  const { t } = useTranslation([REGISTRY_NS]);
  const { error: notifyError } = useNotifications();
  const run = useCallback(async (propertyId: string, contactId: string | null) => {
    const saved = await saveObligorDesignation(propertyId, contactId);
    if (saved.kind === 'saved') await revalidate();
    else notifyError(t(LEAD_PICKER_ERROR_KEYS[errorRowOf(saved.code)]));
  }, [notifyError, revalidate, t]);
  const { pending, submit } = useSerialOptimistic<string | null>(run);

  const shown = useMemo(() => withPendingDesignations(registry, pending), [registry, pending]);
  const pendingIds = useMemo(() => new Set(pending.keys()), [pending]);
  return { registry: shown, designate: submit, pending: pendingIds };
}
