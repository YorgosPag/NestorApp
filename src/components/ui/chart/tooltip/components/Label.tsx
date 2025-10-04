'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { useTooltipLabel } from "../hooks/useTooltipLabel";
import type { ChartTooltipLabelProps, TooltipPayload } from "../types";

export const ChartTooltipLabel: React.FC<ChartTooltipLabelProps> = (props) => {
  const data = useTooltipLabel(props);
  if (!data) return null;

  if (data.formatter) {
    return <div className={cn("font-medium", data.className)}>{data.formatter(data.value, props.payload! as TooltipPayload)}</div>;
  }
  return <div className={cn("font-medium", data.className)}>{data.value}</div>;
};
ChartTooltipLabel.displayName = "ChartTooltipLabel";
