'use client';

/**
 * @performance ADR-294 Batch 5 — lazy-loaded via LazyRoutes
 */

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import LinkSoldPropertiesToCustomers from '@/components/admin/LinkSoldPropertiesToCustomers';
import SoldPropertiesPreview from '@/components/admin/SoldPropertiesPreview';
// Enterprise Configuration Management - CLAUDE.md Protocol compliance
import { useEnterpriseConfig } from '@/core/configuration/useEnterpriseConfig';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

export function LinkPropertiesPageContent() {
  const { t } = useTranslation('admin');
  // Enterprise Configuration Hook - replaces hardcoded values
  const { companyConfig, isLoading } = useEnterpriseConfig();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  // Get current project name from centralized configuration
  // 🏢 ENTERPRISE: Use company name as fallback (currentProject not in CompanyConfiguration)
  const currentProjectName = companyConfig?.name || t('linkPropertiesPage.projectFallback');

  return (
    <div className={`min-h-screen ${colors.bg.primary} p-6`}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className={`${iconSizes.sm} mr-2`} />
              {t('linkPropertiesPage.backToAdmin')}
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{t('linkPropertiesPage.pageTitle')}</h1>
            <p className={colors.text.muted}>
              {isLoading
                ? t('linkPropertiesPage.loadingProject')
                : t('linkPropertiesPage.fixDescription', { project: currentProjectName })}
            </p>
          </div>
        </div>

        {/* Units Preview */}
        <div>
          <h2 className="text-xl font-semibold mb-4">{t('linkPropertiesPage.currentStatus')}</h2>
          <SoldPropertiesPreview />
        </div>

        {/* Main Tool */}
        <div>
          <h2 className="text-xl font-semibold mb-4">{t('linkPropertiesPage.toolTitle')}</h2>
          <LinkSoldPropertiesToCustomers />
        </div>

        {/* Additional Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className={`p-6 bg-card ${quick.card}`}>
            <h3 className="font-semibold mb-3">{t('linkPropertiesPage.goal')}</h3>
            <p className={cn("text-sm", colors.text.muted)}>
              {t('linkPropertiesPage.goalDescription')}
            </p>
          </div>

          <div className={`p-6 bg-card ${quick.card}`}>
            <h3 className="font-semibold mb-3">{t('linkPropertiesPage.whatHappens')}</h3>
            <ul className={cn("text-sm space-y-1", colors.text.muted)}>
              <li>{t('linkPropertiesPage.steps.findSold')}</li>
              <li>{t('linkPropertiesPage.steps.autoLink')}</li>
              <li>{t('linkPropertiesPage.steps.updateDb')}</li>
              <li>{t('linkPropertiesPage.steps.showUi')}</li>
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
}

export default LinkPropertiesPageContent;
