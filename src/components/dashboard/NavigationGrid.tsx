'use client';

import type { LucideIcon } from 'lucide-react';
import { NavigationCard, type ColorVariant } from './NavigationCard';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

// ============================================================================
// Navigation Grid — Responsive CSS Grid wrapper for tiles (ADR-179)
// ============================================================================

export interface NavigationTile {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  badge?: string | null;
  colorVariant: ColorVariant;
  subItemCount?: number;
}

interface NavigationGridProps {
  sectionLabel: string;
  tiles: NavigationTile[];
}

export function NavigationGrid({ sectionLabel, tiles }: NavigationGridProps) {
  const colors = useSemanticColors();
  if (tiles.length === 0) return null;

  return (
    <section aria-label={sectionLabel} className="mb-8">
      <h2 className={cn("text-sm font-medium mb-4", colors.text.muted)}>
        {sectionLabel}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <NavigationCard
            key={tile.href}
            title={tile.title}
            description={tile.description}
            icon={tile.icon}
            href={tile.href}
            badge={tile.badge}
            colorVariant={tile.colorVariant}
            subItemCount={tile.subItemCount}
          />
        ))}
      </div>
    </section>
  );
}
