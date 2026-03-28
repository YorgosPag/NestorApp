 
/* eslint-disable design-system/enforce-semantic-colors */
 
'use client';

import '@/lib/design-system';

/**
 * Monte Carlo Help Panels — Dynamic explanation panel and glossary
 *
 * Educational UI components that explain Monte Carlo simulation
 * results and configuration in real-time as the user hovers.
 *
 * @enterprise ADR-242 SPEC-242D — Monte Carlo Simulation
 * @module monte-carlo-panels
 */

import React from 'react';
import { Lightbulb, BookOpen } from 'lucide-react';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { CostCalculationInput, MonteCarloResult, SensitivityVariable } from '@/types/interest-calculator';
import {
  assessRisk,
  getVariableLabel,
  METRIC_I18N_MAP,
  METRIC_LABEL_MAP,
  RISK_ICONS,
  RISK_BORDER,
  RISK_I18N,
  CONFIG_I18N_MAP,
  CONFIG_FIELD_I18N,
} from './monte-carlo-helpers';
import type { HelpMetricKey, HoveredItem, MonteCarloTabProps } from './monte-carlo-helpers';

// =============================================================================
// METRIC VALUE GETTERS
// =============================================================================

function getMetricValue(key: HelpMetricKey, mcResult: MonteCarloResult): string {
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';
  switch (key) {
    case 'meanNpv': return fmt(mcResult.meanNPV);
    case 'p10': return fmt(mcResult.p10);
    case 'p50': return fmt(mcResult.p50);
    case 'p90': return fmt(mcResult.p90);
    case 'stdDev': return fmt(mcResult.stdDevNPV);
    case 'minMax': return `${fmt(mcResult.minNPV)} — ${fmt(mcResult.maxNPV)}`;
    case 'probPositive': return `${mcResult.probPositive}%`;
    case 'executionTime': return `${mcResult.executionTimeMs}ms`;
  }
}

// =============================================================================
// METRIC EXAMPLE BUILDER
// =============================================================================

function getMetricExample(
  key: HelpMetricKey,
  mcResult: MonteCarloResult,
  salePrice: number,
  h: (key: string, opts?: Record<string, string>) => string,
): string {
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';
  const loss = salePrice - mcResult.meanNPV;
  const lossPercent = salePrice > 0 ? ((loss / salePrice) * 100).toFixed(1) : '0';
  const spread = mcResult.maxNPV - mcResult.minNPV;
  const cv = mcResult.meanNPV !== 0
    ? ((mcResult.stdDevNPV / Math.abs(mcResult.meanNPV)) * 100).toFixed(1)
    : '0';
  const positiveCount = Math.round(mcResult.scenarioCount * mcResult.probPositive / 100);
  const negativeCount = mcResult.scenarioCount - positiveCount;

  switch (key) {
    case 'meanNpv':
      return h('exMeanNpv', {
        salePrice: fmt(salePrice),
        meanNpv: fmt(mcResult.meanNPV),
        loss: fmt(loss),
        lossPercent,
      });
    case 'p10':
      return h('exP10', {
        p10: fmt(mcResult.p10),
        loss: fmt(salePrice - mcResult.p10),
      });
    case 'p50':
      return h('exP50', { p50: fmt(mcResult.p50) });
    case 'p90':
      return h('exP90', {
        p90: fmt(mcResult.p90),
        loss: fmt(salePrice - mcResult.p90),
      });
    case 'stdDev':
      return h('exStdDev', {
        stdDev: fmt(mcResult.stdDevNPV),
        meanNpv: fmt(mcResult.meanNPV),
        cv,
      });
    case 'minMax':
      return h('exMinMax', {
        min: fmt(mcResult.minNPV),
        max: fmt(mcResult.maxNPV),
        spread: fmt(spread),
        spreadPercent: salePrice > 0 ? ((spread / salePrice) * 100).toFixed(1) : '0',
      });
    case 'probPositive':
      return h('exProbPositive', {
        scenarios: String(mcResult.scenarioCount),
        positiveCount: String(positiveCount),
        negativeCount: String(negativeCount),
      });
    case 'executionTime':
      return h('exExecutionTime', {
        scenarios: String(mcResult.scenarioCount),
        time: String(mcResult.executionTimeMs),
        perScenario: mcResult.scenarioCount > 0
          ? ((mcResult.executionTimeMs * 1000) / mcResult.scenarioCount).toFixed(1)
          : '0',
      });
  }
}

// =============================================================================
// METRIC RECOMMENDATION BUILDER
// =============================================================================

