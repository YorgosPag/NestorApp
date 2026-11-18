/**
 * @fileoverview **ΔΙΕΥΘΥΝΣΕΙΣ ΤΟΥ ΚΤΙΡΙΟΥ ΕΚΤΟΣ ΕΡΓΟΥ** — ό,τι γράφει το κτίριο αλλά δεν υπάρχει στο έργο (ADR-332).
 * @related ./building-addresses-card-helpers (`buildingOnlyAddresses`) · ./useBuildingAddressesCardState
 * @module components/building-management/tabs/GeneralTabContent/building-addresses-card/BuildingAddressesBuildingOnlyList
 *
 * 🔑 Η καρτέλα κτιρίου μέσα σε έργο έδειχνε **μόνο** τις διευθύνσεις του έργου. Μια παλιά διεύθυνση του κτιρίου (π.χ.
 *    χειροκίνητη από πριν μπει σε έργο) έμενε στο `building.addresses` **αόρατη και αμετακίνητη**. Τώρα φαίνεται εδώ,
 *    σημειωμένη ως «εκτός έργου», με ρητή «Αποσύνδεση» — όπως το Revit δείχνει τις αναφορές που δεν λύνονται αντί να
 *    τις κρύβει.
 */

import { Star, Unlink } from 'lucide-react';
import type { ProjectAddress } from '@/types/project/addresses';
import { AddressCard } from '@/components/shared/addresses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getBuildingAddressCardId } from './building-addresses-card-helpers';

interface BuildingAddressesBuildingOnlyListProps {
  readonly addresses: readonly ProjectAddress[];
  readonly isSaving: boolean;
  readonly onUnlink: (address: ProjectAddress) => Promise<void>;
}

export function BuildingAddressesBuildingOnlyList({ addresses, isSaving, onUnlink }: BuildingAddressesBuildingOnlyListProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('building');
  const colors = useSemanticColors();

  if (addresses.length === 0) return null;

  return (
    <section className="space-y-2" aria-labelledby="building-only-addresses-title">
      <header>
        <h3 id="building-only-addresses-title" className="text-sm font-semibold">
          {t('address.labels.buildingOnlyTitle')}
        </h3>
        <p className={cn('text-xs', colors.text.muted)}>{t('address.labels.buildingOnlyHint')}</p>
      </header>
      <ul className="space-y-2">
        {addresses.map((address) => (
          <li
            key={address.id}
            id={getBuildingAddressCardId(address.id)}
            className="relative rounded-lg border border-dashed p-2"
          >
            <AddressCard address={address} />
            <footer className="mt-2 flex items-center justify-end gap-2">
              {address.isPrimary && (
                <Badge variant="default" className="flex items-center gap-1 text-xs">
                  <Star className="h-3 w-3 fill-current" />
                  {t('address.labels.primary')}
                </Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={() => { void onUnlink(address); }}
              >
                <Unlink className={cn(iconSizes.sm, 'mr-2')} />
                {t('address.labels.unlinkBuildingOnly')}
              </Button>
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
