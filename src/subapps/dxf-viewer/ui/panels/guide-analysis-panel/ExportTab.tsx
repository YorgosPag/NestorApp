'use client';

/**
 * @module ExportTab
 * @description Export tab — B88 IFC Export + B96 Quantity Takeoff + B60 NLP Command.
 * @see ADR-189
 */

import React, { useState, useCallback } from 'react';
import { Download, Calculator, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatCurrency } from '@/lib/intl-utils';
import { useGuideState } from '../../../hooks/state/useGuideState';
import {
  exportGuidesToIFC,
  computeQuantityTakeoff,
  parseGridCommand,
} from '../../../systems/guides';
import type { QuantityTakeoff, NLPGridResult } from '../../../systems/guides';

export const ExportTab: React.FC = () => {
  const { t } = useTranslation('dxf-viewer');
  const colors = useSemanticColors();
  const { guides } = useGuideState();

  const [takeoff, setTakeoff] = useState<QuantityTakeoff | null>(null);
  const [nlpInput, setNlpInput] = useState('');
  const [nlpResult, setNlpResult] = useState<NLPGridResult | null>(null);

  // IFC Export → Blob download
  const handleExportIFC = useCallback(() => {
    const ifcText = exportGuidesToIFC(guides);
    const blob = new Blob([ifcText], { type: 'application/x-step' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guides-${Date.now()}.ifc`;
    a.click();
    URL.revokeObjectURL(url);
  }, [guides]);

  // Quantity Takeoff
  const handleCalculate = useCallback(() => {
    const result = computeQuantityTakeoff(guides);
    setTakeoff(result);
  }, [guides]);

  // NLP Command
  const handleNlpRun = useCallback(() => {
    if (!nlpInput.trim()) return;
    const result = parseGridCommand(nlpInput.trim());
    setNlpResult(result);
  }, [nlpInput]);

  if (guides.length === 0) {
    return (
      <p className={`text-sm ${colors.text.muted} py-6 text-center`}>
        {t('guideAnalysis.export.empty')}
      </p>
    );
  }

  return (
    <section className="space-y-4">
      {/* IFC Export */}
      <section className="space-y-1.5">
        <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text.muted}`}>
          {t('guideAnalysis.export.ifcExport')}
        </h4>
        <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={handleExportIFC}>
          <Download className="h-4 w-4" />
          {t('guideAnalysis.export.exportIFC')}
        </Button>
      </section>

      {/* Quantity Takeoff */}
      <section className="space-y-1.5">
        <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text.muted}`}>
          {t('guideAnalysis.export.quantityTakeoff')}
        </h4>
        <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={handleCalculate}>
          <Calculator className="h-4 w-4" />
          {t('guideAnalysis.export.calculate')}
        </Button>
        {takeoff && (
          <dl className="grid grid-cols-2 gap-1 text-sm mt-1.5">
            <dt className={colors.text.muted}>{t('guideAnalysis.export.columns')}</dt>
            <dd className="text-right font-medium tabular-nums">
              {takeoff.columns.count} ({takeoff.columns.totalLength_m.toFixed(1)}m)
            </dd>
            <dt className={colors.text.muted}>{t('guideAnalysis.export.beams')}</dt>
            <dd className="text-right font-medium tabular-nums">
              {takeoff.beams.count} ({takeoff.beams.totalLength_m.toFixed(1)}m)
            </dd>
            <dt className={colors.text.muted}>{t('guideAnalysis.export.slabArea')}</dt>
            <dd className="text-right font-medium tabular-nums">{takeoff.slabArea_m2.toFixed(1)} m²</dd>
            <dt className={colors.text.muted}>{t('guideAnalysis.export.estimatedCost')}</dt>
            <dd className="text-right font-medium tabular-nums">{formatCurrency(takeoff.estimatedCost_EUR)}</dd>
          </dl>
        )}
      </section>

      {/* NLP Command */}
      <section className="space-y-1.5">
        <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text.muted}`}>
          {t('guideAnalysis.export.nlpCommand')}
        </h4>
        <div className="flex gap-1.5">
          <Input
            value={nlpInput}
            onChange={(e) => setNlpInput(e.target.value)}
            placeholder={t('guideAnalysis.export.nlpPlaceholder')}
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleNlpRun(); }}
          />
          <Button size="sm" className="h-8 gap-1" onClick={handleNlpRun}>
            <MessageSquare className="h-3.5 w-3.5" />
            {t('guideAnalysis.export.run')}
          </Button>
        </div>
        {nlpResult && (
          <div className="rounded border p-2 text-sm space-y-1">
            <div className="flex justify-between">
              <span className={colors.text.muted}>{t('guideAnalysis.export.confidence')}</span>
              <span className="font-medium">{Math.round(nlpResult.confidence * 100)}%</span>
            </div>
            {nlpResult.type === 'preset' && nlpResult.presetId && (
              <p className="text-xs">Preset: <code className="bg-muted px-1 rounded">{nlpResult.presetId}</code></p>
            )}
            {nlpResult.type === 'custom' && nlpResult.xSpacings && (
              <p className="text-xs">
                X: [{nlpResult.xSpacings.join(', ')}]
                {nlpResult.ySpacings && <> Y: [{nlpResult.ySpacings.join(', ')}]</>}
              </p>
            )}
            {nlpResult.type !== 'unknown' && (
              <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-1">
                {t('guideAnalysis.export.applyGrid')}
              </Button>
            )}
          </div>
        )}
      </section>
    </section>
  );
};

ExportTab.displayName = 'ExportTab';
