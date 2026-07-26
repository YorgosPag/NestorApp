'use client';
import * as React from "react";
import type { ChartConfig } from "../ChartContext";

// 🏢 ENTERPRISE: Proper type definition for chart tooltip payload items
export interface TooltipPayloadItem {
  value?: number | string;
  name?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
  color?: string;
  fill?: string;
  stroke?: string;
  unit?: string;
  formatter?: (value: number | string) => string;
}
export type TooltipPayload = TooltipPayloadItem[];

/** Renders the heading of the hover box. */
export type TooltipLabelFormatter = (
  value: React.ReactNode,
  payload: TooltipPayload
) => React.ReactNode;

/**
 * Replaces an entire row — swatch, series name and value.
 *
 * Reach for it only when the row itself must look different. A caller that merely
 * wants "€1.200" instead of `toLocaleString()` wants `TooltipValueFormatter`;
 * using this one for that silently deletes the series names, which is how a stack
 * of four ends up reading as four bare amounts.
 */
export type TooltipRowFormatter = (
  value: number | string,
  name: string,
  item: TooltipPayloadItem,
  index: number,
  payload: TooltipPayload
) => React.ReactNode;

/** Formats the number only, leaving the swatch and the series name in place. */
export type TooltipValueFormatter = (
  value: number,
  item: TooltipPayloadItem,
  index: number,
  payload: TooltipPayload
) => React.ReactNode;

export interface ChartTooltipLabelProps {
  hideLabel?: boolean;
  label?: string;
  labelFormatter?: TooltipLabelFormatter;
  labelClassName?: string;
  payload?: TooltipPayload;
  labelKey?: string;
}

export interface ChartTooltipItemProps {
  item: TooltipPayloadItem;
  index: number;
  payload?: TooltipPayload;
  formatter?: TooltipRowFormatter;
  valueFormatter?: TooltipValueFormatter;
  hideIndicator?: boolean;
  indicator?: "dot" | "line" | "dashed";
  nameKey?: string;
  color?: string;
  nestLabel?: boolean;
}

export type ChartTooltipContentProps = React.ComponentProps<"div"> & {
  active?: boolean;
  payload?: TooltipPayload;
  indicator?: "dot" | "line" | "dashed";
  hideLabel?: boolean;
  hideIndicator?: boolean;
  label?: string;
  labelFormatter?: TooltipLabelFormatter;
  labelClassName?: string;
  formatter?: TooltipRowFormatter;
  valueFormatter?: TooltipValueFormatter;
  color?: string;
  nameKey?: string;
  labelKey?: string;
};

export type Cfg = ChartConfig;
