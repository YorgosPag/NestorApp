"use client";

/**
 * @module ReportSection
 * @enterprise ADR-265 — Collapsible report section with error boundary
 *
 * Each section is wrapped in an ErrorBoundary for graceful degradation
 * (Decision 12.21). If one section fails, the rest continue working.
 */

import "@/lib/design-system";
import { useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { useSemanticColors } from "@/hooks/useSemanticColors";

import { useTypography } from "@/hooks/useTypography";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { SurfaceBoundary, useHeadingTag } from "@/components/ui/surface-context";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { EnterpriseErrorBoundary as ErrorBoundary } from "@/components/ui/ErrorBoundary/ErrorBoundary";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportSectionProps {
  /** Section title */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Start expanded (default: true) */
  defaultOpen?: boolean;
  /** Allow collapse (default: true) */
  collapsible?: boolean;
  /** Section content */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Anchor ID for deep linking */
  id?: string;
  /** Info tooltip shown next to the section title */
  tooltip?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportSection({
  title,
  description,
  defaultOpen = true,
  collapsible = true,
  children,
  className,
  id,
  tooltip,
}: ReportSectionProps) {
  const { t } = useTranslation("reports");
  const colors = useSemanticColors();
  const typography = useTypography();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const headingId = useId();
  const sectionId = id ?? headingId;
  // Read before `SurfaceBoundary` deepens the tree, so the title sits at the level of
  // the region it names rather than one below it.
  const Heading = useHeadingTag();

  const headerContent = (
    <header className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-1.5">
          <Heading
            id={sectionId}
            className={cn(typography.heading.h4, colors.text.primary)}
          >
            {title}
          </Heading>
          {tooltip && <InfoTooltip content={tooltip} side="bottom" />}
        </div>
        {description && (
          <p className={cn("mt-0.5", typography.body.sm, colors.text.muted)}>
            {description}
          </p>
        )}
      </div>
      {collapsible && (
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 transition-transform duration-200",
            colors.text.muted,
            isOpen && "rotate-180",
          )}
        />
      )}
    </header>
  );

  // `SurfaceBoundary` is what makes the nesting defect unwritable: this section owns a
  // card and has just spent a heading, so anything inside that would draw its own card
  // (`ChartCard`) throws and names `ChartPlot` as the fix. See `ui/surface-context.tsx`.
  const content = (
    <ErrorBoundary>
      <SurfaceBoundary>
        <div className="pt-2">{children}</div>
      </SurfaceBoundary>
    </ErrorBoundary>
  );

  if (!collapsible) {
    return (
      <Card className={cn("overflow-visible", className)}>
        <CardContent className="p-2" role="region" aria-labelledby={sectionId}>
          {headerContent}
          {content}
        </CardContent>
      </Card>
    );
  }

  // Collapsible path — InfoTooltip rendered outside CollapsibleTrigger
  // (button-in-button is invalid HTML per spec)
  const triggerHeader = (
    <header className="flex items-center justify-between">
      <div>
        <Heading
          id={sectionId}
          className={cn(typography.heading.h4, colors.text.primary)}
        >
          {title}
        </Heading>
        {description && (
          <p className={cn("mt-0.5", typography.body.sm, colors.text.muted)}>
            {description}
          </p>
        )}
      </div>
      <ChevronDown
        className={cn(
          "h-5 w-5 shrink-0 transition-transform duration-200",
          colors.text.muted,
          isOpen && "rotate-180",
        )}
      />
    </header>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
      <Card className={cn("overflow-visible", className)}>
        <section aria-labelledby={sectionId}>
          <CardContent className="p-2">
            <div className="flex items-center gap-1">
              <CollapsibleTrigger
                className="flex-1 cursor-pointer"
                aria-label={isOpen ? t("section.collapse") : t("section.expand")}
              >
                {triggerHeader}
              </CollapsibleTrigger>
              {tooltip && <InfoTooltip content={tooltip} side="bottom" />}
            </div>
            <CollapsibleContent>{content}</CollapsibleContent>
          </CardContent>
        </section>
      </Card>
    </Collapsible>
  );
}
