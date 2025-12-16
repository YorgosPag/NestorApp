"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useChart } from "./ChartContext"
import { getPayloadConfigFromPayload } from "./chartHelpers"
import {
  getLegendContainerStyles,
  getLegendItemStyles,
  type ChartLegendProps,
  type ChartPayloadItem
} from "./ChartComponents.styles"
import { layoutUtilities } from '@/styles/design-tokens';

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & ChartLegendProps
>(
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={getLegendContainerStyles(verticalAlign)}
      >
        {payload.map((item: ChartPayloadItem) => {
          const key = `${nameKey || item.dataKey || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div
              key={item.value}
              className={cn(
                "[&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
              style={getLegendItemStyles()}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="shrink-0 rounded-[2px]"
                  style={layoutUtilities.dxf.colors.backgroundColor(item.color)}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegend"

export { ChartLegendContent }
