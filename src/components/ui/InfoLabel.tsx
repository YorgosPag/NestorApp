'use client';

/**
 * @module ui/InfoLabel
 * @enterprise ADR-242 (Comprehensive Tooltips) · ADR-710 §8 #6 (promotion out of `sales/`)
 *
 * One gesture, three hosts: a term that can explain itself on hover.
 *
 * `InfoLabel` puts the explanation behind a help icon next to a form control;
 * `InfoTableHead` and `InfoDt` put it behind a dashed underline on the term itself,
 * because a column header and a definition term have no room for an extra icon.
 * All three share `InfoUnderlinedTerm`, so the affordance a reader learns in one
 * table means the same thing in the next.
 *
 * It lives in `ui/` rather than in a domain folder because the consumers span five
 * areas (projects, generic forms, property details, sales, and the chart-card shell).
 * The shell was the proof: it needed exactly this header and could not import it —
 * `ui/` → `components/sales/` is the wrong direction — so it grew a private copy.
 * That copy is now gone.
 *
 * The dashed rule is `border-current`: the underline follows the term's own colour,
 * so a destructive term is underlined in destructive rather than in grey.
 */

import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { TableHead } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// InfoUnderlinedTerm — the shared affordance
// =============================================================================

export interface InfoUnderlinedTermProps {
  /** The term as it reads in the running text. */
  readonly children: ReactNode;
  /** What the term means. Without it the term renders plain — no dead affordance. */
  readonly tooltip?: string;
  /** Extra classes on the term itself (weight, size). */
  readonly className?: string;
}

export function InfoUnderlinedTerm({ children, tooltip, className }: InfoUnderlinedTermProps) {
  if (!tooltip) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('cursor-help border-b border-dashed border-current', className)}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// =============================================================================
// InfoLabel — Label + HelpCircle icon + Tooltip
// =============================================================================

export interface InfoLabelProps {
  readonly htmlFor?: string;
  readonly label: ReactNode;
  readonly tooltip?: string;
  readonly className?: string;
}

export function InfoLabel({ htmlFor, label, tooltip, className }: InfoLabelProps) {
  const colors = useSemanticColors();

  return (
    <span className="inline-flex items-center gap-1">
      <Label htmlFor={htmlFor} className={className ?? 'text-xs'}>
        {label}
      </Label>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className={cn('h-3.5 w-3.5 cursor-help shrink-0', colors.text.muted)} />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}

// =============================================================================
// InfoTableHead — TableHead + dashed underline + Tooltip
// =============================================================================

export interface InfoTableHeadProps {
  readonly label: ReactNode;
  readonly tooltip?: string;
  readonly className?: string;
  /** Header cells default to `col`; pass `row` for a leading cell inside `<tbody>`. */
  readonly scope?: 'col' | 'row';
}

export function InfoTableHead({ label, tooltip, className, scope = 'col' }: InfoTableHeadProps) {
  return (
    <TableHead scope={scope} className={className}>
      <InfoUnderlinedTerm tooltip={tooltip}>{label}</InfoUnderlinedTerm>
    </TableHead>
  );
}

// =============================================================================
// InfoDt — <dt> with dashed underline + Tooltip (for definition lists)
// =============================================================================

export interface InfoDtProps {
  readonly label: ReactNode;
  readonly tooltip?: string;
  readonly className?: string;
}

export function InfoDt({ label, tooltip, className }: InfoDtProps) {
  const colors = useSemanticColors();

  return (
    <dt className={className ?? colors.text.muted}>
      <InfoUnderlinedTerm tooltip={tooltip}>{label}</InfoUnderlinedTerm>
    </dt>
  );
}
