'use client';

/**
 * useSpaceLocation — η ενότητα «κτίριο + όροφος» μιας φόρμας χώρου (θέση · αποθήκη) — ADR-903 §6.
 *
 * Revit `LevelId`: ο χώρος φιλοξενείται σε όροφο του κτιρίου του. Η φόρμα κρατά μόνο `floorId`· ό,τι
 * χρειάζεται από τον όροφο (ο αριθμός για τον κωδικό ADR-233) **παράγεται** από την κοινή συνδρομή
 * ορόφων (`useBuildingFloor`). Οι δύο καρτέλες έγραφαν το ίδιο μπλοκ (σύνδεσμος κτιρίου + κάρτα ορόφου
 * + παραγωγή ορόφου) δύο φορές — το `jscpd` (CHECK 3.28) το έπιασε· γράφεται εδώ μία φορά.
 *
 * @module components/shared/space-info/useSpaceLocation
 */

import type { ReactNode } from 'react';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { useBuildingFloor, type FloorOption } from '@/components/properties/shared/useFloorsByBuilding';
import type { UseEntityLinkReturn } from '@/hooks/useEntityLink';
import type { HostedOnFloor } from '@/lib/floor/hosted-floor';
import { SpaceFloorCard } from './SpaceFloorCard';

export interface UseSpaceLocationInput {
  readonly buildingLink: Pick<UseEntityLinkReturn, 'linkedId' | 'linkCardKey' | 'linkCardProps'>;
  /** The stored space (its legacy floor is shown until a real one is picked). */
  readonly entity: HostedOnFloor;
  /** The form's floor (`''` = none). */
  readonly floorId: string;
  readonly onFloorIdChange: (floorId: string) => void;
  readonly t: (key: string) => string;
  readonly disabled: boolean;
  /** Grid spacing of the host tab. */
  readonly gridClassName: string;
}

export interface SpaceLocation {
  /** Building link card + floor card, side by side. */
  readonly section: ReactNode;
  /** The hosting floor, derived from `floorId` (`null` while loading / none). */
  readonly hostFloor: FloorOption | null;
}

export function useSpaceLocation(input: UseSpaceLocationInput): SpaceLocation {
  const { buildingLink } = input;
  const hostFloor = useBuildingFloor(buildingLink.linkedId, input.floorId);
  const section = (
    <section className={input.gridClassName}>
      <EntityLinkCard key={buildingLink.linkCardKey} {...buildingLink.linkCardProps} />
      <SpaceFloorCard
        buildingId={buildingLink.linkedId}
        entity={input.entity}
        floorId={input.floorId}
        onFloorIdChange={input.onFloorIdChange}
        t={input.t}
        disabled={input.disabled}
      />
    </section>
  );
  return { section, hostFloor };
}
