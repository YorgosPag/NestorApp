/**
 * **«Από τον χάρτη»** στην κάρτα προσανατολισμού (ADR-937 Φάση Γ) — για ακίνητα χωρίς κάτοψη.
 *
 * Ο χάρτης κεντράρεται στη θέση του **κτιρίου** (`Building.latitude/longitude`). Χωρίς θέση το πλήκτρο δεν ανοίγει
 * τίποτα και το λέει (καμία σιωπηλή μαντεψιά ότι «μάλλον είναι στην Αθήνα»). Ο διάλογος φορτώνεται **μόνο** όταν
 * ανοίξει (`next/dynamic`), ώστε η καρτέλα να μην πληρώνει τη MapLibre μέχρι να τη χρειαστεί.
 */

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import type { TFunction } from 'i18next';
import { Map as MapIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { OrientationType } from '@/constants/property-features-enterprise';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { GeoPoint } from '@/types/geo/coordinates';

const OrientationFromMapDialog = dynamic(
  () => import('@/components/properties/shared/OrientationFromMapDialog').then((m) => m.OrientationFromMapDialog),
  { ssr: false },
);

interface PropertyOrientationMapActionProps {
  readonly buildingId: string | null | undefined;
  readonly onApply: (values: readonly OrientationType[]) => void;
  readonly disabled: boolean;
  /** Το `t` του namespace `properties-enums`. */
  readonly t: TFunction;
}

function useBuildingCenter(buildingId: string | null | undefined): GeoPoint | null {
  const { buildings } = useFirestoreBuildings();
  const building = buildingId ? buildings.find((b) => b.id === buildingId) : undefined;
  const lat = building?.latitude;
  const lng = building?.longitude;
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng }
    : null;
}

export function PropertyOrientationMapAction({ buildingId, onApply, disabled, t }: PropertyOrientationMapActionProps) {
  const colors = useSemanticColors();
  const [open, setOpen] = useState(false);
  const center = useBuildingCenter(buildingId);

  return (
    <section className="space-y-1">
      <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs"
        disabled={disabled || center === null} onClick={() => setOpen(true)}>
        <MapIcon className="size-3" />
        {t('orientation.map.open')}
      </Button>
      {center === null && !disabled && (
        <p className={cn('m-0 text-xs', colors.text.muted)}>{t('orientation.map.noLocation')}</p>
      )}
      {open && center && (
        <OrientationFromMapDialog open={open} onOpenChange={setOpen} center={center} onApply={onApply} t={t} />
      )}
    </section>
  );
}
