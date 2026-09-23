'use client';

import '@/lib/design-system';

/**
 * @module reports/sections/cash-flow/CashFlowControls
 * @enterprise ADR-268 Phase 8 — Q3 scenario selector + Q5 filters + Q7 export
 */

import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CashFlowScenario } from '@/services/cash-flow/cash-flow.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CashFlowControlsProps {
  activeScenario: CashFlowScenario;
  onScenarioChange: (s: CashFlowScenario) => void;
  projectFilter?: string;
  onProjectFilterChange: (id: string | undefined) => void;
  buildingFilter?: string;
  onBuildingFilterChange: (id: string | undefined) => void;
  projects?: Array<{ id: string; name: string }>;
  buildings?: Array<{ id: string; name: string }>;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const SCENARIOS: { value: CashFlowScenario; labelKey: string }[] = [
  { value: 'optimistic', labelKey: 'scenario.optimistic' },
  { value: 'realistic', labelKey: 'scenario.realistic' },
  { value: 'pessimistic', labelKey: 'scenario.pessimistic' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashFlowControls({
  activeScenario,
  onScenarioChange,
  projectFilter,
  onProjectFilterChange,
  buildingFilter,
  onBuildingFilterChange,
  projects,
  buildings,
  onExportPDF,
  onExportExcel,
  loading,
}: CashFlowControlsProps) {
  const { t } = useTranslation('cash-flow');

  return (
    <nav
      aria-label={t('controls.label', 'Forecast Controls')}
      className="flex flex-wrap items-center gap-3"
    >
      {/* Scenario selector */}
      <SegmentedControl
        value={activeScenario}
        onValueChange={onScenarioChange}
        aria-label={t('scenario.label')}
        className="rounded-lg border p-1"
      >
        {SCENARIOS.map((s) => (
          <SegmentedControlItem key={s.value} value={s.value} variant="ghost" disabled={loading}>
            {t(s.labelKey)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>

      {/* Project filter */}
      {projects && projects.length > 0 && (
        <Select
          value={projectFilter ?? '__all__'}
          onValueChange={(v) =>
            onProjectFilterChange(v === '__all__' ? undefined : v)
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('filter.allProjects')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('filter.allProjects')}</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Building filter */}
      {buildings && buildings.length > 0 && (
        <Select
          value={buildingFilter ?? '__all__'}
          onValueChange={(v) =>
            onBuildingFilterChange(v === '__all__' ? undefined : v)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filter.building', 'Building')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('filter.allBuildings', 'All')}</SelectItem>
            {buildings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Export buttons */}
      <div className="ml-auto flex items-center gap-2">
        {onExportPDF && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportPDF}
            disabled={loading}
          >
            <Download className="mr-1 h-4 w-4" />
            {t('export.pdf')}
          </Button>
        )}
        {onExportExcel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            disabled={loading}
          >
            <Download className="mr-1 h-4 w-4" />
            {t('export.excel')}
          </Button>
        )}
      </div>
    </nav>
  );
}
