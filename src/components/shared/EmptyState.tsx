'use client';

/**
 * =============================================================================
 * CENTRALIZED EMPTY STATE COMPONENT
 * =============================================================================
 *
 * Generic, reusable empty state for lists, panels, and detail views.
 * Replaces 7+ scattered EmptyState implementations with a single,
 * composable component that follows enterprise standards.
 *
 * Features:
 * - Semantic HTML (section with role="status")
 * - Accessibility (ARIA labels, aria-live)
 * - Flexible icon support (LucideIcon or React component)
 * - Optional action button
 * - Three sizes: sm, md, lg
 * - Card variant for embedded contexts
 *
 * @module components/shared/EmptyState
 * @enterprise ADR-203 pattern — centralized reusable component
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmptyStateAction {
  /** Button label text */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Show Plus icon before label (default: true) */
  showPlusIcon?: boolean;
  /** Disable the action button */
  disabled?: boolean;
}

export interface EmptyStateProps {
  /** Icon component (LucideIcon or custom React component) */
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  /** Icon color class (e.g., 'text-blue-500') — defaults to 'text-muted-foreground' */
  iconColor?: string;
  /** Primary message */
  title: string;
  /** Secondary description */
  description?: string;
  /** Optional action button */
  action?: EmptyStateAction;
  /** Size preset: sm (compact inline), md (standard), lg (full-page) */
  size?: 'sm' | 'md' | 'lg';
  /** Wrap in a Card component */
  variant?: 'plain' | 'card';
  /** Additional className for the root element */
  className?: string;
}

// ─── Size Configuration ──────────────────────────────────────────────────────

interface SizeConfig {
  iconSize: string;
  titleClass: string;
  descriptionClass: string;
  padding: string;
  gap: string;
}

function useSizeConfig(size: 'sm' | 'md' | 'lg', iconSizes: ReturnType<typeof useIconSizes>): SizeConfig {
  switch (size) {
    case 'sm':
      return {
        iconSize: iconSizes.lg,
        titleClass: 'text-sm font-medium text-foreground',
        descriptionClass: 'text-xs text-muted-foreground',
        padding: 'py-4 px-2',
        gap: 'mb-1',
      };
    case 'lg':
      return {
        iconSize: iconSizes.xl4,
        titleClass: 'text-xl font-semibold text-foreground',
        descriptionClass: 'text-sm text-muted-foreground',
        padding: 'py-12 px-4',
        gap: 'mb-4',
      };
    case 'md':
    default:
      return {
        iconSize: iconSizes.xl2,
        titleClass: 'text-base font-semibold text-foreground',
        descriptionClass: 'text-sm text-muted-foreground',
        padding: 'py-8 px-4',
        gap: 'mb-2',
      };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon: IconComponent,
  iconColor = 'text-muted-foreground',
  title,
  description,
  action,
  size = 'md',
  variant = 'plain',
  className,
}: EmptyStateProps) {
  const iconSizes = useIconSizes();
  const sizeConfig = useSizeConfig(size, iconSizes);

  const content = (
    <section
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sizeConfig.padding,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {IconComponent && (
        <IconComponent
          className={cn(sizeConfig.iconSize, iconColor, sizeConfig.gap, 'mx-auto')}
          aria-hidden="true"
        />
      )}
      <p className={sizeConfig.titleClass}>{title}</p>
      {description && (
        <p className={cn(sizeConfig.descriptionClass, 'mt-1')}>{description}</p>
      )}
      {action && (
        <Button
          type="button"
          variant="outline"
          onClick={action.onClick}
          disabled={action.disabled}
          className="mt-4"
        >
          {(action.showPlusIcon !== false) && (
            <Plus className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
          )}
          {action.label}
        </Button>
      )}
    </section>
  );

  if (variant === 'card') {
    return (
      <Card>
        <CardContent className="p-0">
          {content}
        </CardContent>
      </Card>
    );
  }

  return content;
}

export default EmptyState;
