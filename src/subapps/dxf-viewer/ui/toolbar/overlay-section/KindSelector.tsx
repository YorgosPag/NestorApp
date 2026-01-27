/**
 * ui/toolbar/overlay-section/KindSelector.tsx
 * Kind selector icons (Unit/Parking/Storage/Footprint) for overlay toolbar
 *
 * 🏢 ADR-050: UNIFIED TOOLBAR INTEGRATION (2027-01-27)
 * 4 kind selection icons με centralized OVERLAY_TOOLBAR_COLORS
 */

'use client';

import React from 'react';
import { Home, Car, Package, Footprints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { OVERLAY_TOOLBAR_COLORS } from '../../../config/toolbar-colors';
import type { OverlayKind } from '../../../overlays/types';

interface KindSelectorProps {
  currentKind: OverlayKind;
  onKindChange: (kind: OverlayKind) => void;
}

const kindIcons = {
  unit: { icon: Home, color: OVERLAY_TOOLBAR_COLORS.unit, label: 'Unit' },
  parking: { icon: Car, color: OVERLAY_TOOLBAR_COLORS.parking, label: 'Parking' },
  storage: { icon: Package, color: OVERLAY_TOOLBAR_COLORS.storage, label: 'Storage' },
  footprint: { icon: Footprints, color: OVERLAY_TOOLBAR_COLORS.footprint, label: 'Footprint' }
} as const;

export const KindSelector: React.FC<KindSelectorProps> = ({
  currentKind,
  onKindChange
}) => {
  const iconSizes = useIconSizes();

  return (
    <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
      {Object.entries(kindIcons).map(([kind, { icon: Icon, color, label }]) => (
        <Tooltip key={kind}>
          <TooltipTrigger asChild>
            <Button
              variant={currentKind === kind ? 'default' : 'ghost'}
              size="icon-sm"
              onClick={() => onKindChange(kind as OverlayKind)}
            >
              <Icon className={`${iconSizes.sm} ${currentKind !== kind ? color : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};
