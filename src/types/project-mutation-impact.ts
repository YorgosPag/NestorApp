import type { ProjectUpdatePayload } from '@/services/projects-client.service';
import type { ProjectMutationDependencyId, ProjectMutationField, ProjectMutationKind } from '@/config/project-mutation-impact';

export type ProjectMutationImpactMode = 'allow' | 'warn' | 'block';
export type ProjectMutationDependencyMode = 'info' | 'warn' | 'block';
export type ProjectCompanyLinkChangeType = 'none' | 'link' | 'unlink' | 'reassign';

export interface ProjectMutationChange {
  readonly field: ProjectMutationField;
  readonly kind: ProjectMutationKind;
  readonly previousValue: string | null;
  readonly nextValue: string | null;
}

export interface ProjectMutationDependency {
  readonly id: ProjectMutationDependencyId;
  readonly count: number;
  readonly mode: ProjectMutationDependencyMode;
}

export interface ProjectMutationImpactPreview {
  readonly mode: ProjectMutationImpactMode;
  readonly mutationKinds: ReadonlyArray<ProjectMutationKind>;
  readonly changes: ReadonlyArray<ProjectMutationChange>;
  readonly dependencies: ReadonlyArray<ProjectMutationDependency>;
  readonly companyLinkChange: ProjectCompanyLinkChangeType;
  readonly messageKey: string;
  readonly blockingCount: number;
  readonly warningCount: number;
}
