/* eslint-disable design-system/prefer-design-system-imports */
/**
 * SpaceFloorCard — the "Floor" card of a space entity's general tab
 *
 * SSoT for the card shell wrapped around {@link FloorSelectField} in the Parking
 * and Storage general tabs (byte-identical header + padding in both). Every
 * `FloorSelectField` prop passes straight through, so each entity keeps its own
 * binding mode (`valueMode: 'floor'` for parking, floor-doc ids for storage).
 *
 * Presentational only — the owner keeps the form state and the change handler.
 *
 * @module components/shared/space-info/SpaceFloorCard
 * @see ADR-145 — parking floor schema simplification (`valueMode`)
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

'use client';

import { MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FloorSelectField,
  type FloorSelectFieldProps,
} from '@/components/shared/FloorSelectField';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

/** Same contract as the wrapped field — `label` doubles as the card title. */
export type SpaceFloorCardProps = FloorSelectFieldProps;

// ============================================================================
// COMPONENT
// ============================================================================

export function SpaceFloorCard(props: SpaceFloorCardProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const colors = useSemanticColors();

  return (
    <Card>
      <CardHeader className="p-2">
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
          <MapPin className={cn(iconSizes.md, colors.text.success)} />
          {props.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <FloorSelectField {...props} />
      </CardContent>
    </Card>
  );
}

export default SpaceFloorCard;
