'use client';

/**
 * CRM Pipeline Page Content
 * @lazy ADR-294 — Extracted from page.tsx for dynamic import
 */

import { TrendingUp } from 'lucide-react';
import { PipelineTab } from '@/components/crm/dashboard/PipelineTab';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { PageHeader } from '@/core/headers';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function PipelinePageContent() {
  const { t } = useTranslation(['crm', 'crm-inbox']);

  return (
    <PageContainer ariaLabel={t('pipeline.title')}>
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        breadcrumb={<ModuleBreadcrumb />}
        title={{ icon: TrendingUp, title: t('pipeline.title'), subtitle: t('sections.pipeline.description') }}
      />
      <PipelineTab />
    </PageContainer>
  );
}

export default PipelinePageContent;
