'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useIconSizes } from '@/hooks/useIconSizes';
import { COMPLEX_HOVER_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n';
import '@/lib/design-system';

// ============================================================================
// Navigation Card — SAP Fiori-inspired tile for Dashboard Home (ADR-179)
// ============================================================================

type ColorVariant = 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'pink' | 'indigo' | 'teal';

interface NavigationCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  badge?: string | null;
  colorVariant: ColorVariant;
  subItemCount?: number;
}

// ✅ ADR-365 follow-up: each tile = soft tinted chip + VIVID colored icon (SAP Fiori).
// Reuse vivid theme-aware SSoT vars (--text-*/--status-*/--hue-*); never dark navy icons.
const COLOR_MAP: Record<ColorVariant, { iconBg: string; iconText: string; ringHover: string }> = {
  blue: {
    iconBg: 'bg-[hsl(var(--bg-info))]/20',
    iconText: 'text-[hsl(var(--text-info))]',
    ringHover: 'group-hover:ring-[hsl(var(--text-info))]',
  },
  green: {
    iconBg: 'bg-[hsl(var(--bg-success))]/10',
    iconText: 'text-[hsl(var(--text-success))]',
    ringHover: 'group-hover:ring-[hsl(var(--text-success))]',
  },
  purple: {
    iconBg: 'bg-[hsl(var(--status-purple))]/12',
    iconText: 'text-[hsl(var(--status-purple))]',
    ringHover: 'group-hover:ring-[hsl(var(--status-purple))]',
  },
  orange: {
    iconBg: 'bg-[hsl(var(--bg-warning))]/40',
    iconText: 'text-[hsl(var(--text-warning))]',
    ringHover: 'group-hover:ring-[hsl(var(--text-warning))]',
  },
  yellow: {
    iconBg: 'bg-[hsl(var(--bg-warning))]/40',
    iconText: 'text-[hsl(var(--text-warning))]',
    ringHover: 'group-hover:ring-[hsl(var(--text-warning))]',
  },
  pink: {
    iconBg: 'bg-[hsl(var(--hue-pink))]/12',
    iconText: 'text-[hsl(var(--hue-pink))]',
    ringHover: 'group-hover:ring-[hsl(var(--hue-pink))]',
  },
  indigo: {
    iconBg: 'bg-[hsl(var(--hue-indigo))]/12',
    iconText: 'text-[hsl(var(--hue-indigo))]',
    ringHover: 'group-hover:ring-[hsl(var(--hue-indigo))]',
  },
  teal: {
    iconBg: 'bg-[hsl(var(--hue-teal))]/12',
    iconText: 'text-[hsl(var(--hue-teal))]',
    ringHover: 'group-hover:ring-[hsl(var(--hue-teal))]',
  },
};

const BADGE_VARIANT_MAP: Record<string, 'info' | 'purple' | 'success'> = {
  PRO: 'info',
  ENTERPRISE: 'purple',
  ΝΕΟ: 'success',
  NEW: 'success',
};

export function NavigationCard({
  title,
  description,
  icon: Icon,
  href,
  badge,
  colorVariant,
  subItemCount,
}: NavigationCardProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('dashboard');
  const semanticColors = useSemanticColors();
  const colors = COLOR_MAP[colorVariant];

  return (
    <Link href={href} className="group focus-visible:outline-none">
      <Card
        className={cn(
          'relative cursor-pointer h-full',
          COMPLEX_HOVER_EFFECTS.FEATURE_CARD,
          'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2'
        )}
      >
        <CardContent className="p-5">
          <header className="flex items-start justify-between mb-3">
            <figure
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl ring-2 ring-transparent',
                colors.iconBg,
                colors.ringHover,
                TRANSITION_PRESETS.STANDARD_ALL
              )}
              aria-hidden="true"
            >
              <Icon className={cn(iconSizes.lg, colors.iconText)} />
            </figure>
            {badge && (
              <Badge variant={BADGE_VARIANT_MAP[badge] ?? 'info'} className="text-[10px] px-2 py-0.5">
                {badge}
              </Badge>
            )}
          </header>

          <h3 className="font-semibold text-sm leading-tight mb-1 text-foreground">
            {title}
          </h3>
          <p className={cn("text-xs leading-relaxed line-clamp-2", semanticColors.text.muted)}>
            {description}
          </p>

          {subItemCount != null && subItemCount > 0 && (
            <footer className="mt-3 pt-2 border-t border-border/50">
              <span className={cn("text-[11px]", semanticColors.text.muted)}>
                {t('home.subItems', { count: subItemCount })}
              </span>
            </footer>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export type { NavigationCardProps, ColorVariant };
