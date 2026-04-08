'use client';

/**
 * =============================================================================
 * SALES GRID CARD — SSoT for sales grid view cards
 * =============================================================================
 *
 * Shared card component for Properties, Parking, and Storage grid views.
 * Replaces 3 × ~40 identical lines across SalesAvailable*PageContent.tsx.
 *
 * @module SalesGridCard
 * @see ADR-294 (Dynamic Imports, TODO section)
 * @enterprise Google SSoT — single source of truth, zero duplicates
 */

import type { LucideIcon } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { formatCurrencyCompact, formatCurrencyWhole } from '@/lib/intl-utils';

// ============================================================================
// STATUS COLOR MAP — Domain-specific badge styling
// ============================================================================

/**
 * Maps commercial/availability status to Tailwind color classes.
 * Uses design-system tokens where available, domain-specific
 * colors (purple for reserved) where semantic tokens don't exist.
 */
const STATUS_COLORS: Record<string, string> = {
  'for-sale':  'bg-[hsl(var(--bg-success))]/50 text-green-700 dark:text-green-400',
  'available': 'bg-[hsl(var(--bg-success))]/50 text-green-700 dark:text-green-400',
  'reserved':  'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  'sold':      'bg-[hsl(var(--bg-error))]/50 text-red-700 dark:text-red-400',
};

const DEFAULT_STATUS_COLOR = 'bg-[hsl(var(--bg-info))]/50 text-blue-700 dark:text-blue-400';

// ============================================================================
// TYPES
// ============================================================================

export interface SalesGridCardProps {
  /** Unique item identifier */
  id: string;
  /** Lucide icon for the thumbnail placeholder */
  icon: LucideIcon;
  /** Display title (name, code, number, etc.) */
  title: string;
  /** Translated status label */
  statusLabel: string;
  /** Raw status value for color mapping */
  statusKey: string;
  /** Description line (type, area, zone, etc.) */
  description: string;
  /** Asking price (null = show dash) */
  price: number | null;
  /** Price per square meter (null = hide) */
  pricePerSqm: number | null;
  /** Click handler */
  onClick: (id: string) => void;
}

export interface SalesGridEmptyProps {
  /** Translated "no results" message */
  message: string;
}

// ============================================================================
// COMPONENTS
// ============================================================================

export function SalesGridCard({
  id,
  icon: Icon,
  title,
  statusLabel,
  statusKey,
  description,
  price,
  pricePerSqm,
  onClick,
}: SalesGridCardProps) {
  const colors = useSemanticColors();
  const statusColor = STATUS_COLORS[statusKey] ?? DEFAULT_STATUS_COLOR;

  return (
    <article
      key={id}
      onClick={() => onClick(id)}
      className="border border-border rounded-lg shadow-sm bg-card overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(id); }}
    >
      <div className="aspect-[16/10] bg-muted flex items-center justify-center">
        <Icon className={cn('h-8 w-8', colors.text.muted)} />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold truncate">{title}</span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded', statusColor)}>
            {statusLabel}
          </span>
        </div>
        <p className={cn('text-xs', colors.text.muted)}>{description}</p>
        <p className={cn('text-lg font-bold mt-1', colors.text.success)}>
          {price ? formatCurrencyCompact(price) : '—'}
        </p>
        {pricePerSqm ? (
          <p className={cn('text-xs', colors.text.muted)}>
            {formatCurrencyWhole(Math.round(pricePerSqm))}/m²
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function SalesGridEmpty({ message }: SalesGridEmptyProps) {
  const colors = useSemanticColors();
  return (
    <div className={cn('col-span-full p-6 text-center text-sm', colors.text.muted)}>
      {message}
    </div>
  );
}
