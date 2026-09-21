'use client';

/**
 * @module ui/InfoLabel
 * @enterprise ADR-242 (Comprehensive Tooltips) · ADR-710 §8 #6 (promotion out of `sales/`)
 *
 * One gesture, three hosts: a term that can explain itself on hover or keyboard focus.
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
 *
 * ## Every trigger is a `<button>` — the explanation must be reachable without a mouse
 *
 * Until 2026-09-21 (ADR-598 G11) both triggers were inert: the help icon was a bare
 * `<svg>` and the underlined term a `<span>`. Radix opens a tooltip on hover **or
 * focus**, and neither element could take focus — so a keyboard or screen-reader user
 * never reached a single explanation (WCAG 2.1.1, 4.1.2). axe does not flag it (an
 * unfocusable element breaks no rule it can see); the fix follows the two systems that
 * ship exactly these gestures:
 * - **Fluent UI `InfoLabel`** — the icon is an `InfoButton`, named by the label it
 *   explains *and* its own "more information" (`aria-labelledby="label button"`).
 * - **Carbon `DefinitionTooltip`** — the underlined term itself is the `<button>`; its
 *   name is the term, the definition arrives as its description when shown.
 */

import { useId, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
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
        <button
          type="button"
          className={cn(
            'cursor-help border-b border-dashed border-current text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          {children}
        </button>
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
  const { t } = useTranslation('common');
  const labelId = useId();
  const buttonId = useId();

  return (
    <span className="inline-flex items-center gap-1">
      <Label id={labelId} htmlFor={htmlFor} className={className ?? 'text-xs'}>
        {label}
      </Label>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Named "<label> <more information>" — the Fluent InfoButton spelling, so
                five help buttons in one form are five different names, not five echoes. */}
            <button
              type="button"
              id={buttonId}
              aria-label={t('a11y.moreInfo')}
              aria-labelledby={`${labelId} ${buttonId}`}
              className="-my-1 inline-flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HelpCircle aria-hidden="true" className={cn('h-3.5 w-3.5', colors.text.muted)} />
            </button>
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