function getMetricRecommendation(
  key: HelpMetricKey,
  mcResult: MonteCarloResult,
  salePrice: number,
  h: (key: string, opts?: Record<string, string>) => string,
): string {
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';
  const lossPercent = salePrice > 0
    ? ((salePrice - mcResult.meanNPV) / salePrice) * 100
    : 0;

  switch (key) {
    case 'meanNpv':
      if (lossPercent < 3) return h('recMeanLow');
      if (lossPercent < 8) return h('recMeanMedium');
      return h('recMeanHigh');
    case 'p10':
      return mcResult.p10 > 0
        ? h('recP10Safe')
        : h('recP10Risky', { p10: fmt(mcResult.p10) });
    case 'p50':
      return mcResult.p50 > salePrice * 0.9
        ? h('recP50Above', { p50: fmt(mcResult.p50) })
        : h('recP50Below');
    case 'p90':
      return h('recP90Warning');
    case 'stdDev': {
      const cv = mcResult.meanNPV !== 0
        ? (mcResult.stdDevNPV / Math.abs(mcResult.meanNPV)) * 100
        : 0;
      return cv < 15 ? h('recStdDevLow') : h('recStdDevHigh');
    }
    case 'minMax':
      return lossPercent < 5 ? h('recMeanLow') : h('recMeanMedium');
    case 'probPositive':
      if (mcResult.probPositive >= 95) return h('recProbHigh');
      if (mcResult.probPositive >= 80) return h('recProbMedium');
      return h('recProbLow');
    case 'executionTime':
      return h('recStdDevLow');
  }
}

// =============================================================================
// CONFIG EXAMPLE & RECOMMENDATION BUILDERS
// =============================================================================

function getConfigExample(
  variable: SensitivityVariable,
  value: string,
  salePrice: number,
  meanNPV: number,
  effectiveRate: number,
  h: (key: string, opts?: Record<string, string>) => string,
): string {
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';
  const loss = salePrice - meanNPV;
  const lossPercent = salePrice > 0 ? ((loss / salePrice) * 100).toFixed(1) : '0';

  switch (variable) {
    case 'discountRate': {
      const monthlyCost = salePrice * (Number(value) / 100) / 12;
      return h('exConfigDiscountRate', {
        value,
        salePrice: fmt(salePrice),
        monthlyCost: fmt(monthlyCost),
      });
    }
    case 'bankSpread':
      return h('exConfigBankSpread', {
        value,
        effectiveRate: effectiveRate.toFixed(2),
      });
    case 'salePrice':
      return h('exConfigSalePrice', {
        value: fmt(Number(value)),
        npv: fmt(meanNPV),
        loss: fmt(loss),
        lossPercent,
      });
    case 'upfrontPercent': {
      const upfrontAmount = salePrice * (Number(value) / 100);
      return h('exConfigUpfrontPercent', {
        value,
        upfrontAmount: fmt(upfrontAmount),
      });
    }
    case 'paymentMonths':
      return h('exConfigPaymentMonths', { value });
    case 'certaintyMix': {
      const certainPercent = (Number(value) * 100).toFixed(0);
      const uncertainPercent = ((1 - Number(value)) * 100).toFixed(0);
      return h('exConfigCertaintyMix', { value, certainPercent, uncertainPercent });
    }
  }
}

function getConfigRecommendation(
  variable: SensitivityVariable,
  salePrice: number,
  effectiveRate: number,
  h: (key: string, opts?: Record<string, string>) => string,
): string {
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';
  switch (variable) {
    case 'discountRate': {
      const saving = salePrice * 0.005 * 0.5;
      return h('recConfigDiscountRate', { saving: fmt(saving) });
    }
    case 'bankSpread':
      return h('recConfigBankSpread');
    case 'salePrice':
      return h('recConfigSalePrice');
    case 'upfrontPercent':
      return h('recConfigUpfrontPercent');
    case 'paymentMonths': {
      const saving = salePrice * (effectiveRate / 100) * (6 / 12);
      return h('recConfigPaymentMonths', { saving: fmt(saving) });
    }
    case 'certaintyMix':
      return h('recConfigCertaintyMix');
  }
}

// =============================================================================
// DYNAMIC HELP PANEL
// =============================================================================

