/* eslint-disable design-system/prefer-design-system-imports */
/**
 * SpaceFloorCard — the "Floor" card of a space entity's general tab
 *
 * SSoT for the card shell wrapped around {@link FloorSelectField} in the Parking
 * and Storage general tabs (byte-identical header + padding in both) AND for how
 * the card binds to the form: the floor HOSTS the space (ADR-903 §6, Revit
 * `LevelId`), so the form holds only `floorId`. A document created before the
 * migration (free-text floor, no `floorId`) shows its old floor as a disabled
 * option until the human picks a real one.
 *
 * Presentational only — the owner keeps the form state.
 *
 * @module components/shared/space-info/SpaceFloorCard
 * @see ADR-903 §6 — parking + storage hosted on a floor (`floorId` authority)
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

'use client';

import { MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FloorSelectField } from '@/components/shared/FloorSelectField';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { hostedFloorRef, type HostedOnFloor } from '@/lib/floor/hosted-floor';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface SpaceFloorCardProps {
  /** The building the space is linked to (the floors listed are its floors). */
  buildingId: string | null | undefined;
  /** The stored space — its legacy floor is shown when it has no `floorId` yet. */
  entity: HostedOnFloor;
  /** The form's floor (`''` = none). */
  floorId: string;
  onFloorIdChange: (floorId: string) => void;
  /** The space namespace's translator — both spaces share the two keys below. */
  t: (key: string) => string;
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SpaceFloorCard({ buildingId, entity, floorId, onFloorIdChange, t, disabled }: SpaceFloorCardProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const colors = useSemanticColors();
  const label = t('general.fields.floor');

  return (
    <Card>
      <CardHeader className="p-2">
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
          <MapPin className={cn(iconSizes.md, colors.text.success)} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <FloorSelectField
          buildingId={buildingId}
          value={floorId}
          fallbackFloor={entity.floorId ? undefined : hostedFloorRef(entity)}
          onChange={(selection) => onFloorIdChange(selection?.floorId ?? '')}
          label={label}
          noBuildingHint={t('entityLinks.building.noFloorHint')}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
}

export default SpaceFloorCard;
