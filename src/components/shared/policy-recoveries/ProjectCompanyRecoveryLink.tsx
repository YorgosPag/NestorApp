'use client';

/**
 * =============================================================================
 * ENTERPRISE: Recovery for POLICY_PROJECT_ORPHAN_NO_COMPANY
 * =============================================================================
 *
 * Inline recovery card: lets the user link an orphan project to a company
 * right from the error banner, without leaving the current form. Works
 * identically for Building, Property, Floor, ... — any entity whose
 * creation policy fires `POLICY_PROJECT_ORPHAN_NO_COMPANY`.
 *
 * Expected context: `{ projectId: string }`
 *
 * @enterprise
 *   Zero duplication: reuses the centralized `useEntityLink` hook with the
 *   existing `project-company` relation (same relation used by the Project
 *   editor) and the `updateProjectWithPolicy` gateway.
 *
 * @see lib/policy/policy-recovery-registry
 * @see ADR-200 Centralized Entity Linking
 * @see ADR-232 Tenant Isolation vs Business Entity Link
 * @see ADR-284 §3.0.5 / §3.1
 * @module components/shared/policy-recoveries/ProjectCompanyRecoveryLink
 */

import { useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { useEntityLink } from '@/hooks/useEntityLink';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getAllCompaniesForSelect } from '@/services/companies.service';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { createModuleLogger } from '@/lib/telemetry';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import type { PolicyRecoveryContext } from '@/lib/policy';

const logger = createModuleLogger('ProjectCompanyRecoveryLink');

export function ProjectCompanyRecoveryLink({
  context,
  onRecovered,
}: PolicyRecoveryContext) {
  const { t } = useTranslation('projects-data');
  const projectId = typeof context.projectId === 'string' ? context.projectId : '';

  const loadCompanies = useCallback(async (): Promise<EntityLinkOption[]> => {
    const companies = await getAllCompaniesForSelect();
    return companies
      .filter(c => c.id)
      .map(c => ({ id: c.id!, name: c.companyName || '' }));
  }, []);

  const saveCompanyLink = useCallback(async (newId: string | null) => {
    if (!projectId) {
      return { success: false, error: 'Missing projectId in recovery context' };
    }
    try {
      const result = await updateProjectWithPolicy({
        projectId,
        updates: { linkedCompanyId: newId },
      });
      if (result.success) {
        logger.info('Orphan project linked to company', { projectId, companyId: newId });
        onRecovered();
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to save' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save';
      logger.error('Failed to link orphan project to company', { projectId, error });
      return { success: false, error: message };
    }
  }, [projectId, onRecovered]);

  // 🏢 ADR-200: Centralized entity linking — same `project-company` relation
  // used by GeneralProjectTab. `immediate` saveMode persists as soon as the
  // user picks a company, mirroring the self-healing error UX pattern.
  const companyLink = useEntityLink({
    relation: 'project-company',
    entityId: projectId,
    initialParentId: null,
    loadOptions: loadCompanies,
    saveMode: 'immediate',
    onSave: saveCompanyLink,
    hideCurrentLabel: true,
    icon: Building2,
    cardId: `orphan-project-company-link-${projectId}`,
    labels: {
      title: t('basicInfo.companyLink.title'),
      label: t('basicInfo.companyLink.label'),
      placeholder: t('basicInfo.companyLink.placeholder'),
      noSelection: t('basicInfo.companyLink.noSelection'),
      loading: t('basicInfo.companyLink.loading'),
      save: t('basicInfo.companyLink.save'),
      saving: t('basicInfo.companyLink.saving'),
      success: t('basicInfo.companyLink.success'),
      error: t('basicInfo.companyLink.error'),
      currentLabel: t('basicInfo.companyLink.currentLabel'),
    },
  }, true /* isEditing: always active in recovery context */);

  if (!projectId) return null;
  return <EntityLinkCard key={companyLink.linkCardKey} {...companyLink.linkCardProps} />;
}
