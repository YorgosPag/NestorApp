'use client';

/**
 * @module SustainabilityTab
 * @description Sustainability tab — B74 Material + B75 Carbon + B100 Green Deal + B72 Eco Presets.
 * @see ADR-189
 */

import React, { useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';
import { formatCurrency } from '@/lib/intl-utils';
import { useGuideState } from '../../../hooks/state/useGuideState';
import {
  estimateMaterial,
  estimateCarbon,
  checkGreenDeal,
  ECO_PRESETS,
} from '../../../systems/guides';
import type {
  MaterialEstimate,
  CarbonEstimate,
  SustainabilityCheck,
  GuideGridPreset,
} from '../../../systems/guides';

const RATING_COLORS: Record<string, string> = {
  A: 'bg-green-500',
  B: 'bg-lime-500',
  C: 'bg-yellow-500',
  D: 'bg-orange-500',
  E: 'bg-red-500',
};

export const SustainabilityTab: React.FC = () => {
  const { t } = useTranslation('dxf-viewer');
  const { guides } = useGuideState();

  const [slabThickness, setSlabThickness] = useState(0.20);
  const [columnSize, setColumnSize] = useState(0.40);
  const [material, setMaterial] = useState<MaterialEstimate | null>(null);
  const [carbon, setCarbon] = useState<CarbonEstimate | null>(null);
  const [greenDeal, setGreenDeal] = useState<SustainabilityCheck | null>(null);

  const handleEstimate = useCallback(() => {
    const mat = estimateMaterial(guides, slabThickness, columnSize);
    const carb = estimateCarbon(mat);
    const gd = checkGreenDeal(guides, mat);
    setMaterial(mat);
    setCarbon(carb);
    setGreenDeal(gd);
  }, [guides, slabThickness, columnSize]);

  if (guides.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {t('guideAnalysis.sustainability.empty')}
      </p>
    );
  }

  return (
    <section className="space-y-3">
      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <fieldset>
          <label className="text-xs text-muted-foreground block mb-1">
            {t('guideAnalysis.sustainability.slabThickness')}
          </label>
          <Input
            type="number"
            step={0.01}
            min={0.05}
            max={1.0}
            value={slabThickness}
            onChange={(e) => setSlabThickness(Number(e.target.value))}
            className="h-8 text-sm"
          />
        </fieldset>
        <fieldset>
          <label className="text-xs text-muted-foreground block mb-1">
            {t('guideAnalysis.sustainability.columnSize')}
          </label>
          <Input
            type="number"
            step={0.05}
            min={0.20}
            max={1.5}
            value={columnSize}
            onChange={(e) => setColumnSize(Number(e.target.value))}
            className="h-8 text-sm"
          />
        </fieldset>
      </div>

      <Button size="sm" className="w-full" onClick={handleEstimate}>
        {t('guideAnalysis.sustainability.estimate')}
      </Button>

      {/* Material Estimate */}
      {material && (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('guideAnalysis.sustainability.material')}
          </h4>
          <dl className="grid grid-cols-2 gap-1 text-sm">
            <dt className="text-muted-foreground">{t('guideAnalysis.sustainability.concrete')}</dt>
            <dd className="text-right font-medium tabular-nums">{material.concreteVolume_m3.toFixed(1)} m³</dd>
            <dt className="text-muted-foreground">{t('guideAnalysis.sustainability.steel')}</dt>
            <dd className="text-right font-medium tabular-nums">{material.steelWeight_kg.toFixed(0)} kg</dd>
            <dt className="text-muted-foreground">{t('guideAnalysis.sustainability.waste')}</dt>
            <dd className="text-right font-medium tabular-nums">{(material.wasteFactor * 100).toFixed(0)}%</dd>
            <dt className="text-muted-foreground">{t('guideAnalysis.sustainability.cost')}</dt>
            <dd className="text-right font-medium tabular-nums">{formatCurrency(material.totalCost_EUR)}</dd>
          </dl>
        </section>
      )}

      {/* Carbon Footprint */}
      {carbon && (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('guideAnalysis.sustainability.carbon')}
          </h4>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('guideAnalysis.sustainability.totalCO2')}</span>
            <span className="font-medium tabular-nums">{carbon.totalCO2_kg.toFixed(0)} kg CO₂</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('guideAnalysis.sustainability.rating')}</span>
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white ${RATING_COLORS[carbon.rating] ?? 'bg-gray-500'}`}>
              {carbon.rating}
            </span>
          </div>
        </section>
      )}

      {/* Green Deal */}
      {greenDeal && (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('guideAnalysis.sustainability.greenDeal')}
          </h4>
          <ul className="space-y-0.5">
            {greenDeal.findings.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm">
                {f.status === 'pass' && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />}
                {f.status === 'warning' && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
                {f.status === 'fail' && <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                <span>{f.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Eco Presets */}
      <section className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('guideAnalysis.sustainability.ecoPresets')}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {(ECO_PRESETS as readonly GuideGridPreset[]).map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => {
                // Apply preset values — populate slab/column inputs
                if (preset.xSpacings?.[0]) {
                  setColumnSize(Math.min(preset.xSpacings[0] / 10, 0.60));
                }
              }}
            >
              <Leaf className="h-3 w-3" />
              {preset.id}
            </Button>
          ))}
        </div>
      </section>
    </section>
  );
};

SustainabilityTab.displayName = 'SustainabilityTab';
