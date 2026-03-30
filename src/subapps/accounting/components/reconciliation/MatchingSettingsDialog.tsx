/**
 * @fileoverview MatchingSettingsDialog Component (Phase 2d)
 * @description Dialog with 3 threshold sliders + 4 weight sliders for matching config
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q2 (Configurable thresholds)
 * @compliance CLAUDE.md Enterprise Standards — semantic HTML, no inline styles
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, Save, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import type { MatchingConfig, MatchingThresholds, MatchingScoringWeights } from '@/subapps/accounting/types';

interface MatchingSettingsDialogProps {
  config: MatchingConfig;
  onSave: (config: MatchingConfig) => Promise<boolean>;
  saving: boolean;
}

export function MatchingSettingsDialog({
  config,
  onSave,
  saving,
}: MatchingSettingsDialogProps) {
  const { t } = useTranslation('accounting');
  const [open, setOpen] = useState(false);
  const [thresholds, setThresholds] = useState<MatchingThresholds>(config.thresholds);
  const [weights, setWeights] = useState<MatchingScoringWeights>(config.weights);

  useEffect(() => {
    setThresholds(config.thresholds);
    setWeights(config.weights);
  }, [config]);

  const weightSum = weights.amount + weights.description + weights.currency + weights.date;
  const isWeightValid = Math.abs(weightSum - 1.0) < 0.01;
  const isThresholdValid =
    thresholds.autoMatchThreshold > thresholds.suggestThreshold &&
    thresholds.suggestThreshold > thresholds.manualThreshold;
  const canSave = isWeightValid && isThresholdValid;

  const handleSave = async () => {
    const newConfig: MatchingConfig = {
      ...config,
      thresholds,
      weights,
    };
    const success = await onSave(newConfig);
    if (success) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-1" />
          {t('reconciliation.settings')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reconciliation.settingsTitle')}</DialogTitle>
        </DialogHeader>

        {/* Thresholds Section */}
        <section className="space-y-4">
          <h4 className="text-sm font-semibold">{t('reconciliation.thresholdsSection')}</h4>
          <ThresholdSlider
            label={t('reconciliation.thresholds.auto')}
            value={thresholds.autoMatchThreshold}
            min={70}
            max={100}
            onChange={(v) => setThresholds((p) => ({ ...p, autoMatchThreshold: v }))}
            variant="success"
          />
          <ThresholdSlider
            label={t('reconciliation.thresholds.suggest')}
            value={thresholds.suggestThreshold}
            min={50}
            max={thresholds.autoMatchThreshold - 1}
            onChange={(v) => setThresholds((p) => ({ ...p, suggestThreshold: v }))}
            variant="info"
          />
          <ThresholdSlider
            label={t('reconciliation.thresholds.manual')}
            value={thresholds.manualThreshold}
            min={30}
            max={thresholds.suggestThreshold - 1}
            onChange={(v) => setThresholds((p) => ({ ...p, manualThreshold: v }))}
            variant="warning"
          />
        </section>

        {/* Weights Section */}
        <section className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{t('reconciliation.weightsSection')}</h4>
            <Badge variant={isWeightValid ? 'success' : 'destructive'}>
              {(weightSum * 100).toFixed(0)}%
            </Badge>
          </div>
          <WeightSlider
            label={t('reconciliation.weights.description')}
            value={weights.description}
            onChange={(v) => setWeights((p) => ({ ...p, description: v }))}
          />
          <WeightSlider
            label={t('reconciliation.weights.amount')}
            value={weights.amount}
            onChange={(v) => setWeights((p) => ({ ...p, amount: v }))}
          />
          <WeightSlider
            label={t('reconciliation.weights.currency')}
            value={weights.currency}
            onChange={(v) => setWeights((p) => ({ ...p, currency: v }))}
          />
          <WeightSlider
            label={t('reconciliation.weights.date')}
            value={weights.date}
            onChange={(v) => setWeights((p) => ({ ...p, date: v }))}
          />
          {!isWeightValid && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {t('reconciliation.weights.sumError')}
            </p>
          )}
        </section>

        {/* Actions */}
        <footer className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            <Save className="h-4 w-4 mr-1" />
            {t('reconciliation.saveSettings')}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ThresholdSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  variant: 'success' | 'info' | 'warning';
}

function ThresholdSlider({ label, value, min, max, onChange, variant }: ThresholdSliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <Badge variant={variant} className="text-[10px]">{value}%</Badge>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

interface WeightSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function WeightSlider({ label, value, onChange }: WeightSliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono">{(value * 100).toFixed(0)}%</span>
      </div>
      <Slider
        value={[value * 100]}
        min={0}
        max={100}
        step={5}
        onValueChange={([v]) => onChange(v / 100)}
      />
    </div>
  );
}
