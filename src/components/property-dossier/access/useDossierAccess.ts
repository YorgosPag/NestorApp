'use client';

/**
 * @fileoverview **Η κάρτα «Πρόσβαση» του κατόχου — η κατάσταση και οι πράξεις της** (ADR-916 Φ-Ε1 Σ4).
 * @module components/property-dossier/access/useDossierAccess
 * @related `hooks/useSlotActions.ts` (η ΜΙΑ μηχανή θέσεων — κοινή με τους επαγγελματίες της μεταβίβασης) ·
 *          `services/property-dossier/dossier-access.client.ts` (οι πόρτες)
 *
 * 🔑 **Η αλήθεια είναι ο server**: κάθε πράξη επιστρέφει **όλες** τις θέσεις· τα αρχεία έρχονται μόνο στην ανάγνωση και
 *    **κρατιούνται** (οι πράξεις δεν αλλάζουν αρχεία). Ανά ρόλο «σε εξέλιξη»: δύο κλικ ⇒ ένα αίτημα.
 * 🔑 Αρνήσεις **ονομασμένες** (`dossierAccessRejectionOf`) — η οθόνη λέει τι να κάνει ο άνθρωπος.
 */

import { useCallback } from 'react';

import type { DossierEngagementChangeRequest, DossierInvitationRequest } from '@/lib/property-dossier/dossier-access-request-schema';
import { useSlotActions } from '@/hooks/useSlotActions';
import {
  cancelDossierInvitationRequest,
  changeDossierEngagementRequest,
  dossierAccessRejectionOf,
  fetchDossierAccess,
  inviteToDossierRequest,
  type DossierAccessRejection,
} from '@/services/property-dossier/dossier-access.client';
import type { DossierAccessResponse, DossierAccessSlot } from '@/types/dossier-access';
import type { DossierEngagementRole } from '@/types/engagement';
import type { EngagedDossierFile } from '@/types/my-engagements';

/** Η έκβαση της αποστολής του email — ο τύπος της πόρτας, ποτέ δεύτερο λεξιλόγιο. */
type InvitationDelivery = NonNullable<DossierAccessResponse['invited']>;

export type DossierAccessOutcome =
  /** `invited` — μόνο στην πρόσκληση: η έκβαση της **αποστολής** του email, ονομασμένη. */
  | { readonly ok: true; readonly invited: InvitationDelivery | null }
  | { readonly ok: false; readonly rejection: DossierAccessRejection };

interface DossierAccessView {
  readonly slots: readonly DossierAccessSlot[];
  readonly files: readonly EngagedDossierFile[];
}

export interface DossierAccessControls {
  readonly slots: readonly DossierAccessSlot[];
  /** Τα αρχεία του φακέλου με την καρτέλα τους — για την προεπισκόπηση και τις εξαιρέσεις. */
  readonly files: readonly EngagedDossierFile[];
  readonly loading: boolean;
  readonly failed: boolean;
  readonly pending: ReadonlySet<DossierEngagementRole>;
  readonly invite: (request: DossierInvitationRequest) => Promise<DossierAccessOutcome>;
  readonly cancelInvitation: (role: DossierEngagementRole, invitationId: string) => Promise<DossierAccessOutcome>;
  readonly change: (role: DossierEngagementRole, engagementId: string, change: DossierEngagementChangeRequest) => Promise<DossierAccessOutcome>;
}

const EMPTY: DossierAccessView = { slots: [], files: [] };

/** Η απάντηση πράξης → νέα όψη: νέες θέσεις, **ίδια** αρχεία (οι πράξεις δεν τα αλλάζουν). */
function withSlots(previous: DossierAccessView | null, result: DossierAccessResponse): DossierAccessView {
  return { slots: result.slots, files: result.files ?? previous?.files ?? [] };
}

export function useDossierAccess(dossierId: string): DossierAccessControls {
  const load = useCallback(
    () => fetchDossierAccess(dossierId).then((result) => ({ slots: result.slots, files: result.files ?? [] })),
    [dossierId],
  );
  const { view, loading, failed, pending, act } = useSlotActions<DossierAccessView, DossierEngagementRole>(load, dossierId, 0);

  const run = useCallback(
    async (role: DossierEngagementRole, request: () => Promise<DossierAccessResponse>): Promise<DossierAccessOutcome> => {
      const outcome = await act(role, request, withSlots);
      if (!outcome.ok) return { ok: false, rejection: dossierAccessRejectionOf(outcome.error) };
      return { ok: true, invited: outcome.result?.invited ?? null };
    },
    [act],
  );

  const invite = useCallback(
    (request: DossierInvitationRequest) => run(request.role, () => inviteToDossierRequest(dossierId, request)),
    [run, dossierId],
  );
  const cancelInvitation = useCallback(
    (role: DossierEngagementRole, invitationId: string) => run(role, () => cancelDossierInvitationRequest(dossierId, invitationId)),
    [run, dossierId],
  );
  const change = useCallback(
    (role: DossierEngagementRole, engagementId: string, request: DossierEngagementChangeRequest) =>
      run(role, () => changeDossierEngagementRequest(dossierId, engagementId, request)),
    [run, dossierId],
  );

  const current = view ?? EMPTY;
  return { slots: current.slots, files: current.files, loading, failed, pending, invite, cancelInvitation, change };
}
