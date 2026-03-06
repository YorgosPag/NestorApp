'use client';

/**
 * @module DiagnosticsTab
 * @description Diagnostics tab — B58 Anomaly Detection + B89 Grid Analytics.
 * @see ADR-189
 */

import React, { useState, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useGuideState } from '../../../hooks/state/useGuideState';
import {
  computeAnalytics,
  detectAnomalies,
  suggestFixes,
} from '../../../systems/guides';
import type { GuideAnalytics, GuideAnomaly } from '../../../systems/guides';

export const DiagnosticsTab: React.FC = () => {
  const { t } = useTranslation('dxf-viewer');
  const { guides } = useGuideState();

  const [analytics, setAnalytics] = useState<GuideAnalytics | null>(null);
  const [anomalies, setAnomalies] = useState<readonly GuideAnomaly[]>([]);
  const [fixes, setFixes] = useState<readonly string[]>([]);

  const handleRunAnalysis = useCallback(() => {
    const a = computeAnalytics(guides);
    const d = detectAnomalies(guides);
    const f = suggestFixes(d);
    setAnalytics(a);
    setAnomalies(d);
    setFixes(f);
  }, [guides]);

  if (guides.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {t('guideAnalysis.diagnostics.empty')}
      </p>
    );
  }

  return (
    <section className="space-y-3">
      <Button size="sm" className="w-full" onClick={handleRunAnalysis}>
        {t('guideAnalysis.diagnostics.runAnalysis')}
      </Button>

      {analytics && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">{t('guideAnalysis.diagnostics.totalGuides')}</dt>
          <dd className="font-medium text-right">{analytics.totalGuides}</dd>

          <dt className="text-muted-foreground">{t('guideAnalysis.diagnostics.byAxis')}</dt>
          <dd className="font-medium text-right">
            X:{analytics.byAxis.X} Y:{analytics.byAxis.Y} XZ:{analytics.byAxis.XZ}
          </dd>

          <dt className="text-muted-foreground">{t('guideAnalysis.diagnostics.avgSpacing')}</dt>
          <dd className="font-medium text-right">
            X:{analytics.averageSpacing.X.toFixed(2)}m Y:{analytics.averageSpacing.Y.toFixed(2)}m
          </dd>

          <dt className="text-muted-foreground">{t('guideAnalysis.diagnostics.density')}</dt>
          <dd>
            <div className="flex items-center gap-1.5">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.round(analytics.densityScore * 100)}%` }}
                />
              </div>
              <span className="text-xs w-8 text-right">{Math.round(analytics.densityScore * 100)}%</span>
            </div>
          </dd>

          <dt className="text-muted-foreground">{t('guideAnalysis.diagnostics.complexity')}</dt>
          <dd>
            <div className="flex items-center gap-1.5">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{ width: `${Math.round(analytics.complexityScore * 100)}%` }}
                />
              </div>
              <span className="text-xs w-8 text-right">{Math.round(analytics.complexityScore * 100)}%</span>
            </div>
          </dd>
        </dl>
      )}

      {analytics && (
        <section className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('guideAnalysis.diagnostics.anomalies')}
          </h4>
          {anomalies.length === 0 ? (
            <p className="text-sm text-green-500">{t('guideAnalysis.diagnostics.noAnomalies')}</p>
          ) : (
            <ul className="space-y-1">
              {anomalies.map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm">
                  {a.severity === 'error'
                    ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {fixes.length > 0 && (
        <section className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('guideAnalysis.diagnostics.suggestedFixes')}
          </h4>
          <ul className="space-y-1">
            {fixes.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
};

DiagnosticsTab.displayName = 'DiagnosticsTab';
