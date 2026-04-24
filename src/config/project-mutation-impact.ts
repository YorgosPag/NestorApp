import type { ProjectStatus } from '@/types/project';

// =============================================================================
// STATUS TRANSITION REGISTRY — ADR-302 §5
// =============================================================================

/** Dependency mode hierarchy: block > warn > info */
export type TransitionDependencyMode = 'info' | 'warn' | 'block';

/** Sparse rule: which dependency gets which mode for a given target status */
export type TransitionRule = Partial<Record<ProjectMutationDependencyId, TransitionDependencyMode>>;

/** Statuses that can be the TARGET of a guarded transition */
export type StatusTransitionTarget = Extract<
  ProjectStatus,
  'completed' | 'cancelled' | 'on_hold' | 'in_progress' | 'planning'
>;

export interface DirectionalTransitionRule {
  /** Source status(es) that trigger this rule */
  readonly from: ReadonlyArray<ProjectStatus>;
  /** Target status(es) that trigger this rule */
  readonly to: ReadonlyArray<ProjectStatus>;
  /** Dependencies to show when their count > 0 */
  readonly dependencies: TransitionRule;
  /**
   * Dependencies to show when their count === 0 (proactive checklist).
   * Used for planning → in_progress: show INFO when building/employment not yet set up.
   */
  readonly zeroCountDeps?: TransitionRule;
  /**
   * Force dialog to open even when all dependency counts = 0.
   * Used for reopening completed/cancelled projects.
   */
  readonly alwaysNotify?: boolean;
  /** i18n message key for the dialog description */
  readonly messageKey?: string;
}

export interface StatusTransitionRegistry {
  /**
   * Rules keyed by target status — independent of where-from.
   * Applied when count > 0 for each listed dependency.
   */
  readonly byTarget: Partial<Record<StatusTransitionTarget, TransitionRule>>;
  /** i18n message key per target status */
  readonly byTargetMessageKeys: Partial<Record<StatusTransitionTarget, string>>;
  /** Directional rules that also consider the source status */
  readonly directional: ReadonlyArray<DirectionalTransitionRule>;
}

export const PROJECT_STATUS_TRANSITION_REGISTRY: StatusTransitionRegistry = {
  byTarget: {
    completed: {
      legalContracts: 'warn',
      obligations: 'warn',
      purchaseOrders: 'warn',
      propertyPaymentPlans: 'warn',
      properties: 'info',
      attendanceEvents: 'warn',
      employmentRecords: 'warn',
      boqItems: 'warn',
      buildings: 'info',
      ownershipTables: 'info',
      accountingInvoices: 'info',
      files: 'info',
    },
    cancelled: {
      legalContracts: 'block',
      obligations: 'block',
      purchaseOrders: 'block',
      soldProperties: 'block',
      propertyPaymentPlans: 'warn',
      properties: 'warn',
      attendanceEvents: 'warn',
      employmentRecords: 'warn',
      boqItems: 'warn',
      buildings: 'warn',
      contactLinks: 'warn',
      ownershipTables: 'warn',
      accountingInvoices: 'info',
      files: 'info',
    },
    on_hold: {
      legalContracts: 'warn',
      obligations: 'warn',
      purchaseOrders: 'warn',
      attendanceEvents: 'warn',
      employmentRecords: 'warn',
      buildings: 'info',
    },
  },
  byTargetMessageKeys: {
    completed: 'impactGuard.statusTransition.toCompleted',
    cancelled: 'impactGuard.statusTransition.toCancelled',
    on_hold: 'impactGuard.statusTransition.toOnHold',
    in_progress: 'impactGuard.statusTransition.toInProgress',
    planning: 'impactGuard.statusTransition.toPlanning',
  },
  directional: [
    {
      // planning → in_progress: proactive INFO checklist when setup is missing
      from: ['planning'],
      to: ['in_progress'],
      dependencies: {},
      zeroCountDeps: { buildings: 'info', employmentRecords: 'info' },
      messageKey: 'impactGuard.statusTransition.toInProgress',
    },
    {
      // Reopening a closed project: always WARN regardless of counts
      from: ['completed', 'cancelled'],
      to: ['planning', 'in_progress', 'on_hold'],
      dependencies: { employmentRecords: 'warn' },
      alwaysNotify: true,
      messageKey: 'impactGuard.statusTransition.reopen',
    },
    {
      // Regressing to planning: WARN if work has already started
      from: ['in_progress', 'on_hold'],
      to: ['planning'],
      dependencies: { buildings: 'warn', properties: 'warn', attendanceEvents: 'warn' },
      messageKey: 'impactGuard.statusTransition.toPlanning',
    },
  ],
};

export const PROJECT_MUTATION_FIELD_KIND_MAP = {
  linkedCompanyId: 'companyLink',
  name: 'projectIdentity',
  title: 'projectIdentity',
  description: 'projectIdentity',
  buildingBlock: 'permitMetadata',
  protocolNumber: 'permitMetadata',
  licenseNumber: 'permitMetadata',
  issuingAuthority: 'permitMetadata',
  issueDate: 'permitMetadata',
  status: 'projectStatus',
} as const;

export type ProjectMutationKind = typeof PROJECT_MUTATION_FIELD_KIND_MAP[keyof typeof PROJECT_MUTATION_FIELD_KIND_MAP];
export type ProjectMutationField = keyof typeof PROJECT_MUTATION_FIELD_KIND_MAP;

export const PROJECT_MUTATION_DEPENDENCY_IDS = [
  'buildings',
  'properties',
  'propertyPaymentPlans',
  'contactLinks',
  'communications',
  'obligations',
  'legalContracts',
  'ownershipTables',
  'purchaseOrders',
  'attendanceEvents',
  'employmentRecords',
  'accountingInvoices',
  'files',
  'boqItems',
  'soldProperties',          // dep #15 — ADR-302 §5.2: properties with commercialStatus=='sold'
  'calendarEvents',          // dep #16 — ADR-302 §6.1: calendar_events with projectId
  'employmentRecordsGlobal', // dep #17 — ADR-307: company-wide count for global ΕΦΚΑ config save
  'commissionRecords',       // dep #18 — broker termination pending commissions
] as const;

export type ProjectMutationDependencyId = typeof PROJECT_MUTATION_DEPENDENCY_IDS[number];
