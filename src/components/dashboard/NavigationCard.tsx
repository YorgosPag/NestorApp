'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useIconSizes } from '@/hooks/useIconSizes';
import { COMPLEX_HOVER_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

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

const COLOR_MAP: Record<ColorVariant, { iconBg: string; iconText: string; ringHover: string }> = {
  blue: {
    iconBg: 'bg-blue-100 dark:bg-blue-950',
    iconText: 'text-blue-600 dark:text-blue-400',
    ringHover: 'group-hover:ring-blue-200 dark:group-hover:ring-blue-800',
  },
  green: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-950',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    ringHover: 'group-hover:ring-emerald-200 dark:group-hover:ring-emerald-800',
  },
  purple: {
    iconBg: 'bg-purple-100 dark:bg-purple-950',
    iconText: 'text-purple-600 dark:text-purple-400',
    ringHover: 'group-hover:ring-purple-200 dark:group-hover:ring-purple-800',
  },
  orange: {
    iconBg: 'bg-orange-100 dark:bg-orange-950',
    iconText: 'text-orange-600 dark:text-orange-400',
    ringHover: 'group-hover:ring-orange-200 dark:group-hover:ring-orange-800',
  },
  yellow: {
    iconBg: 'bg-amber-100 dark:bg-amber-950',
    iconText: 'text-amber-600 dark:text-amber-400',
    ringHover: 'group-hover:ring-amber-200 dark:group-hover:ring-amber-800',
  },
  pink: {
    iconBg: 'bg-pink-100 dark:bg-pink-950',
    iconText: 'text-pink-600 dark:text-pink-400',
    ringHover: 'group-hover:ring-pink-200 dark:group-hover:ring-pink-800',
  },
  indigo: {
    iconBg: 'bg-indigo-100 dark:bg-indigo-950',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    ringHover: 'group-hover:ring-indigo-200 dark:group-hover:ring-indigo-800',
  },
  teal: {
    iconBg: 'bg-teal-100 dark:bg-teal-950',
    iconText: 'text-teal-600 dark:text-teal-400',
    ringHover: 'group-hover:ring-teal-200 dark:group-hover:ring-teal-800',
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
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {description}
          </p>

          {subItemCount != null && subItemCount > 0 && (
            <footer className="mt-3 pt-2 border-t border-border/50">
              <span className="text-[11px] text-muted-foreground">
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
