'use client';
import * as React from "react";
import { useChart } from "../../ChartContext";
import { resolveItemConfig } from "../utils/payloadConfig";
import type { TooltipPayloadItem, TooltipPayload } from "../types";

export function useTooltipLabel({
  hideLabel, payload, labelKey, label,
  labelFormatter, labelClassName,
}: {
  hideLabel?: boolean;
  payload?: TooltipPayload;
  labelKey?: string;
  label?: string;
  labelFormatter?: (value: React.ReactNode, payload: TooltipPayload) => React.ReactNode;
  labelClassName?: string;
}) {
  const { config } = useChart();

  return React.useMemo(() => {
    if (hideLabel || !payload?.length) return null;

    const [item] = payload;
    const key = `${labelKey || item.dataKey || item.name || "value"}`;
    const itemConfig = resolveItemConfig(config, item, key);
    const value =
      !labelKey && typeof label === "string"
        ? (config as Record<string, { label?: string }>)[label]?.label || label
        : itemConfig?.label;

    if (labelFormatter) {
      return { value, className: labelClassName, formatter: labelFormatter };
    }
    if (!value) return null;
    return { value, className: labelClassName, formatter: null };
  }, [hideLabel, payload, labelKey, label, labelFormatter, labelClassName, config]);
}
