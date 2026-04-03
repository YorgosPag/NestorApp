import type { IndividualIdentityFieldChange } from '@/utils/contactForm/individual-identity-guard';
import type { ServiceIdentityFieldChange } from '@/utils/contactForm/service-identity-guard';

export type ContactIdentityImpactMode = 'allow' | 'warn' | 'block';

export type ContactIdentityDependencyId =
  | 'projectLinks'
  | 'attendanceEvents'
  | 'employmentRecords'
  | 'contactRelationships';

export type ContactIdentityAffectedDomainId =
  | 'linkedProjects'
  | 'searchAndReporting'
  | 'ikaAttendance'
  | 'employmentCompliance'
  | 'documentsAndIdentifiers'
  | 'relationshipViews';

export interface ContactIdentityImpactDependency {
  readonly id: ContactIdentityDependencyId;
  readonly count: number;
  readonly mode: Extract<ContactIdentityImpactMode, 'warn' | 'block'>;
}

export interface ContactIdentityImpactPreview {
  readonly mode: ContactIdentityImpactMode;
  readonly changes: ReadonlyArray<IndividualIdentityFieldChange | ServiceIdentityFieldChange>;
  readonly dependencies: ReadonlyArray<ContactIdentityImpactDependency>;
  readonly affectedDomains: ReadonlyArray<ContactIdentityAffectedDomainId>;
  readonly messageKey: string;
  readonly blockingCount: number;
  readonly warningCount: number;
}