/** Center panel: dynamic explanation + example + recommendation */
export function DynamicHelpPanel({
  hoveredItem,
  mcResult,
  input,
  effectiveRate,
  t,
}: {
  hoveredItem: HoveredItem | null;
  mcResult: MonteCarloResult;
  input: CostCalculationInput;
  effectiveRate: number;
  t: MonteCarloTabProps['t'];
}) {
  const colors = useSemanticColors();
  const h = (key: string, opts?: Record<string, string>) => t(`costCalculator.monteCarlo.help.${key}`, opts);
  const riskLevel = assessRisk(mcResult);
  const salePrice = input.salePrice;

  const renderDynamicContent = () => {
    if (!hoveredItem) {
      return (
        <p className={cn("text-xs italic", colors.text.muted)}>
          {h('hoverHint')}
        </p>
      );
    }

    if (hoveredItem.source === 'metric') {
      const { key } = hoveredItem;
      return (
        <article className="space-y-3">
          <section className="space-y-1">
            <p className="text-sm font-medium">
              {t(`costCalculator.monteCarlo.${METRIC_LABEL_MAP[key]}`)}: {getMetricValue(key, mcResult)}
            </p>
            <p className={cn("text-xs leading-relaxed", colors.text.muted)}>
              {h(METRIC_I18N_MAP[key])}
            </p>
          </section>

          <section className="space-y-1 border-t border-dashed pt-2">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {h('exampleTitle')}
            </p>
            <p className={cn("text-xs leading-relaxed", colors.text.muted)}>
              {getMetricExample(key, mcResult, salePrice, h)}
            </p>
          </section>

          <section className="space-y-1 border-t border-dashed pt-2">
            <p className="text-xs font-semibold text-green-600 dark:text-green-400">
              {h('recommendTitle')}
            </p>
            <p className={cn("text-xs leading-relaxed", colors.text.muted)}>
              {getMetricRecommendation(key, mcResult, salePrice, h)}
            </p>
          </section>
        </article>
      );
    }

    // source === 'config'
    const i18nKey = hoveredItem.field === 'main'
      ? CONFIG_I18N_MAP[hoveredItem.variable]
      : CONFIG_FIELD_I18N[hoveredItem.field];

    return (
      <article className="space-y-3">
        <section className="space-y-1">
          <p className="text-sm font-medium">
            {getVariableLabel(hoveredItem.variable, t)}
          </p>
          <p className={cn("text-xs leading-relaxed", colors.text.muted)}>
            {h(i18nKey).replace('{{value}}', hoveredItem.value)}
          </p>
        </section>

        {hoveredItem.field === 'main' && (
          <section className="space-y-1 border-t border-dashed pt-2">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {h('exampleTitle')}
            </p>
            <p className={cn("text-xs leading-relaxed", colors.text.muted)}>
              {getConfigExample(hoveredItem.variable, hoveredItem.value, salePrice, mcResult.meanNPV, effectiveRate, h)}
            </p>
          </section>
        )}

        {hoveredItem.field === 'main' && (
          <section className="space-y-1 border-t border-dashed pt-2">
            <p className="text-xs font-semibold text-green-600 dark:text-green-400">
              {h('recommendTitle')}
            </p>
            <p className={cn("text-xs leading-relaxed", colors.text.muted)}>
              {getConfigRecommendation(hoveredItem.variable, salePrice, effectiveRate, h)}
            </p>
          </section>
        )}
      </article>
    );
  };

  return (
    <aside className="sticky top-4 space-y-4">
      <section
        className={`rounded-lg border p-4 space-y-3 transition-all duration-200 ${
          hoveredItem ? 'opacity-100' : 'opacity-40'
        }`}
      >
        <header className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h4 className="text-sm font-semibold">{h('dynamicTitle')}</h4>
        </header>
        {renderDynamicContent()}
      </section>

      <section className={`rounded-lg border p-4 space-y-2 ${RISK_BORDER[riskLevel]}`}>
        <header className="flex items-center gap-2">
          {RISK_ICONS[riskLevel]}
          <h4 className="text-sm font-semibold">
            {h(RISK_I18N[riskLevel]).split(':')[0]}
          </h4>
        </header>
        <p className="text-xs leading-relaxed">
          {h(RISK_I18N[riskLevel]).split(':').slice(1).join(':').trim()}
        </p>
      </section>
    </aside>
  );
}

// =============================================================================
// GLOSSARY PANEL
// =============================================================================

/** Right panel: glossary (always visible) */
export function GlossaryPanel({ t }: { t: MonteCarloTabProps['t'] }) {
  const colors = useSemanticColors();
  const h = (key: string) => t(`costCalculator.monteCarlo.help.${key}`);

  return (
    <aside className="sticky top-4">
      <section className="rounded-lg border p-4 space-y-3">
        <header className="flex items-center gap-2">
          <BookOpen className={cn("h-4 w-4", colors.text.muted)} />
          <h4 className="text-sm font-semibold">{h('glossaryTitle')}</h4>
        </header>
        <dl className={cn("space-y-2 text-xs leading-relaxed", colors.text.muted)}>
          <dd>{h('glossaryDiscountRate')}</dd>
          <dd>{h('glossaryBankSpread')}</dd>
          <dd>{h('glossarySalePrice')}</dd>
          <dd>{h('glossaryUpfrontPercent')}</dd>
          <dd>{h('glossaryPaymentMonths')}</dd>
          <dd>{h('glossaryCertaintyMix')}</dd>
        </dl>
        <hr className="border-dashed" />
        <dl className={cn("space-y-2 text-xs leading-relaxed", colors.text.muted)}>
          <dd>{h('glossaryNormal')}</dd>
          <dd>{h('glossaryTriangular')}</dd>
          <dd>{h('glossaryUniform')}</dd>
        </dl>
      </section>
    </aside>
  );
}
