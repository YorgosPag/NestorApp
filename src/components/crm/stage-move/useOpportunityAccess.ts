'use client';

/**
 * @fileoverview **«Να του αφήσω να αγγίξει αυτή την κάρτα;»** — ο κριτής κατόχου στην οθόνη (ADR-930 §«Εξουσία κατόχου»).
 * @module components/crm/stage-move/useOpportunityAccess
 *
 * ⛔ **ΔΕΝ είναι κριτής** — δίνει στον ΙΔΙΟ κριτή του server (`services/crm/opportunity-access.ts`) την ταυτότητα του
 *    browser. Κάρτα που σέρνεται εδώ ⇔ μετακίνηση που δέχεται η πόρτα· καμία αισιόδοξη κίνηση που γυρίζει με 403.
 *    Ο server ρωτά ξανά, πάντα (OWASP: ο πελάτης ποτέ αποφασίζων).
 * 🔑 **`pending`**: όσο φορτώνει η ταυτότητα, η κάρτα απλώς δεν σέρνεται — **χωρίς** κλειδαριά. «Δεν κρίθηκε ακόμη» ≠
 *    «απαγορεύεται» (πρότυπο `useCapability`).
 */

import { useCallback, useMemo } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  decideOpportunityAccess,
  isOpportunityAccessGranted,
  opportunityOwnerOf,
  type OpportunityAccessDecision,
  type OpportunityAccessIntent,
} from '@/services/crm/opportunity-access';
import type { Opportunity } from '@/types/crm';

export interface OpportunityAccessGate {
  /** Η ταυτότητα δεν έχει φορτώσει — καμία ετυμηγορία ακόμη. */
  readonly pending: boolean;
  /** `null` όσο `pending`. */
  readonly decide: (opportunity: Opportunity, intent: OpportunityAccessIntent) => OpportunityAccessDecision | null;
  readonly allows: (opportunity: Opportunity, intent: OpportunityAccessIntent) => boolean;
}

export function useOpportunityAccess(): OpportunityAccessGate {
  const { user, loading } = useAuth();
  const subject = useMemo(() => (user ? { uid: user.uid, globalRole: user.globalRole, permissions: user.permissions, companyId: user.companyId } : null), [user]);
  const decide = useCallback((opportunity: Opportunity, intent: OpportunityAccessIntent) => (
    loading || !subject ? null : decideOpportunityAccess({ subject, opportunity, intent })
  ), [loading, subject]);
  const allows = useCallback((opportunity: Opportunity, intent: OpportunityAccessIntent) => {
    const decision = decide(opportunity, intent);
    return decision !== null && isOpportunityAccessGranted(decision.verdict);
  }, [decide]);
  return useMemo(() => ({ pending: loading || !subject, decide, allows }), [loading, subject, decide, allows]);
}

/**
 * Το κλειδί i18n του «γιατί όχι» — ΕΝΑ σημείο για κλειδαριά κάρτας, κουμπί επεξεργασίας και διαγραφής.
 * `null` ⇒ επιτρέπεται. Ξένη εταιρεία δεν ονομάζει πρόσωπο· η διαγραφή ονομάζει ρόλο, όχι τον ανατεθειμένο.
 */
export function accessDenialKey(decision: OpportunityAccessDecision | null, hasOwnerName: boolean):
  | 'pipeline.access.lockedBy' | 'pipeline.access.locked' | 'pipeline.access.foreign' | 'pipeline.access.deleteLocked' | null {
  if (!decision || isOpportunityAccessGranted(decision.verdict)) return null;
  if (decision.verdict === 'denied-foreign-tenant') return 'pipeline.access.foreign';
  if (decision.intent === 'delete') return 'pipeline.access.deleteLocked';
  return hasOwnerName ? 'pipeline.access.lockedBy' : 'pipeline.access.locked';
}

/** Ο λόγος κλειδώματος ανά πρόθεση, ως κείμενο — `null` ⇒ επιτρέπεται (ή εκκρεμεί η ταυτότητα). */
export interface OpportunityLocks {
  readonly edit: string | null;
  readonly delete: string | null;
}

/**
 * Οι κλειδαριές ενός ολόκληρου πίνακα: **μία** επίλυση ονομάτων κατόχων για όλες τις κάρτες (`useUserDisplayNames`,
 * κοινή μνήμη συνεδρίας), όχι μία ανάγνωση ανά κάρτα.
 */
export function useOpportunityLocks(opportunities: readonly Opportunity[], access: OpportunityAccessGate): (opportunity: Opportunity) => OpportunityLocks {
  const { t } = useTranslation('crm');
  const ownerKey = useMemo(
    () => [...new Set(opportunities.map(opportunityOwnerOf).filter((uid): uid is string => uid !== null))].sort().join(' '),
    [opportunities],
  );
  const ownerUids = useMemo(() => (ownerKey ? ownerKey.split(' ') : []), [ownerKey]);
  const names = useUserDisplayNames(ownerUids);
  return useCallback((opportunity: Opportunity) => {
    const reason = (intent: OpportunityAccessIntent) => {
      const decision = access.decide(opportunity, intent);
      const owner = decision?.ownerUid ? names.get(decision.ownerUid) ?? '' : '';
      const key = accessDenialKey(decision, owner !== '');
      return key ? t(key, { owner }) : null;
    };
    return { edit: reason('edit'), delete: reason('delete') };
  }, [access, names, t]);
}
