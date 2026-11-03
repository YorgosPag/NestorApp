'use client';

/**
 * **Τι επιτρέπεται στον θεατή** πάνω στα συμφωνητικά υπεργολαβίας ενός έργου (ADR-928 §5.15 · Φ3α-2) — για να κρύβει ή
 * να ενεργοποιεί κουμπιά. **Κρύβει, δεν προστατεύει** (ADR-801 PEP): κάθε διαδρομή ξανακρίνει.
 *
 * 🔑 Δύο πηγές, καμία νέα κρίση:
 *   - **Εταιρεία**: `useCapabilities` πάνω στον ΕΝΑ πίνακα `SUBCONTRACT_AUTHORITY_PERMISSIONS` (κοινός με τον διακομιστή).
 *   - **Έργο**: `useProjectCapabilities` (ADR-926 Κ7) — ο διακομιστής απαντά για τις πράξεις του `PROJECT_SCOPED_ACTIONS`,
 *     μαζί και ό,τι δίνει η εταιρεία· ο πελάτης δεν ξέρει την ιδιότητα μέλους και δεν ξαναγράφει τον κριτή.
 * 🔑 Ποιος πόρος για ποιο έγγραφο — **ο ίδιος** κανόνας με το `agreement-resource.server.ts`:
 *   `single_project` **αυτού** του έργου ⇒ δικαίωμα έργου · κάθε άλλο (κύρια σύμβαση, άλλο έργο) ⇒ μόνο εταιρεία.
 *   Εντολή εργασίας ⇒ το έργο-στόχος (αυτό το έργο). Έγκριση απόκλισης ⇒ μόνο εταιρεία.
 * 🔑 Fail-closed: όσο εκκρεμεί η ταυτότητα ή η απάντηση του διακομιστή ⇒ `false` — ποτέ κουμπί πριν την κρίση.
 * @module hooks/procurement/subcontracts/useSubcontractAuthority
 */

import { useCallback, useMemo } from 'react';
import { useCapabilities, type CapabilityGate } from '@/auth/hooks/useCapability';
import { useProjectCapabilities } from '@/hooks/useProjectCapabilities';
import { isGranted } from '@/types/capability-authority';
import type { PermissionId } from '@/lib/auth/types';
import {
  SUBCONTRACT_AUTHORITY_PERMISSIONS,
  type SubcontractAuthority,
} from '@/subapps/procurement/subcontracts/vocabulary/subcontract-authorities';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';

/** Οι δικαιοδοσίες που κρίνει αυτή η οθόνη, στη σειρά του πίνακα. */
const SCREEN_AUTHORITIES = ['agreements', 'assign', 'approveDeviation'] as const satisfies readonly SubcontractAuthority[];

const COMPANY_PERMISSIONS: readonly PermissionId[] = SCREEN_AUTHORITIES.flatMap((authority) => SUBCONTRACT_AUTHORITY_PERMISSIONS[authority]);

type Gates = Readonly<Record<PermissionId, CapabilityGate>>;

/** Μια δικαιοδοσία ισχύει όταν **όλα** τα δικαιώματά της δόθηκαν (π.χ. η `seed` θέλει δύο). */
function companyGrants(gates: Gates, authority: SubcontractAuthority): boolean {
  return SUBCONTRACT_AUTHORITY_PERMISSIONS[authority].every((permission) => {
    const gate = gates[permission];
    return gate !== undefined && !gate.pending && isGranted(gate.verdict);
  });
}

export interface SubcontractAuthorityView {
  /** Πρόχειρο · μεταβάσεις κύκλου ζωής **αυτού** του εγγράφου. */
  readonly canManage: (agreement: Pick<SubcontractAgreement, 'scope'>) => boolean;
  /** Νέο συμφωνητικό `single_project` σε αυτό το έργο. */
  readonly canCreateForProject: boolean;
  /** Νέα κύρια σύμβαση (`multi_project`) — μόνο εταιρεία. */
  readonly canCreateMaster: boolean;
  /** Εντολή εργασίας προς αυτό το έργο. */
  readonly canAssign: boolean;
  /** Απόφαση απόκλισης — μόνο εταιρεία. */
  readonly canApproveDeviation: boolean;
}

export function useSubcontractAuthority(projectId: string): SubcontractAuthorityView {
  const gates = useCapabilities(COMPANY_PERMISSIONS);
  const projectCapabilities = useProjectCapabilities(projectId);

  const company = useMemo(
    () => ({
      manage: companyGrants(gates, 'agreements'),
      approveDeviation: companyGrants(gates, 'approveDeviation'),
    }),
    [gates],
  );
  const projectManage = projectCapabilities?.['subcontracts:agreements:manage'] === true;
  const projectAssign = projectCapabilities?.['subcontracts:agreements:assign'] === true;

  const canManage = useCallback(
    ({ scope }: Pick<SubcontractAgreement, 'scope'>) =>
      scope.kind === 'single_project' && scope.project.projectId === projectId ? projectManage : company.manage,
    [projectId, projectManage, company.manage],
  );

  return useMemo(
    () => ({
      canManage,
      canCreateForProject: projectManage,
      canCreateMaster: company.manage,
      canAssign: projectAssign,
      canApproveDeviation: company.approveDeviation,
    }),
    [canManage, projectManage, projectAssign, company],
  );
}
