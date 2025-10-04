'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import * as React from 'react';

interface RangeSliderProps {
  icon: React.ReactNode;
  label: string;
  values: [number, number];
  onValueChange: (values: number[]) => void;
  min: number;
  max: number;
  step: number;
  leftText: string;
  rightText: string;
}

/**
 * Αποδίδει ακριβώς το markup του αρχικού Range section (Label + inner px-2, Slider, display row).
 */
export function RangeSlider({
  icon,
  label,
  values,
  onValueChange,
  min,
  max,
  step,
  leftText,
  rightText,
}: RangeSliderProps) {
  return (
    <>
      <Label className="text-sm font-medium flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <div className="px-2">
        <Slider
          value={values}
          onValueChange={onValueChange}
          max={max}
          min={min}
          step={step}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{leftText}</span>
          <span>{rightText}</span>
        </div>
      </div>
    </>
  );
}
