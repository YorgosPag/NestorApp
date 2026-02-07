'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { useChart } from "../../ChartContext";
import { resolveItemConfig } from "../utils/payloadConfig";
import { ChartTooltipLabel } from "./Label";
import { Indicator } from "./Indicator";
import type { ChartTooltipItemProps } from "../types";

export const ChartTooltipItem = React.memo(function ChartTooltipItemBase({
  item, index, payload, formatter, hideIndicator, indicator, nameKey, color, nestLabel,
}: ChartTooltipItemProps) {
  const { config } = useChart();
  const key = `${nameKey || item.name || item.dataKey || "value"}`;
  const itemConfig = resolveItemConfig(config, item, key);
  const payloadFill = typeof item.payload?.fill === "string" ? item.payload.fill : undefined;
  const indicatorColor = color || payloadFill || item.color;
  const payloadForFormatter = payload ?? [];

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
        indicator === "dot" && "items-center"
      )}
    >
      {formatter && item?.value !== undefined && item.name !== undefined ? (
        formatter(item.value, String(item.name), item, index, payloadForFormatter)
      ) : (
        <>
          <Indicator
            show={!hideIndicator}
            indicator={indicator!}
            color={indicatorColor}
            hasIcon={!!itemConfig?.icon}
            Icon={itemConfig?.icon}
            nestLabel={nestLabel}
          />
          <div
            className={cn(
              "flex flex-1 justify-between leading-none",
              nestLabel ? "items-end" : "items-center"
            )}
          >
            <div className="grid gap-1.5">
              {nestLabel && <ChartTooltipLabel />}
              <span className="text-muted-foreground">
                {itemConfig?.label || item.name}
              </span>
            </div>
            {typeof item.value === "number" && (
              <span className="font-mono font-medium tabular-nums text-foreground">
                {item.value.toLocaleString()}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
});
ChartTooltipItem.displayName = "ChartTooltipItem";
