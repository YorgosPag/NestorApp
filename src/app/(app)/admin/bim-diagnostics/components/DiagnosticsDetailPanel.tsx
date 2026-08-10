'use client';

/**
 * DiagnosticsDetailPanel — ADR-366 §C.7.Q2
 *
 * Right-side detail view for a selected performance_diagnostics record:
 * 10-metric grid, screenshot lightbox, user comment, scene info, full
 * audit history (via useEntityAudit ADR-195), and the triage actions
 * subcomponent.
 *
 * @module admin/bim-diagnostics/components/DiagnosticsDetailPanel
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useEntityAudit } from '@/hooks/useEntityAudit';
import type { PerformanceDiagnostic } from '@/types/performance-diagnostic';
import { TriageActions } from './TriageActions';

interface DiagnosticsDetailPanelProps {
  diagnostic: PerformanceDiagnostic;
}

const METRIC_FIELDS = [
  { key: 'fps', i18n: 'metricFps' },
  { key: 'frameTimeMs', i18n: 'metricFrameTime' },
  { key: 'triangles', i18n: 'metricTriangles' },
  { key: 'vertices', i18n: 'metricVertices' },
  { key: 'drawCalls', i18n: 'metricDrawCalls' },
  { key: 'objectsVisible', i18n: 'metricObjectsVisible' },
  { key: 'objectsTotal', i18n: 'metricObjectsTotal' },
  { key: 'gpuMemoryMb', i18n: 'metricGpuMemory' },
  { key: 'cpuMemoryMb', i18n: 'metricCpuMemory' },
  { key: 'samplesPerSec', i18n: 'metricSamplesPerSec' },
] as const;

function formatMetric(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2);
}

function formatCreatedAt(value: Timestamp | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return value.toDate().toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return '';
  }
}

export function DiagnosticsDetailPanel({ diagnostic }: DiagnosticsDetailPanelProps) {
  const { t } = useTranslation('admin');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const audit = useEntityAudit({
    entityType: 'performance_diagnostic',
    entityId: diagnostic.id,
    pageSize: 20,
  });

  return (
    <section className="space-y-4 p-4 overflow-y-auto h-full">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold">{t('bimDiagnostics.detail.title')}</h2>
        <p className="text-xs text-muted-foreground">{formatCreatedAt(diagnostic.createdAt)}</p>
        <dl className="text-xs grid grid-cols-2 gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">{t('bimDiagnostics.detail.renderMode')}</dt>
          <dd>{diagnostic.renderMode}</dd>
          <dt className="text-muted-foreground">{t('bimDiagnostics.detail.source')}</dt>
          <dd>
            {diagnostic.source === 'auto_submit'
              ? t('bimDiagnostics.detail.sourceAutoSubmit')
              : t('bimDiagnostics.detail.sourceManual')}
          </dd>
        </dl>
      </header>

      <article className="space-y-2">
        <h3 className="text-xs font-medium">{t('bimDiagnostics.detail.metricsHeader')}</h3>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {METRIC_FIELDS.map((m) => (
            <div key={m.key} className="contents">
              <dt className="text-muted-foreground">{t(`bimDiagnostics.detail.${m.i18n}`)}</dt>
              <dd>{formatMetric(diagnostic.metrics?.[m.key])}</dd>
            </div>
          ))}
        </dl>
      </article>

      {diagnostic.screenshotUrl && (
        <article>
          <h3 className="text-xs font-medium mb-1">{t('bimDiagnostics.detail.screenshot')}</h3>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block w-full max-h-48 overflow-hidden rounded border hover:opacity-90"
          >
            <img
              src={diagnostic.screenshotUrl}
              alt={t('bimDiagnostics.detail.screenshot')}
              className="w-full h-auto"
            />
          </button>
          <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
            <DialogContent className="max-w-5xl">
              <DialogTitle className="sr-only">{t('bimDiagnostics.detail.screenshotOpen')}</DialogTitle>
              <img
                src={diagnostic.screenshotUrl}
                alt={t('bimDiagnostics.detail.screenshot')}
                className="w-full h-auto"
              />
            </DialogContent>
          </Dialog>
        </article>
      )}

      <article>
        <h3 className="text-xs font-medium mb-1">{t('bimDiagnostics.detail.userComment')}</h3>
        <p className="text-xs">
          {diagnostic.comment ?? (
            <span className="text-muted-foreground italic">
              {t('bimDiagnostics.detail.userCommentEmpty')}
            </span>
          )}
        </p>
      </article>

      <TriageActions diagnostic={diagnostic} />

      <article className="border-t pt-4">
        <h3 className="text-xs font-medium mb-2">{t('bimDiagnostics.detail.auditHistory')}</h3>
        {audit.isLoading ? (
          <p className="text-xs text-muted-foreground">…</p>
        ) : audit.entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {audit.entries.map((entry) => (
              <li key={entry.id ?? entry.timestamp} className="text-muted-foreground">
                <span className="font-mono mr-2">{entry.timestamp.slice(0, 19).replace('T', ' ')}</span>
                <span className="font-medium">{entry.action}</span>
                <span className="ml-2">{entry.performedByName ?? entry.performedBy}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
