'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";
import { ChartTooltipLabel } from "./components/Label";
import { ChartTooltipItem } from "./components/Item";
import type { ChartTooltipContentProps } from "./types";
import '@/lib/design-system';

// Recharts injects internal props at runtime that are not valid DOM attributes.
// Defined at module level to avoid recreation on every render.
const RECHARTS_INTERNAL_PROPS = new Set([
  // From Recharts Tooltip.defaultProps + TooltipProps interface (complete list)
  'accessibilityLayer', 'allowEscapeViewBox', 'animationBegin', 'animationDuration',
  'animationEasing', 'content', 'contentStyle', 'coordinate', 'cursor', 'cursorStyle',
  'defaultIndex', 'filterNull', 'includeHidden', 'isAnimationActive', 'itemSorter',
  'itemStyle', 'labelStyle', 'offset', 'payloadUniqBy', 'position', 'reverseDirection',
  'separator', 'shared', 'trigger', 'useTranslate3d', 'viewBox', 'wrapperStyle',
  'wrapperClassName',
]);

export const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
      ...rest
    },
    ref
  ) => {
    const colors = useSemanticColors();
    if (!active || !payload?.length) return null;
    const nestLabel = payload.length === 1 && indicator !== "dot";

    const domRest = Object.fromEntries(
      Object.entries(rest).filter(([k]) => !RECHARTS_INTERNAL_PROPS.has(k))
    );

    return (
      <div
        ref={ref}
        className={cn(
          `grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 ${colors.bg.primary} px-2.5 py-1.5 text-xs shadow-xl`,
          className
        )}
        {...domRest}
      >
        {!nestLabel ? (
          <ChartTooltipLabel
            hideLabel={hideLabel}
            label={label}
            labelFormatter={labelFormatter}
            labelClassName={labelClassName}
            payload={payload}
            labelKey={labelKey}
          />
        ) : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => (
            <ChartTooltipItem
              key={item.dataKey ?? String(index)}
              item={item}
              index={index}
              payload={payload}
              formatter={formatter}
              hideIndicator={hideIndicator}
              indicator={indicator}
              nameKey={nameKey}
              color={color}
              nestLabel={nestLabel}
            />
          ))}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltipContent";
