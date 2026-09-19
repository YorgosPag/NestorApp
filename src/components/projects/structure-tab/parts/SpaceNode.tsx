/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * 🏢 SpaceNode — ο κόμβος ενός ΧΩΡΟΥ (θέση · αποθήκη) στο δέντρο του έργου
 *
 * Εικονίδιο οντότητας + τίτλος + γραμμή λεπτομερειών + σήματα κατάστασης. Ήταν **δύο** σχεδόν ίδια
 * components (`ParkingNode` / `StorageNode`)· το `jscpd:diff` (CHECK 3.28) τα έπιασε όταν η
 * ADR-777 §8.60.20 άγγιξε και τα δύο. Τα σήματα έρχονται από το ΕΝΑ SSoT (`SpaceStatusBadges`):
 * διάθεση από το `commercialStatus` + λειτουργική εξαίρεση — ποτέ το παλιό ανάμεικτο `status`.
 *
 * @module components/projects/structure-tab/parts/SpaceNode
 */

import React from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useIconSizes } from '@/hooks/useIconSizes';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { SpaceStatusBadges } from '@/components/shared/unit-status/SpaceStatusBadges';
import type { SpaceStatusSource } from '@/lib/spaces/space-status-split';

export interface SpaceNodeProps {
  readonly entity: 'parking' | 'storage';
  readonly title: React.ReactNode;
  /** Η γραμμή κάτω από τον τίτλο (τύπος · όροφος · εμβαδόν), ήδη μεταφρασμένη. */
  readonly details: React.ReactNode;
  readonly space: SpaceStatusSource;
}

export function SpaceNode({ entity, title, details, space }: SpaceNodeProps) {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const iconSizes = useIconSizes();
  const Icon = NAVIGATION_ENTITIES[entity].icon;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-md',
        quick.card,
        colors.bg.infoSubtle,
        HOVER_BACKGROUND_EFFECTS.LIGHT,
        TRANSITION_PRESETS.STANDARD_COLORS
      )}
    >
      <Icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES[entity].color)} />
      <div className="flex-1 min-w-0">
        <div className={cn(typography.label.sm, colors.text.foreground, 'truncate')}>{title}</div>
        <div className={cn(typography.body.xs, colors.text.muted)}>{details}</div>
      </div>
      <SpaceStatusBadges space={space} />
    </div>
  );
}
