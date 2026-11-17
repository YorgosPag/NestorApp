'use client';

/**
 * ADR-901 Φ2 — οι θέσεις επαγγελματιών μιας υπόθεσης, από την πλευρά του **οικοδεσπότη**.
 *
 * - Η αλήθεια είναι ο server: κάθε πράξη επιστρέφει τις **νέες** θέσεις (καμία δεύτερη παραγωγή στον client —
 *   ο ορισμός, ο λογαριασμός και η συναίνεση κρίνονται μόνο εκεί).
 * - **Ανά θέση** κατάσταση «σε εξέλιξη» και προστασία από μπαγιάτικη ανάγνωση: η ΜΙΑ μηχανή `useSlotActions`
 *   (κοινή με την πρόσβαση του φακέλου ιδιώτη, ADR-916 Φ-Ε1).
 * - Αρνήσεις **ονομασμένες** (`offerRejectionOf`) — η οθόνη λέει τι να κάνει ο άνθρωπος, όχι «απέτυχε».
 * - ADR-901 Φ3: η ίδια `offer` στέλνει **πρόσκληση με email** όταν δεν υπάρχει λογαριασμός (και ξανά = επαναποστολή)·
 *   η έκβαση της **αποστολής** (`invited`) επιστρέφει ονομασμένη — «δεν στάλθηκε» δεν είναι σιωπή.
 * - ADR-901 §14.8: **ζωντανές** — όταν η αναθεώρηση της όψης του οικοδεσπότη (`viewRevision`) ανέβει, οι θέσεις
 *   ξαναδιαβάζονται **στο παρασκήνιο** (χωρίς spinner).
 *
 * @module hooks/useCaseProfessionals
 */

import { useCallback } from 'react';
import {
  fetchCaseProfessionalSlots,
  offerCaseEngagementRequest,
  offerRejectionOf,
  revokeCaseEngagementRequest,
  revokeCaseInvitationRequest,
  type InvitationDelivery,
  type OfferRejection,
} from '@/services/conveyance/conveyance-engagement-gateway';
import type { CaseProfessionalSlot } from '@/types/conveyance-case';
import type { ConsentBasis } from '@/types/engagement';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import { useSlotActions } from './useSlotActions';

export type ProfessionalActionOutcome =
  /** `invited` — μόνο όταν η πράξη έστειλε πρόσκληση με email. */
  | { readonly ok: true; readonly invited: InvitationDelivery | null }
  | { readonly ok: false; readonly rejection: OfferRejection | 'generic' };

interface UseCaseProfessionalsReturn {
  readonly slots: readonly CaseProfessionalSlot[];
  readonly loading: boolean;
  readonly failed: boolean;
  /** Θέσεις με πράξη σε εξέλιξη. */
  readonly pending: ReadonlySet<LegalProfessionalRole>;
  readonly offer: (role: LegalProfessionalRole, basis: ConsentBasis | null) => Promise<ProfessionalActionOutcome>;
  readonly end: (role: LegalProfessionalRole, engagementId: string) => Promise<ProfessionalActionOutcome>;
  readonly cancelInvitation: (role: LegalProfessionalRole) => Promise<ProfessionalActionOutcome>;
}

type SlotsResponse = { readonly slots: readonly CaseProfessionalSlot[]; readonly invited?: InvitationDelivery | null };

const NO_SLOTS: readonly CaseProfessionalSlot[] = [];

export function useCaseProfessionals(caseId: string, viewRevision: number): UseCaseProfessionalsReturn {
  const load = useCallback(() => fetchCaseProfessionalSlots(caseId).then((result) => result.slots), [caseId]);
  const { view, loading, failed, pending, act } = useSlotActions<readonly CaseProfessionalSlot[], LegalProfessionalRole>(load, caseId, viewRevision);

  const run = useCallback(async (role: LegalProfessionalRole, request: () => Promise<SlotsResponse>): Promise<ProfessionalActionOutcome> => {
    const outcome = await act(role, request, (_previous, result) => result.slots);
    if (!outcome.ok) return { ok: false, rejection: offerRejectionOf(outcome.error) ?? 'generic' };
    return { ok: true, invited: outcome.result?.invited ?? null };
  }, [act]);

  const offer = useCallback(
    (role: LegalProfessionalRole, basis: ConsentBasis | null) => run(role, () => offerCaseEngagementRequest(caseId, role, basis)),
    [run, caseId],
  );
  const end = useCallback(
    (role: LegalProfessionalRole, engagementId: string) => run(role, () => revokeCaseEngagementRequest(caseId, engagementId)),
    [run, caseId],
  );
  const cancelInvitation = useCallback(
    (role: LegalProfessionalRole) => run(role, () => revokeCaseInvitationRequest(caseId, role)),
    [run, caseId],
  );

  return { slots: view ?? NO_SLOTS, loading, failed, pending, offer, end, cancelInvitation };
}
