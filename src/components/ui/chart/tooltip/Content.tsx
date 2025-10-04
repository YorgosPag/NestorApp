'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { ChartTooltipLabel } from "./components/Label";
import { ChartTooltipItem } from "./components/Item";
import type { ChartTooltipContentProps } from "./types";

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
    if (!active || !payload?.length) return null;
    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
        {...rest}
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
              key={item.dataKey}
              item={item}
              index={index}
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
