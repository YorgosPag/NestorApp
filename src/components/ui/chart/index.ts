"use client"

/**
 * @module ui/chart
 * @enterprise ADR-710 — Single chart primitive surface.
 *
 * This barrel is the ONE public entry point for the recharts primitives.
 * Historically a sibling `src/components/ui/chart.tsx` existed and shadowed this
 * directory (a file beats a directory in module resolution), so `@/components/ui/chart`
 * silently resolved to that file. It re-declared `<ChartContext.Provider>` around a
 * `<ChartContainer>` that already provides one — a nested double provider plus a
 * duplicated `useId`/`chartId` derivation. It was deleted in ADR-710; every export it
 * carried is listed below, so the import path is unchanged for consumers.
 *
 * Exports are explicit rather than `export *`: the previous star re-exports declared
 * `ChartTooltipContent`/`ChartLegendContent` from two modules each, which is legal only
 * because both paths happen to resolve to the same binding.
 */

export { ChartContainer, ChartTooltip, ChartLegend } from "./ChartContainer"
export { ChartTooltipContent } from "./ChartTooltip"
export { ChartLegendContent } from "./ChartLegend"
export { ChartStyle } from "./ChartStyle"
export { ChartContext, useChart, THEMES, type ChartConfig } from "./ChartContext"
export { getPayloadConfigFromPayload } from "./chartHelpers"
