import { Pencil, Star, Trash2 } from 'lucide-react';
import type { ProjectAddress } from '@/types/project/addresses';
import { AddressCard } from '@/components/shared/addresses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getBuildingAddressCardId } from './building-addresses-card-helpers';

interface BuildingAddressesManualListProps {
  localAddresses: ProjectAddress[];
  onSetPrimary: (index: number) => Promise<void>;
  onEdit: (index: number) => void;
  onDelete: (index: number) => Promise<void>;
}

export function BuildingAddressesManualList({
  localAddresses,
  onSetPrimary,
  onEdit,
  onDelete,
}: BuildingAddressesManualListProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('building');
  const colors = useSemanticColors();

  return (
    <div className="space-y-2">
      {localAddresses.map((address, index) => (
        <article
          key={address.id}
          id={getBuildingAddressCardId(address.id)}
          className="relative border rounded-lg p-2 hover:shadow-md transition-shadow"
        >
          <AddressCard address={address} />
          <div className="absolute top-4 right-4 flex gap-2">
            {address.isPrimary ? (
              <Badge variant="default" className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-current" />
                {t('address.labels.primary')}
              </Badge>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => { void onSetPrimary(index); }}>
                    <Star className={iconSizes.sm} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('address.labels.setPrimary')}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => onEdit(index)}>
                  <Pencil className={iconSizes.sm} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('address.labels.editAddress')}</TooltipContent>
            </Tooltip>
            {localAddresses.length > 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="destructive" size="sm" onClick={() => { void onDelete(index); }}>
                    <Trash2 className={iconSizes.sm} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('address.labels.removeAddress')}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <footer className={cn('mt-2 pt-2 border-t text-xs', colors.text.muted)}>
            <span>ID: {address.id.slice(0, 8)}...</span>
            {address.blockSide && <span className="ml-2">{t(`address.blockSides.${address.blockSide}`)}</span>}
            {address.type && <span className="ml-2">{t(`address.types.${address.type}`)}</span>}
          </footer>
        </article>
      ))}
    </div>
  );
}
