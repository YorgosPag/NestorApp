'use client';

import { TrendingUp } from 'lucide-react';
import { PipelineTab } from "@/components/crm/dashboard/PipelineTab";
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { PageHeader } from '@/core/headers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function CrmPipelinePage() {
  const { t } = useTranslation('crm');

  return (
    <section>
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        breadcrumb={<ModuleBreadcrumb />}
        title={{ icon: TrendingUp, title: t('pipeline.title'), subtitle: t('sections.pipeline.description') }}
      />
      <PipelineTab />
    </section>
  );
}
