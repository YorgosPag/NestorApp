'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { VolumeBreakpoint } from '@/subapps/procurement/types/framework-agreement';

interface BreakpointsEditorProps {
  breakpoints: VolumeBreakpoint[];
  onChange: (next: VolumeBreakpoint[]) => void;
}

export function BreakpointsEditor({ breakpoints, onChange }: BreakpointsEditorProps) {
  const { t } = useTranslation('procurement');

  function add() {
    onChange([...breakpoints, { thresholdEur: 0, discountPercent: 0 }]);
  }

  function remove(index: number) {
    onChange(breakpoints.filter((_, i) => i !== index));
  }

  function update(index: number, patch: Partial<VolumeBreakpoint>) {
    onChange(
      breakpoints.map((bp, i) => (i === index ? { ...bp, ...patch } : bp)),
    );
  }

  return (
    <fieldset className="space-y-2 border rounded-md p-3">
      <legend className="text-sm font-medium px-1">
        {t('hub.frameworkAgreements.form.breakpoints')}
      </legend>

      {breakpoints.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {t('hub.frameworkAgreements.form.breakpointsEmpty')}
        </p>
      )}

      {breakpoints.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Label className="text-xs">
            {t('hub.frameworkAgreements.form.thresholdEur')}
          </Label>
          <Label className="text-xs">
            {t('hub.frameworkAgreements.form.discountPercent')}
          </Label>
          <span className="w-9" aria-hidden />
          {breakpoints.map((bp, i) => (
            <BreakpointRow
              key={i}
              breakpoint={bp}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
              removeLabel={t('hub.frameworkAgreements.form.removeBreakpoint')}
            />
          ))}
        </div>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" aria-hidden />
        {t('hub.frameworkAgreements.form.addBreakpoint')}
      </Button>
    </fieldset>
  );
}

interface BreakpointRowProps {
  breakpoint: VolumeBreakpoint;
  onChange: (patch: Partial<VolumeBreakpoint>) => void;
  onRemove: () => void;
  removeLabel: string;
}

function BreakpointRow({ breakpoint, onChange, onRemove, removeLabel }: BreakpointRowProps) {
  return (
    <>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={breakpoint.thresholdEur}
        onChange={(e) => onChange({ thresholdEur: Number(e.target.value) })}
      />
      <Input
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={breakpoint.discountPercent}
        onChange={(e) => onChange({ discountPercent: Number(e.target.value) })}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        aria-label={removeLabel}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </>
  );
}
