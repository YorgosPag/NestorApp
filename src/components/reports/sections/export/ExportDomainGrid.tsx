'use client';

/**
 * @module reports/sections/export/ExportDomainGrid
 * @enterprise ADR-265 Phase 13 — Grid of domain cards with export actions
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportSection } from '@/components/reports/core';
import { cn } from '@/lib/utils';
import type { ExportDomainCard, ExportDomain } from './types';
import type { ExportFormat } from '@/components/reports/core/ReportExportBar';

interface ExportDomainGridProps {
  domains: ExportDomainCard[];
  onExport: (domain: ExportDomain, format: ExportFormat) => void;
  exportingDomains: Set<string>;
}

export function ExportDomainGrid({ domains, onExport, exportingDomains }: ExportDomainGridProps) {
  const { t } = useTranslation('reports');
  const colors = useSemanticColors();

  return (
    <ReportSection
      title={t('exportCenter.grid.title')}
      description={t('exportCenter.grid.description')}
      id="export-domain-grid"
      collapsible={false}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {domains.map((domain) => {
          const Icon = domain.icon;
          const isExporting = exportingDomains.has(domain.domain);

          return (
            <article
              key={domain.domain}
              className={cn(
                'rounded-lg border p-4 flex flex-col gap-3',
                colors.bg.card,
                colors.border.default,
              )}
            >
              <header className="flex items-center gap-2">
                <Icon className={cn('h-5 w-5', colors.text.primary)} />
                <h3 className={cn('font-medium', colors.text.primary)}>
                  {t(domain.titleKey)}
                </h3>
              </header>

              <p className={cn('text-sm flex-1', colors.text.muted)}>
                {t(domain.descriptionKey)}
              </p>

              <footer className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExporting}
                  onClick={() => onExport(domain.domain, 'pdf')}
                  className="gap-1.5"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExporting}
                  onClick={() => onExport(domain.domain, 'excel')}
                  className="gap-1.5"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </Button>
              </footer>
            </article>
          );
        })}
      </div>
    </ReportSection>
  );
}
