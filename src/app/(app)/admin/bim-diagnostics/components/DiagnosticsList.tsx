'use client';

/**
 * DiagnosticsList — ADR-366 §C.7.Q2
 *
 * Tabular row list. First iteration: plain scrolling table (windowed by the
 * 30-day query). Will swap in `@tanstack/react-virtual` when records exceed
 * ~1k per the ADR-366 §C.7.Q2 performance note.
 *
 * @module admin/bim-diagnostics/components/DiagnosticsList
 */

import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import type { PerformanceDiagnostic, TriageStatus } from '@/types/performance-diagnostic';

interface DiagnosticsListProps {
  rows: ReadonlyArray<PerformanceDiagnostic>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_BADGE_CLASS: Record<TriageStatus, string> = {
  new: 'bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))]',
  triaged: 'bg-[hsl(var(--chart-2)/0.15)] text-[hsl(var(--chart-2))]',
  investigating: 'bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))]',
  resolved: 'bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))]',
  wontfix: 'bg-muted text-muted-foreground',
};

function formatCreatedAt(value: Timestamp | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 19).replace('T', ' ');
  try {
    return value.toDate().toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return '';
  }
}

function formatFps(metrics: PerformanceDiagnostic['metrics']): string {
  const fps = metrics?.fps;
  if (typeof fps !== 'number' || Number.isNaN(fps)) return '—';
  return fps.toFixed(0);
}

export function DiagnosticsList({ rows, selectedId, onSelect }: DiagnosticsListProps) {
  const { t } = useTranslation('admin');

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-4">
        {t('bimDiagnostics.empty')}
      </p>
    );
  }

  return (
    <section className="overflow-y-auto h-full">
      <p className="text-xs text-muted-foreground px-3 pt-2">
        {t('bimDiagnostics.list.rowCount', { count: rows.length })}
      </p>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background border-b">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">{t('bimDiagnostics.list.timestamp')}</th>
            <th className="px-3 py-2 font-medium">{t('bimDiagnostics.list.user')}</th>
            <th className="px-3 py-2 font-medium">{t('bimDiagnostics.list.project')}</th>
            <th className="px-3 py-2 font-medium">{t('bimDiagnostics.list.status')}</th>
            <th className="px-3 py-2 font-medium text-right">{t('bimDiagnostics.list.fps')}</th>
            <th className="px-3 py-2 font-medium">{t('bimDiagnostics.list.mode')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status: TriageStatus = row.status ?? 'new';
            const isSelected = row.id === selectedId;
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row.id)}
                className={`cursor-pointer border-b hover:bg-muted/40 ${
                  isSelected ? 'bg-muted/60' : ''
                }`}
              >
                <td className="px-3 py-1.5 font-mono">{formatCreatedAt(row.createdAt)}</td>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <td className="px-3 py-1.5 truncate max-w-[120px]">{row.userId}</td>
                  </TooltipTrigger>
                  <TooltipContent>{row.userId}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <td className="px-3 py-1.5 truncate max-w-[140px]">
                      {row.projectId ?? '—'}
                    </td>
                  </TooltipTrigger>
                  <TooltipContent>{row.projectId ?? ''}</TooltipContent>
                </Tooltip>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${STATUS_BADGE_CLASS[status]}`}>
                    {t(`bimDiagnostics.status.${status}`)}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatFps(row.metrics)}</td>
                <td className="px-3 py-1.5">{row.renderMode}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
