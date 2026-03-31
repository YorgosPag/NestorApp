'use client';

/**
 * @module ReportSection
 * @enterprise ADR-265 — Collapsible report section with error boundary
 *
 * Each section is wrapped in an ErrorBoundary for graceful degradation
 * (Decision 12.21). If one section fails, the rest continue working.
 */

import '@/lib/design-system';
import { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/hooks/useSemanticColors';

import { useTypography } from '@/hooks/useTypography';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { EnterpriseErrorBoundary as ErrorBoundary } from '@/components/ui/ErrorBoundary/ErrorBoundary';
import { cn } from '@/lib/utils';

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
}: ReportSectionProps) {
  const { t } = useTranslation('reports');
  const colors = useSemanticColors();
  const typography = useTypography();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const headingId = useId();
  const sectionId = id ?? headingId;

  const headerContent = (
    <header className="flex items-center justify-between">
      <div>
        <h3
          id={sectionId}
          className={cn(typography.heading.h4, colors.text.primary)}
        >
          {title}
        </h3>
        {description && (
          <p className={cn('mt-0.5', typography.body.sm, colors.text.muted)}>
            {description}
          </p>
        )}
      </div>
      {collapsible && (
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 transition-transform duration-200',
            colors.text.muted,
            isOpen && 'rotate-180',
          )}
        />
      )}
    </header>
  );

  const content = (
    <ErrorBoundary>
      <div className="pt-4">{children}</div>
    </ErrorBoundary>
  );

  if (!collapsible) {
    return (
      <Card className={cn(className)}>
        <CardContent className="p-4 sm:p-6" role="region" aria-labelledby={sectionId}>
          {headerContent}
          {content}
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
      <Card className={cn(className)}>
        <section aria-labelledby={sectionId}>
          <CardContent className="p-4 sm:p-6">
            <CollapsibleTrigger
              className="w-full cursor-pointer"
              aria-label={isOpen ? t('section.collapse') : t('section.expand')}
            >
              {headerContent}
            </CollapsibleTrigger>
            <CollapsibleContent>{content}</CollapsibleContent>
          </CardContent>
        </section>
      </Card>
    </Collapsible>
  );
}
