/* eslint-disable design-system/no-hardcoded-colors */
/* eslint-disable design-system/enforce-semantic-colors */
/* eslint-disable custom/no-hardcoded-strings */
'use client';

/**
 * MonteCarloTab — Monte Carlo NPV simulation with fan chart & histogram
 *
 * Config panel for variables/distributions, then visualizes:
 * - Fan chart (P10-P90 confidence bands over time)
 * - Histogram (NPV distribution + CDF overlay)
 * - Statistics card (percentiles, probabilities)
 *
 * @enterprise ADR-242 SPEC-242D — Monte Carlo Simulation
 */

import React, { useState, useCallback } from 'react';
import { Info, Play, Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfoLabel } from './InfoLabel';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { runMonteCarloSimulation } from '@/lib/monte-carlo-engine';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';
import type {
  MonteCarloConfig,
  MonteCarloDistribution,
  MonteCarloResult,
  SensitivityVariable,
} from '@/types/interest-calculator';

// Extracted modules
import { StatisticsCard, FanChart, HistogramChart } from './monte-carlo-charts';
import { DynamicHelpPanel, GlossaryPanel } from './monte-carlo-panels';
import {
  createDefaultVariables,
  getVariableLabel,
} from './monte-carlo-helpers';
import type { MonteCarloTabProps, HoveredItem } from './monte-carlo-helpers';

