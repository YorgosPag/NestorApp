"use client";
import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import type { RangeSliderProps } from "../types";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

export function RangeSlider({
  label,
  icon: Icon,
  min,
  max,
  step,
  value,
  onChange,
  formatLeft,
  formatRight,
}: RangeSliderProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [left, right] = value;
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        {Icon ? <Icon className={iconSizes.sm} /> : null}
        {label}
      </Label>
      <div className="px-2">
        <Slider
          value={[left, right]}
          onValueChange={(vals) => onChange([vals[0], vals[1]] as [number, number])}
          max={max}
          min={min}
          step={step}
          className="w-full"
        />
        <div className={cn("flex justify-between text-xs mt-1", colors.text.muted)}>
          <span>{formatLeft ? formatLeft(left) : left}</span>
          <span>{formatRight ? formatRight(right) : right}</span>
        </div>
      </div>
    </div>
  );
}
