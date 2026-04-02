import type { ProjectStatus } from '@/types/project';

export const PROJECT_MUTATION_CHANGE_FIELDS = {
  COMPANY_LINK: ['linkedCompanyId'],
  PROJECT_IDENTITY: ['name', 'title', 'description'],
  PERMIT_METADATA: ['buildingBlock', 'protocolNumber', 'licenseNumber', 'issuingAuthority', 'issueDate'],
  PROJECT_STATUS: ['status'],
} as const;

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

export const PROJECT_MUTATION_STATUS_GUARDED_VALUES: ReadonlySet<ProjectStatus> = new Set([
  'planning',
  'in_progress',
  'completed',
  'on_hold',
  'cancelled',
]);

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
] as const;

export type ProjectMutationDependencyId = typeof PROJECT_MUTATION_DEPENDENCY_IDS[number];
