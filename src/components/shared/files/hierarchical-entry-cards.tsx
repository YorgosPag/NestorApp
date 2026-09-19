/**
 * Sub-components for HierarchicalEntryPointSelector (ADR-191) — the Group card.
 * The entry card is shared with the flat selector: `entry-point-selector-shared.tsx` (ADR-866 §2.10.8 Β4).
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { StudyGroupMeta, StudyGroup } from '@/config/study-groups-config';
// ADR-866 §2.10.8 Β4 — η κάρτα τύπου (`EntryCard`) και το `getIcon` ζουν πλέον στο κοινό αρχείο των δύο επιλογέων.
import { getIcon } from './entry-point-selector-shared';
import '@/lib/design-system';

// ============================================================================
// GROUP CARD
// ============================================================================

export interface GroupCardProps {
  group: StudyGroupMeta;
  count: number;
  currentLanguage: 'el' | 'en';
  onGroupClick: (group: StudyGroup) => void;
  entriesCountLabel: string;
}

export function GroupCard({
  group,
  count: _count,
  currentLanguage,
  onGroupClick,
  entriesCountLabel,
}: GroupCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const Icon = getIcon(group.icon);

  return (
    <button
      type="button"
      onClick={() => onGroupClick(group.group)}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border-2 border-l-4 transition-all',
        'hover:shadow-md hover:scale-[1.02]',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'border-border bg-card hover:border-primary/50',
        group.borderClass
      )}
    >
      <div className={cn('flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full', group.iconBgClass)}>
        <Icon className={cn(iconSizes.md, group.colorClass)} aria-hidden="true" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <h4 className="text-sm font-semibold text-foreground leading-tight">
          {group.label[currentLanguage]}
        </h4>
        <p className={cn("text-xs mt-0.5 leading-tight", colors.text.muted)}>
          {group.description[currentLanguage]}
        </p>
        <span className={cn('inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full', group.bgClass, group.colorClass)}>
          {entriesCountLabel}
        </span>
      </div>
    </button>
  );
}
