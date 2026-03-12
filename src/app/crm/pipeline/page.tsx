'use client';

import { PipelineTab } from "@/components/crm/dashboard/PipelineTab";
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';

export default function CrmPipelinePage() {
  return (
    <>
      <ModuleBreadcrumb className="px-6 pt-4" />
      <PipelineTab />
    </>
  );
}
