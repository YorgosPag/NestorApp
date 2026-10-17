'use client';

/**
 * @fileoverview ADR-915 §27 — **οι πράξεις ανάθεσης έκδοσης από την οθόνη**: αισιόδοξα, σειριακά ανά (ακίνητο, είδος),
 *   με επαναφορά και λόγο σε αποτυχία.
 * @related components/document-registry/registry-issuance.ts (`withPendingIssuance` — ο ΙΔΙΟΣ μειωτής με τον διακομιστή) ·
 *   useSerialOptimistic.ts (ο κοινός μηχανισμός με τον ορισμό υπευθύνου, §26) · document-registry.client.ts
 * @module hooks/document-registry/useIssuanceAssignment
 *
 * 🔑 **Αισιόδοξα** (Gmail): η πράξη φαίνεται **αμέσως** (ο μειωτής πάνω στα τρέχοντα γεγονότα)· ο διακομιστής κρίνει ξανά
 *    με CAS (`expectedStage`) και το μητρώο ξαναδιαβάζεται χωρίς να σβήσει η σελίδα.
 * 🔑 **Αποτυχία ⇒ η γραμμή γυρίζει πίσω ΚΑΙ λέει γιατί** — `STALE` σημαίνει «άλλαξε στο μεταξύ», και το ξαναδιάβασμα
 *    δείχνει τι έγινε.
 */

import { useCallback, useMemo } from 'react';

import { withPendingIssuance } from '@/components/document-registry/registry-issuance';
import { ISSUANCE_ERROR_KEYS, ISSUANCE_REFUSAL_CODES } from '@/components/document-registry/issuance-labels';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import { issuanceKeyOf } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceAssignmentBody } from '@/lib/document-validity/issuance-request';
import { isOneOf } from '@/lib/type-guards';
import { useNotifications } from '@/providers/NotificationProvider';
import { saveIssuanceAction } from '@/services/document-registry/document-registry.client';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { useSerialOptimistic } from './useSerialOptimistic';

export interface IssuanceAssignmentApi {
  /** Το μητρώο **με** τις εκκρεμείς πράξεις ήδη ορατές. */
  readonly registry: DocumentRegistryResponse;
  readonly act: (request: IssuanceAssignmentBody) => void;
  /** Κλειδιά (`issuanceKeyOf`) με πράξη σε πτήση — η γραμμή λέει «Αποθηκεύεται…». */
  readonly pending: ReadonlySet<string>;
}

/** Κωδικός άρνησης → γραμμή του πίνακα μηνυμάτων (ποτέ κλειδί — CHECK 3.34 λύνει μόνο `t(ΠΙΝΑΚΑΣ[…])`). */
function errorRowOf(code: string | null): keyof typeof ISSUANCE_ERROR_KEYS {
  return isOneOf(ISSUANCE_REFUSAL_CODES, code) ? code : 'failed';
}

export function useIssuanceAssignment(registry: DocumentRegistryResponse, revalidate: () => Promise<void>): IssuanceAssignmentApi {
  const { t } = useTranslation([REGISTRY_NS]);
  const { error: notifyError } = useNotifications();
  const run = useCallback(async (_key: string, request: IssuanceAssignmentBody) => {
    const saved = await saveIssuanceAction(request);
    if (saved.kind === 'failed') notifyError(t(ISSUANCE_ERROR_KEYS[errorRowOf(saved.code)]));
    // Και στην αποτυχία: το `STALE` λέει «άλλαξε στο μεταξύ» — μόνο το ξαναδιάβασμα δείχνει τι.
    await revalidate();
  }, [notifyError, revalidate, t]);
  const { pending, submit } = useSerialOptimistic<IssuanceAssignmentBody>(run);
  const act = useCallback((request: IssuanceAssignmentBody) => submit(issuanceKeyOf(request.propertyId, request.documentKind), request), [submit]);

  const shown = useMemo(() => withPendingIssuance(registry, pending, nowISO()), [registry, pending]);
  const pendingKeys = useMemo(() => new Set(pending.keys()), [pending]);
  return { registry: shown, act, pending: pendingKeys };
}
