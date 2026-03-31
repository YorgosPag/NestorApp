/**
 * desktop-nav-handlers — Delete/unlink handlers for DesktopMultiColumn.
 *
 * All entity-level operations (company delete, project/building/unit unlink,
 * item connection) are centralised here so the main component stays lean.
 */

import { EntityLinkingService, ENTITY_LINKING_CONFIG } from '@/services/entity-linking';
import { createModuleLogger } from '@/lib/telemetry';
import type { NavigationBuilding } from '@/components/navigation/core/types';

const logger = createModuleLogger('desktop-nav-handlers');

// ── Shared types ──

export interface PendingEntity {
  id: string;
  name: string;
}

export interface PendingCompany {
  id: string;
  companyName: string;
}

/** Dependency type used by showDeleteWarning. */
export type DependencyType = 'company' | 'project' | 'building';

// ── Dependency helpers ──

interface CompanyLike { id: string }
interface ProjectLike { companyId?: string }

export function canDeleteCompany(
  company: CompanyLike,
  projects: ProjectLike[]
): boolean {
  return projects.filter(p => p.companyId === company.id).length === 0;
}

export function getDeleteWarningKey(itemType: DependencyType): string {
  const map: Record<DependencyType, string> = {
    company: 'dialogs.dependencies.cannotRemoveCompany',
    project: 'dialogs.dependencies.cannotUnlinkProject',
    building: 'dialogs.dependencies.cannotUnlinkBuilding',
  };
  return map[itemType];
}

// ── Company deletion ──

interface CompanyDeletionDeps {
  pendingDeletionCompany: PendingCompany;
  onCompanySelect: (id: string) => void;
  loadCompanies: () => Promise<void>;
  warning: (msg: string, opts?: { duration: number }) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export async function executeCompanyDeletion(deps: CompanyDeletionDeps): Promise<void> {
  const { pendingDeletionCompany, onCompanySelect, loadCompanies, warning, t } = deps;

  try {
    const { removeCompanyFromNavigation } = await import('@/services/navigation-companies.service');
    const { NavigationApiService } = await import(
      '@/components/navigation/core/services/navigationApi'
    );

    const { id: companyId, companyName } = pendingDeletionCompany;

    // Optimistic UI — deselect immediately
    onCompanySelect('');

    await removeCompanyFromNavigation(companyId);
    NavigationApiService.clearCompaniesCache();
    await loadCompanies();

    warning(`\u2705 ${t('dialogs.company.successMessage', { companyName })}`, { duration: 4000 });
  } catch (error) {
    logger.error('Enterprise company deletion failed', { error });
    warning(`\u274C ${t('dialogs.company.errorMessage')}`, { duration: 5000 });

    // Rollback optimistic update
    onCompanySelect(pendingDeletionCompany.id);
  }
}

// ── Project unlink ──

interface UnlinkDeps {
  pending: PendingEntity;
  entityType: 'project' | 'building' | 'unit';
  clearSelection: () => void;
  warning: (msg: string, opts?: { duration: number }) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
  /** i18n namespace key prefix, e.g. 'dialogs.project' */
  dialogKey: string;
  /** Name parameter key for success message, e.g. 'projectName' */
  nameParam: string;
}

export async function executeEntityUnlink(deps: UnlinkDeps): Promise<void> {
  const { pending, entityType, clearSelection, warning, t, dialogKey, nameParam } = deps;

  try {
    const result = await EntityLinkingService.unlinkEntity({
      entityId: pending.id,
      entityType,
    });

    if (result.success) {
      warning(`\u2705 ${t(`${dialogKey}.successMessage`, { [nameParam]: pending.name })}`, {
        duration: 4000,
      });
      clearSelection();
    } else if ('error' in result) {
      warning(`\u274C ${t(`${dialogKey}.errorMessage`)}: ${result.error}`, { duration: 5000 });
    }
  } catch (error) {
    logger.error(`${entityType} unlink failed`, { error });
    warning(`\u274C ${t(`${dialogKey}.errorMessage`)}`, { duration: 5000 });
  }
}

// ── Building connection ──

interface BuildingConnectionDeps {
  building: { id: string; name: string };
  selectedProjectId: string;
  selectedProjectName: string;
  warning: (msg: string, opts?: { duration: number }) => void;
  closeModal: () => void;
}

export async function executeBuildingConnection(deps: BuildingConnectionDeps): Promise<void> {
  const { building, selectedProjectId, selectedProjectName, warning, closeModal } = deps;

  const result = await EntityLinkingService.linkBuildingToProject(building.id, selectedProjectId);

  if (result.success) {
    closeModal();
    const labels = ENTITY_LINKING_CONFIG['building-project'].labels;
    warning(
      `\u2705 ${labels.successMessage.replace('!', ` "${building.name}" με "${selectedProjectName}"!`)}`,
      { duration: 4000 }
    );
  } else {
    const labels = ENTITY_LINKING_CONFIG['building-project'].labels;
    warning(`\u274C ${labels.errorMessage}. ${'error' in result ? result.error : ''}`, {
      duration: 5000,
    });
  }
}

// ── Filtered buildings helper ──

export function filterBuildings(
  projectBuildings: Pick<NavigationBuilding, 'id' | 'name'>[],
  searchTerm: string
): Pick<NavigationBuilding, 'id' | 'name'>[] {
  if (!searchTerm.trim()) return projectBuildings;
  const lower = searchTerm.toLowerCase();
  return projectBuildings.filter(b => b.name.toLowerCase().includes(lower));
}
