import { AlertTriangle, Check, ExternalLink, Star } from 'lucide-react';
import type { ProjectAddress } from '@/types/project/addresses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatAddressLine, getBuildingAddressCardId } from './building-addresses-card-helpers';

interface BuildingAddressesProjectSelectionProps {
  localAddresses: ProjectAddress[];
  projectAddresses: ProjectAddress[];
  isSaving: boolean;
  selectedCount: number;
  isAddressSelected: (projectAddress: ProjectAddress) => boolean;
  onToggleProjectAddress: (projectAddress: ProjectAddress) => Promise<void>;
  onSetPrimary: (projectAddress: ProjectAddress) => Promise<void>;
  onOpenProjectLocations: () => void;
}

export function BuildingAddressesProjectSelection({
  localAddresses,
  projectAddresses,
  isSaving,
  selectedCount,
  isAddressSelected,
  onToggleProjectAddress,
  onSetPrimary,
  onOpenProjectLocations,
}: BuildingAddressesProjectSelectionProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('building');
  const colors = useSemanticColors();

  if (projectAddresses.length === 0) {
    return (
      <section className="text-center py-2 border-2 border-dashed rounded-lg">
        <AlertTriangle className={`${iconSizes.xl} mx-auto mb-2 text-amber-500`} />
        <h3 className="text-lg font-semibold mb-2">
          {t('address.labels.projectNoAddresses')}
        </h3>
        <p className={cn('text-sm mb-2', colors.text.muted)}>
          {t('address.labels.projectNoAddressesHint')}
        </p>
        <Button variant="default" size="sm" onClick={onOpenProjectLocations}>
          <ExternalLink className={`${iconSizes.sm} mr-2`} />
          {t('address.labels.goToProjectAddresses')}
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-2">
      {projectAddresses.map((projectAddress) => {
        const selected = isAddressSelected(projectAddress);
        const isPrimaryInBuilding = localAddresses.find((address) => address.id === projectAddress.id)?.isPrimary;

        return (
          <article
            key={projectAddress.id}
            id={getBuildingAddressCardId(projectAddress.id)}
            className={cn(
              'relative border-2 rounded-lg p-2 transition-all cursor-pointer',
              selected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-muted hover:border-muted-foreground/30'
            )}
            onClick={() => {
              if (!isSaving) {
                void onToggleProjectAddress(projectAddress);
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (!isSaving) {
                  void onToggleProjectAddress(projectAddress);
                }
              }
            }}
          >
            <div className="flex items-start gap-2">
              <div className={cn(
                'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground/30'
              )}>
                {selected && <Check className="h-3 w-3" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{formatAddressLine(projectAddress)}</span>
                  {projectAddress.isPrimary && (
                    <Badge variant="outline" className="text-xs">
                      {t('address.labels.projectPrimary')}
                    </Badge>
                  )}
                </div>

                <div className={cn('flex flex-wrap gap-2 text-xs', colors.text.muted)}>
                  {projectAddress.type && <span>{t(`address.types.${projectAddress.type}`)}</span>}
                  {projectAddress.blockSide && <span>{t(`address.blockSides.${projectAddress.blockSide}`)}</span>}
                  {projectAddress.label && <span>{projectAddress.label}</span>}
                </div>
              </div>

              {selected && (
                <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
                  {isPrimaryInBuilding ? (
                    <Badge variant="default" className="flex items-center gap-1 text-xs">
                      <Star className="h-3 w-3 fill-current" />
                      {t('address.labels.primary')}
                    </Badge>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { void onSetPrimary(projectAddress); }}
                          className="h-7 text-xs"
                        >
                          <Star className="h-3 w-3 mr-1" />
                          {t('address.labels.setPrimary')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('address.labels.setPrimary')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}

      {selectedCount === 0 && (
        <section className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className={cn(iconSizes.sm, 'text-amber-600 dark:text-amber-400 shrink-0')} />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t('address.labels.noAddressSelected')}
          </p>
        </section>
      )}
    </div>
  );
}
