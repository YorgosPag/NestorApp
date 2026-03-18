'use client';

/**
 * InfoLabel & InfoTableHead — Reusable tooltip wrappers
 *
 * Encapsulate the Radix Tooltip boilerplate so consuming files
 * (which often import `Tooltip` from recharts) don't need a second import.
 *
 * @enterprise ADR-242 — Comprehensive Tooltips
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { TableHead } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// =============================================================================
// InfoLabel — Label + HelpCircle icon + Tooltip
// =============================================================================

interface InfoLabelProps {
  htmlFor?: string;
  label: string;
  tooltip: string;
  className?: string;
}

export function InfoLabel({ htmlFor, label, tooltip, className }: InfoLabelProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <Label htmlFor={htmlFor} className={className ?? 'text-xs'}>
        {label}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

// =============================================================================
// InfoTableHead — TableHead + dashed underline + Tooltip
// =============================================================================

interface InfoTableHeadProps {
  label: string;
  tooltip: string;
  className?: string;
}

export function InfoTableHead({ label, tooltip, className }: InfoTableHeadProps) {
  return (
    <TableHead className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dashed border-muted-foreground">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TableHead>
  );
}

// =============================================================================
// InfoDt — <dt> with dashed underline + Tooltip (for definition lists)
// =============================================================================

interface InfoDtProps {
  label: string;
  tooltip: string;
  className?: string;
}

export function InfoDt({ label, tooltip, className }: InfoDtProps) {
  return (
    <dt className={className ?? 'text-muted-foreground'}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dashed border-muted-foreground">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </dt>
  );
}
