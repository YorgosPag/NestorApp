'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  getTooltipIndicatorStyles,
  type TooltipIndicatorType,
  type ChartTooltipConfig
} from "../../ChartComponents.styles";

export interface IndicatorProps {
  show: boolean;
  indicator: TooltipIndicatorType;
  color?: string;
  hasIcon: boolean;
  Icon?: React.ComponentType<{ className?: string }>;
  nestLabel?: boolean;
}

export function Indicator({
  show, indicator, color, hasIcon, Icon, nestLabel,
}: IndicatorProps) {
  if (!show) return null;
  if (hasIcon && Icon) return <Icon />;

  const indicatorStyles = getTooltipIndicatorStyles(indicator, color, nestLabel);

  return (
    <div
      className={cn(indicatorStyles.className)}
      style={{
        ...indicatorStyles,
        // Remove className from style object
        className: undefined
      } as React.CSSProperties}
    />
  );
}