// Re-exports for backward compatibility
export type { MonteCarloTabProps, HoveredItem } from './monte-carlo-helpers';
export type { HelpMetricKey, RiskLevel } from './monte-carlo-helpers';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MonteCarloTab({ input, effectiveRate, result: _result, t }: MonteCarloTabProps) {
  const colors = useSemanticColors();
  const [variables, setVariables] = useState(() =>
    createDefaultVariables(input, effectiveRate)
  );
  const [scenarioCount, setScenarioCount] = useState(10000);
  const [seed, setSeed] = useState(42);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<HoveredItem | null>(null);

  const handleToggleVariable = useCallback((key: SensitivityVariable) => {
    setVariables(prev => prev.map(v =>
      v.key === key ? { ...v, enabled: !v.enabled } : v
    ));
  }, []);

  const handleDistributionChange = useCallback((key: SensitivityVariable, dist: MonteCarloDistribution) => {
    setVariables(prev => prev.map(v =>
      v.key === key ? { ...v, distribution: dist } : v
    ));
  }, []);

  const handleVariableFieldChange = useCallback((key: SensitivityVariable, field: 'stdDev' | 'min' | 'max', value: number) => {
    setVariables(prev => prev.map(v =>
      v.key === key ? { ...v, [field]: value } : v
    ));
  }, []);

  const handleRun = useCallback(() => {
    setRunning(true);
    // Use setTimeout to let the UI update before heavy computation
    setTimeout(() => {
      const config: MonteCarloConfig = {
        scenarioCount,
        seed,
        variables,
      };
      const result = runMonteCarloSimulation(input, effectiveRate, config);
      setMcResult(result);
      setRunning(false);
    }, 10);
  }, [input, effectiveRate, scenarioCount, seed, variables]);

  return (
    <article className="space-y-6">
      {/* Info banner */}
      <section className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {t('costCalculator.monteCarlo.infoBanner')}
        </p>
      </section>

      {/* Config panel */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">{t('costCalculator.monteCarlo.configTitle')}</h3>

        <fieldset className="flex gap-4 items-end">
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.monteCarlo.scenarios')} tooltip={t('costCalculator.monteCarlo.scenariosTooltip')} />
            <Input
              type="number"
              value={scenarioCount}
              onChange={e => setScenarioCount(Math.max(100, Math.min(50000, Number(e.target.value))))}
              className="w-28 h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.monteCarlo.seed')} tooltip={t('costCalculator.monteCarlo.seedTooltip')} />
            <Input
              type="number"
              value={seed}
              onChange={e => setSeed(Number(e.target.value))}
              className="w-24 h-8 text-xs"
            />
          </div>
          <Button onClick={handleRun} disabled={running} size="sm" className="gap-1">
            {running ? <Dices className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? t('costCalculator.monteCarlo.running') : t('costCalculator.monteCarlo.runSimulation')}
          </Button>
        </fieldset>

        {/* Variable config */}
        <section className="space-y-2">
          <h4 className={cn("text-xs font-medium", colors.text.muted)}>{t('costCalculator.monteCarlo.variablesTitle')}</h4>
          <ul className="space-y-2">
            {variables.map(variable => (
              <li
                key={variable.key}
                className="flex items-center gap-3 flex-wrap rounded p-1 transition-colors hover:bg-muted/30 cursor-help"
                onMouseEnter={() => setHoveredItem({
                  source: 'config',
                  variable: variable.key,
                  field: 'main',
                  value: String(variable.mean),
                })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <Checkbox
                  checked={variable.enabled}
                  onCheckedChange={() => handleToggleVariable(variable.key)}
                  id={`mc-${variable.key}`}
                />
                <label htmlFor={`mc-${variable.key}`} className="text-xs font-medium w-32 cursor-pointer">
                  {getVariableLabel(variable.key, t)}
                </label>
                {variable.enabled && (
                  <>
                    <Select
                      value={variable.distribution}
                      onValueChange={(v) => handleDistributionChange(variable.key, v as MonteCarloDistribution)}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal" className="text-xs">{t('costCalculator.monteCarlo.normal')}</SelectItem>
                        <SelectItem value="triangular" className="text-xs">{t('costCalculator.monteCarlo.triangular')}</SelectItem>
                        <SelectItem value="uniform" className="text-xs">{t('costCalculator.monteCarlo.uniform')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {variable.distribution === 'normal' && (
                      <fieldset
                        className="flex gap-2 items-center"
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredItem({
                            source: 'config',
                            variable: variable.key,
                            field: 'stdDev',
                            value: String(variable.stdDev),
                          });
                        }}
                      >
                        <Label className="text-xs">{t('costCalculator.monteCarlo.stdDev')}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={variable.stdDev}
                          onChange={e => handleVariableFieldChange(variable.key, 'stdDev', Number(e.target.value))}
                          className="w-20 h-7 text-xs"
                        />
                      </fieldset>
                    )}
                    {(variable.distribution === 'triangular' || variable.distribution === 'uniform') && (
                      <fieldset className="flex gap-2 items-center">
                        <span
                          className="flex gap-2 items-center"
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            setHoveredItem({
                              source: 'config',
                              variable: variable.key,
                              field: 'min',
                              value: String(variable.min),
                            });
                          }}
                        >
                          <Label className="text-xs">{t('costCalculator.monteCarlo.min')}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={variable.min}
                            onChange={e => handleVariableFieldChange(variable.key, 'min', Number(e.target.value))}
                            className="w-20 h-7 text-xs"
                          />
                        </span>
                        <span
                          className="flex gap-2 items-center"
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            setHoveredItem({
                              source: 'config',
                              variable: variable.key,
                              field: 'max',
                              value: String(variable.max),
                            });
                          }}
                        >
                          <Label className="text-xs">{t('costCalculator.monteCarlo.max')}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={variable.max}
                            onChange={e => handleVariableFieldChange(variable.key, 'max', Number(e.target.value))}
                            className="w-20 h-7 text-xs"
                          />
                        </span>
                      </fieldset>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </section>

      {/* Results -- 3-column: results | dynamic+risk | glossary */}
      {mcResult && (
        <section className="grid lg:grid-cols-4 gap-6">
          {/* Left: statistics + charts */}
          <section className="lg:col-span-2 space-y-6">
            <header className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{t('costCalculator.monteCarlo.resultsTitle')}</h3>
              <Badge variant="secondary">{mcResult.scenarioCount.toLocaleString()} scenarios</Badge>
            </header>
            <StatisticsCard mcResult={mcResult} t={t} onHover={setHoveredItem} />
            <FanChart mcResult={mcResult} t={t} />
            <HistogramChart mcResult={mcResult} t={t} />
          </section>

          {/* Center: dynamic explanation + example + recommendation */}
          <DynamicHelpPanel hoveredItem={hoveredItem} mcResult={mcResult} input={input} effectiveRate={effectiveRate} t={t} />

          {/* Right: glossary */}
          <GlossaryPanel t={t} />
        </section>
      )}
    </article>
  );
}
