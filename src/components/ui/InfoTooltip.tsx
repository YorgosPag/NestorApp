"use client";

/**
 * @module InfoTooltip
 * @enterprise SSoT — Reusable info icon with tooltip
 *
 * Small (ℹ) icon that shows a detailed tooltip on hover.
 * Uses the centralized Radix Tooltip from @/components/ui/tooltip.
 *
 * Usage:
 *   <InfoTooltip content="Explanation text here" />
 *   <InfoTooltip content={t('tooltips.spi')} side="bottom" />
 */

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "@/lib/design-system";

interface InfoTooltipProps {
  /** Tooltip text content */
  content: string;
  /** Tooltip placement side */
  side?: "top" | "right" | "bottom" | "left";
  /** Icon size class (default: h-3.5 w-3.5) */
  iconClassName?: string;
  /** Max width of tooltip (default: max-w-xs) */
  maxWidth?: string;
  /** Additional class on the trigger wrapper */
  className?: string;
}

export function InfoTooltip({
  content,
  side = "top",
  iconClassName,
  maxWidth = "max-w-xs",
  className,
}: InfoTooltipProps) {
  if (!content) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "text-muted-foreground/60 hover:text-muted-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
          aria-label={content}
        >
          <Info className={cn("h-3.5 w-3.5", iconClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn(maxWidth, "text-xs leading-relaxed whitespace-pre-line")}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
