"use client"

import * as React from "react"
import {
  ChartContainer,
  ChartTooltip as ChartPrimitiveTooltip,
  ChartTooltipContent,
  ChartLegend as ChartPrimitiveLegend,
  ChartLegendContent,
} from "./chart/ChartContainer"
import { ChartStyle } from "./chart/ChartStyle"
import { ChartContext, useChart, type ChartConfig } from "./chart/ChartContext"

const Chart = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<
      typeof ChartContainer
    >["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  // 🔧 FIX: Memoize context value to prevent infinite re-renders
  const contextValue = React.useMemo(() => ({ config }), [config]);

  return (
    <ChartContext.Provider value={contextValue}>
      <ChartContainer
        id={chartId}
        ref={ref}
        className={className}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {children}
      </ChartContainer>
    </ChartContext.Provider>
  )
})
Chart.displayName = "Chart"

const ChartTooltip = ChartPrimitiveTooltip
const ChartLegend = ChartPrimitiveLegend

export {
  Chart,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  useChart,
  type ChartConfig,
}
