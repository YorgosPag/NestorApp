'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';
import { useCalibration } from '../hooks/useCalibration';
import type { CalibrationUnit } from '../providers/types';

const UNITS: CalibrationUnit[] = ['m', 'cm', 'mm', 'ft', 'in'];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Self-contained dialog — reads calibration session from store.
 * Opens automatically when both canvas points are picked.
 * Mount once in DxfViewerContent alongside ReplaceConfirmDialog.
 */
export function CalibrationDialog() {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const [realDist, setRealDist] = useState('');
  const [unit, setUnit] = useState<CalibrationUnit>('m');
  const [deriveRotation, setDeriveRotation] = useState(false);

  const session = useFloorplanBackgroundStore((s) => s.calibrationSession);
  const floorId = session?.floorId ?? '';

  const background = useFloorplanBackgroundStore(
    useShallow((s) => (floorId ? (s.floors[floorId]?.background ?? null) : null)),
  );

  const calibration = useCalibration(floorId);
  const open = !!(session?.pointA && session?.pointB);

  const reset = () => {
    setRealDist('');
    setDeriveRotation(false);
  };

  const handleApply = () => {
    const dist = parseFloat(realDist);
    if (isNaN(dist) || dist <= 0 || !background) return;
    calibration.applyCalibration(dist, unit, deriveRotation, background.transform);
    reset();
  };

  const handleCancel = () => {
    calibration.cancelCalibration();
    reset();
  };

  const isApplyDisabled = !realDist || parseFloat(realDist) <= 0;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('panels.floorplanBackground.calibration.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('panels.floorplanBackground.calibration.pixelDist', {
              dist: calibration.pixelDist.toFixed(1),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <CalibrationForm
          realDist={realDist}
          unit={unit}
          deriveRotation={deriveRotation}
          onRealDistChange={setRealDist}
          onUnitChange={setUnit}
          onDeriveRotationChange={setDeriveRotation}
          t={t}
        />

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {t('panels.floorplanBackground.calibration.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleApply} disabled={isApplyDisabled}>
            {t('panels.floorplanBackground.calibration.apply')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface CalibrationFormProps {
  realDist: string;
  unit: CalibrationUnit;
  deriveRotation: boolean;
  onRealDistChange: (v: string) => void;
  onUnitChange: (v: CalibrationUnit) => void;
  onDeriveRotationChange: (v: boolean) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function CalibrationForm({
  realDist, unit, deriveRotation,
  onRealDistChange, onUnitChange, onDeriveRotationChange, t,
}: CalibrationFormProps) {
  return (
    <section className="space-y-4 py-2">
      <fieldset className="flex items-center gap-3">
        <Label htmlFor="cal-real-dist" className="shrink-0 text-sm">
          {t('panels.floorplanBackground.calibration.realDist')}
        </Label>
        <Input
          id="cal-real-dist"
          type="number"
          min="0.001"
          step="0.001"
          value={realDist}
          onChange={(e) => onRealDistChange(e.target.value)}
          className="flex-1"
          placeholder="e.g. 5"
        />
        <Select value={unit} onValueChange={(v) => onUnitChange(v as CalibrationUnit)}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>
      <fieldset className="flex items-center gap-2">
        <Checkbox
          id="cal-derive-rotation"
          checked={deriveRotation}
          onCheckedChange={(c) => onDeriveRotationChange(c === true)}
        />
        <Label htmlFor="cal-derive-rotation" className="text-sm cursor-pointer">
          {t('panels.floorplanBackground.calibration.deriveRotation')}
        </Label>
      </fieldset>
    </section>
  );
}
