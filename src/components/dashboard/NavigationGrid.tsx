'use client';

import type { LucideIcon } from 'lucide-react';
import { NavigationCard, type ColorVariant } from './NavigationCard';

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
  if (tiles.length === 0) return null;

  return (
    <section aria-label={sectionLabel} className="mb-8">
      <h2 className="text-sm font-medium text-muted-foreground mb-4">
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
