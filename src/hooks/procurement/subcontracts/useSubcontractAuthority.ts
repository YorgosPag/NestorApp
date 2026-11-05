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
import { useAuth } from '@/hooks/useAuth';
import { useProjectCapabilities } from '@/hooks/useProjectCapabilities';
import { isGranted } from '@/types/capability-authority';
import type { PermissionId } from '@/lib/auth/types';
import {
  SUBCONTRACT_AUTHORITY_PERMISSIONS,
  type SubcontractAuthority,
} from '@/subapps/procurement/subcontracts/vocabulary/subcontract-authorities';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import type { WorkOrderTargetVerdict } from '@/subapps/procurement/subcontracts/agreements/work-orders';

/** Οι δικαιοδοσίες που κρίνει η οθόνη συμφωνητικών, στη σειρά του πίνακα. */
const SCREEN_AUTHORITIES = ['agreements', 'assign', 'approveDeviation'] as const satisfies readonly SubcontractAuthority[];

/** Οι δικαιοδοσίες της βιβλιοθήκης — **εταιρικές**, όχι έργου (§5.13 απόφαση 8). */
const LIBRARY_AUTHORITIES = ['propose', 'manage', 'templates', 'seed'] as const satisfies readonly SubcontractAuthority[];

const permissionsOf = (authorities: readonly SubcontractAuthority[]): readonly PermissionId[] => [
  ...new Set(authorities.flatMap((authority) => SUBCONTRACT_AUTHORITY_PERMISSIONS[authority])),
];

const COMPANY_PERMISSIONS = permissionsOf(SCREEN_AUTHORITIES);
const LIBRARY_PERMISSIONS = permissionsOf(LIBRARY_AUTHORITIES);

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

/**
 * `projectId`: το έργο του πλαισίου πλοήγησης· `null` στις σελίδες της **εταιρείας** (κύριες συμβάσεις, §5.24) ⇒ κάθε
 * κρίση πέφτει στην εταιρεία, κανένα δικαίωμα έργου δεν «δανείζεται».
 */
export function useSubcontractAuthority(projectId: string | null): SubcontractAuthorityView {
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

/**
 * Εντολή εργασίας προς το έργο-**στόχο** (ADR-928 §5.15 · §5.24) — **όχι** το έργο της σελίδας: ο υπεύθυνος του έργου Α
 * δεν δίνει εντολή στο Β. Ίδια πηγή με τον διακομιστή (`useProjectCapabilities`, ADR-926 Κ7): ο πόρος της διαδρομής
 * είναι το `projectId` του σώματος (`projectOfAssignmentTarget`). Χωρίς στόχο ή χωρίς απάντηση ⇒ `pending` (fail-closed).
 */
export function useWorkOrderTargetAuthority(targetProjectId: string | null): WorkOrderTargetVerdict {
  const capabilities = useProjectCapabilities(targetProjectId);
  if (!targetProjectId || capabilities === null) return 'pending';
  return capabilities['subcontracts:agreements:assign'] === true ? 'granted' : 'denied';
}

export interface SubcontractLibraryAuthorityView {
  /** Ο θεατής — για τη διάκριση καθηκόντων (`library-action-blocks`). `''` όσο δεν έχει φορτώσει. */
  readonly actorUid: string;
  /** Νέα ρήτρα/έκδοση · μετάφραση · απόσυρση **δικής μου** πρότασης. */
  readonly canPropose: boolean;
  /** Έγκριση · απόρριψη · νομικός έλεγχος · αρχειοθέτηση ρήτρας. */
  readonly canManageClauses: boolean;
  /** Πρότυπα ειδικότητας. */
  readonly canManageTemplates: boolean;
  /** Σπορά της προτεινόμενης βιβλιοθήκης — θέλει **και** ρήτρες **και** πρότυπα. */
  readonly canSeed: boolean;
  /**
   * Η κρίση **δεν ήρθε ακόμη** (ταυτότητα ή κάποια πύλη σε αναμονή). Τα `can*` είναι ήδη `false` (fail-closed)· αυτό λέει
   * στην οθόνη να **μη** γράψει «δεν έχεις δικαίωμα» — ήταν ψευδές για 1–5″ σε κάθε φόρτωση (ADR-928 §5.20 απόφαση 9).
   */
  readonly pending: boolean;
}

/**
 * Τι επιτρέπεται στον θεατή πάνω στη **βιβλιοθήκη** της εταιρείας (ADR-928 Φ3γ-0). Ίδιος κριτής (`companyGrants` πάνω στον
 * ΕΝΑ πίνακα), ίδιο fail-closed: χωρίς ταυτότητα ⇒ `false` παντού.
 */
export function useSubcontractLibraryAuthority(): SubcontractLibraryAuthorityView {
  const gates = useCapabilities(LIBRARY_PERMISSIONS);
  const actorUid = useAuth().user?.uid ?? '';
  return useMemo(
    () => ({
      actorUid,
      canPropose: companyGrants(gates, 'propose'),
      canManageClauses: companyGrants(gates, 'manage'),
      canManageTemplates: companyGrants(gates, 'templates'),
      canSeed: companyGrants(gates, 'seed'),
      pending: actorUid === '' || LIBRARY_PERMISSIONS.some((permission) => gates[permission]?.pending !== false),
    }),
    [actorUid, gates],
  );
}
