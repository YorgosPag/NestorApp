export type PropertyMutationImpactMode = 'allow' | 'warn' | 'block';

export type PropertyMutationKind =
  | 'identity'
  | 'commercial'
  | 'structure'
  | 'linkedSpaces'
  | 'features';

export type PropertyMutationDependencyId =
  | 'paymentPlans'
  | 'payments'
  | 'cheques'
  | 'legalContracts'
  | 'accountingInvoices'
  | 'files';

export interface PropertyMutationChange {
  readonly field: string;
  readonly kind: PropertyMutationKind;
  readonly previousValue: string | null;
  readonly nextValue: string | null;
}

export interface PropertyMutationDependency {
  readonly id: PropertyMutationDependencyId;
  readonly count: number;
  readonly mode: Exclude<PropertyMutationImpactMode, 'allow'>;
}

export interface PropertyMutationImpactPreview {
  readonly mode: PropertyMutationImpactMode;
  readonly mutationKinds: ReadonlyArray<PropertyMutationKind>;
  readonly changes: ReadonlyArray<PropertyMutationChange>;
  readonly dependencies: ReadonlyArray<PropertyMutationDependency>;
  readonly messageKey: string;
  readonly blockingCount: number;
  readonly warningCount: number;
  /** Effective commercialStatus after the mutation — used to filter commercial field display. */
  readonly commercialStatus?: string;
}
