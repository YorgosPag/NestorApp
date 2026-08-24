'use client';

import type { LucideIcon } from 'lucide-react';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';
import { NavigationCard, type ColorVariant } from './NavigationCard';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';
import { gridPatterns } from '@/styles/design-tokens';

// ============================================================================
// Navigation Grid — Responsive CSS Grid wrapper for tiles (ADR-179)
// ============================================================================

export interface NavigationTile {
  title: string;
  description: string;
  icon: LucideIcon;
  href: WorkspaceHref;
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
      <div className={`gap-4 grid ${gridPatterns.cards.tile}`}>
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
