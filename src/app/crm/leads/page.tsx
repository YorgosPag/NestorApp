'use client';

import { PipelineTab } from "@/components/crm/dashboard/PipelineTab";
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';

export default function CrmLeadsPage() {
  return (
    <section>
      <header className="px-6 pt-4 pb-2">
        <ModuleBreadcrumb />
      </header>
      <PipelineTab />
    </section>
  );
}
