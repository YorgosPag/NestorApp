'use client';
import * as React from "react";
import { cn } from "@/lib/utils";

export function Indicator({
  show, indicator, color, hasIcon, Icon, nestLabel,
}: {
  show: boolean;
  indicator: "dot" | "line" | "dashed";
  color: string | undefined;
  hasIcon: boolean;
  Icon?: React.ComponentType<any>;
  nestLabel?: boolean;
}) {
  if (!show) return null;
  if (hasIcon && Icon) return <Icon />;

  return (
    <div
      className={cn(
        "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
        {
          "h-2.5 w-2.5": indicator === "dot",
          "w-1": indicator === "line",
          "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
          "my-0.5": nestLabel && indicator === "dashed",
        }
      )}
      style={
        { "--color-bg": color, "--color-border": color } as React.CSSProperties
      }
    />
  );
}
