'use client';

/**
 * @fileoverview ADR-915 §26 — **ο ορισμός υπευθύνου από την οθόνη**: αισιόδοξα, χωρίς αγώνα, χωρίς «φορτώνει».
 * @related components/document-registry/registry-obligors.ts (`withPendingDesignations`) ·
 *   services/document-registry/document-registry.client.ts (`saveObligorDesignation`) · useDocumentRegistry.ts (`revalidate`)
 * @module hooks/document-registry/useObligorDesignation
 *
 * 🔑 **Αισιόδοξα** (Gmail): η επιλογή φαίνεται **αμέσως**· ο διακομιστής επιβεβαιώνει στο παρασκήνιο και το μητρώο
 *    ξαναδιαβάζεται χωρίς να σβήσει η σελίδα. Αποτυχία ⇒ η γραμμή γυρίζει πίσω **και** το λέει (μήνυμα με τον λόγο).
 * 🔑 **Χωρίς αγώνα**: οι αλλαγές του **ίδιου** ακινήτου στέλνονται **σειριακά** (αλυσίδα ανά ακίνητο) ⇒ η τελευταία
 *    επιλογή του ανθρώπου είναι και η τελευταία που γράφεται. Μόνο η **νεότερη** εκκρεμότητα σβήνει το overlay — μια
 *    παλιά απάντηση δεν «ξεκλειδώνει» νεότερη επιλογή.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

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

interface PendingDesignation {
  readonly seq: number;
  readonly contactId: string | null;
}

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
  const [pending, setPending] = useState<ReadonlyMap<string, PendingDesignation>>(new Map());
  const seq = useRef(0);
  const chains = useRef(new Map<string, Promise<void>>());

  const settle = useCallback((propertyId: string, mine: number) => {
    setPending((prev) => {
      if (prev.get(propertyId)?.seq !== mine) return prev;
      const next = new Map(prev);
      next.delete(propertyId);
      return next;
    });
  }, []);

  const designate = useCallback((propertyId: string, contactId: string | null) => {
    const mine = ++seq.current;
    setPending((prev) => new Map(prev).set(propertyId, { seq: mine, contactId }));
    const previous = chains.current.get(propertyId) ?? Promise.resolve();
    const run = previous.then(async () => {
      const saved = await saveObligorDesignation(propertyId, contactId);
      if (saved.kind === 'saved') await revalidate();
      else notifyError(t(LEAD_PICKER_ERROR_KEYS[errorRowOf(saved.code)]));
      settle(propertyId, mine);
    });
    chains.current.set(propertyId, run);
  }, [notifyError, revalidate, settle, t]);

  const shown = useMemo(
    () => withPendingDesignations(registry, new Map([...pending].map(([id, entry]) => [id, entry.contactId] as const))),
    [registry, pending],
  );
  const pendingIds = useMemo(() => new Set(pending.keys()), [pending]);
  return { registry: shown, designate, pending: pendingIds };
}
