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

export interface ChartTooltipLabelProps {
  hideLabel?: boolean;
  label?: string;
  labelFormatter?: (value: React.ReactNode, payload: TooltipPayload) => React.ReactNode;
  labelClassName?: string;
  payload?: TooltipPayload;
  labelKey?: string;
}

export interface ChartTooltipItemProps {
  item: TooltipPayloadItem;
  index: number;
  payload?: TooltipPayload;
  formatter?: (
    value: number | string,
    name: string,
    item: TooltipPayloadItem,
    index: number,
    payload: TooltipPayload
  ) => React.ReactNode;
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
  labelFormatter?: (value: React.ReactNode, payload: TooltipPayload) => React.ReactNode;
  labelClassName?: string;
  formatter?: (
    value: number | string,
    name: string,
    item: TooltipPayloadItem,
    index: number,
    payload: TooltipPayload
  ) => React.ReactNode;
  color?: string;
  nameKey?: string;
  labelKey?: string;
};

export type Cfg = ChartConfig;
