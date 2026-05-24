'use client';

/**
 * DiagnosticsFiltersBar — ADR-366 §C.7.Q2
 *
 * Pure controlled component for the filter state owned by the parent view.
 * No data fetching here — filters apply client-side over the 30-day
 * subscription snapshot.
 *
 * @module admin/bim-diagnostics/components/DiagnosticsFiltersBar
 */

import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TRIAGE_STATUSES } from '../lib/triage-fsm';
import type { TriageStatus } from '@/types/performance-diagnostic';

export interface DiagnosticsFilters {
  status: TriageStatus | 'all';
  projectQuery: string;
  gpuTier: string;
  fpsMin: string;
  fpsMax: string;
  browser: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: DiagnosticsFilters = {
  status: 'all',
  projectQuery: '',
  gpuTier: 'all',
  fpsMin: '',
  fpsMax: '',
  browser: 'all',
  dateFrom: '',
  dateTo: '',
};

interface DiagnosticsFiltersBarProps {
  filters: DiagnosticsFilters;
  onChange: (next: DiagnosticsFilters) => void;
}

export function DiagnosticsFiltersBar({ filters, onChange }: DiagnosticsFiltersBarProps) {
  const { t } = useTranslation('admin');

  function update<K extends keyof DiagnosticsFilters>(key: K, value: DiagnosticsFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="border-b px-3 py-2 space-y-2">
      <header className="text-xs font-semibold">{t('bimDiagnostics.filters.title')}</header>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-1">
          <span className="block text-muted-foreground">{t('bimDiagnostics.filters.status')}</span>
          <Select value={filters.status} onValueChange={(v) => update('status', v as TriageStatus | 'all')}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('bimDiagnostics.filters.statusAll')}</SelectItem>
              {TRIAGE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`bimDiagnostics.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1">
          <span className="block text-muted-foreground">{t('bimDiagnostics.filters.gpuTier')}</span>
          <Select value={filters.gpuTier} onValueChange={(v) => update('gpuTier', v)}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('bimDiagnostics.filters.gpuTierAll')}</SelectItem>
              <SelectItem value="0">T0</SelectItem>
              <SelectItem value="1">T1</SelectItem>
              <SelectItem value="2">T2</SelectItem>
              <SelectItem value="3">T3</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1 col-span-2">
          <span className="block text-muted-foreground">{t('bimDiagnostics.filters.projectId')}</span>
          <Input
            value={filters.projectQuery}
            onChange={(e) => update('projectQuery', e.target.value)}
            placeholder={t('bimDiagnostics.filters.projectIdPlaceholder')}
          />
        </label>

        <label className="space-y-1">
          <span className="block text-muted-foreground">{t('bimDiagnostics.filters.dateFrom')}</span>
          <Input type="date" value={filters.dateFrom} onChange={(e) => update('dateFrom', e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block text-muted-foreground">{t('bimDiagnostics.filters.dateTo')}</span>
          <Input type="date" value={filters.dateTo} onChange={(e) => update('dateTo', e.target.value)} />
        </label>

        <label className="space-y-1">
          <span className="block text-muted-foreground">FPS min</span>
          <Input type="number" value={filters.fpsMin} onChange={(e) => update('fpsMin', e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block text-muted-foreground">FPS max</span>
          <Input type="number" value={filters.fpsMax} onChange={(e) => update('fpsMax', e.target.value)} />
        </label>

        <label className="space-y-1 col-span-2">
          <span className="block text-muted-foreground">{t('bimDiagnostics.filters.browser')}</span>
          <Select value={filters.browser} onValueChange={(v) => update('browser', v)}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('bimDiagnostics.filters.browserAll')}</SelectItem>
              <SelectItem value="chrome">Chrome</SelectItem>
              <SelectItem value="firefox">Firefox</SelectItem>
              <SelectItem value="safari">Safari</SelectItem>
              <SelectItem value="edge">Edge</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <Button onClick={() => onChange(EMPTY_FILTERS)} size="sm" variant="ghost">
        {t('bimDiagnostics.filters.reset')}
      </Button>
    </section>
  );
}
