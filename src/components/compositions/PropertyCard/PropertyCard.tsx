'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { BaseCard, CardAction, CardStatus } from '@/components/core/BaseCard';
import { MapPin, Ruler, Eye, Edit, Trash2 } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';

import type { StorageUnit } from '@/types/storage';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

interface PropertyCardProps {
  property: StorageUnit;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  selectable?: boolean;
}

export function PropertyCard({
  property,
  isSelected = false,
  onSelect,
  onView,
  onEdit,
  onDelete,
  showActions = true,
  selectable = false,
}: PropertyCardProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('properties');

  // Δημιουργία status configuration
  const status: CardStatus = {
    value: property.status || 'available',
    label: t(`storage.status.${property.status || 'available'}`),
    variant: property.status === 'available' ? 'default' : 
             property.status === 'sold' ? 'destructive' :
             property.status === 'reserved' ? 'secondary' : 'outline'
  };

  // Δημιουργία badges για τύπο και όροφο
  const badges: CardStatus[] = [];
  
  if (property.type) {
    badges.push({
      value: property.type,
      label: t(`storage.types.${property.type}`),
      variant: 'outline'
    });
  }

  if (property.floor) {
    badges.push({
      value: property.floor,
      label: property.floor,
      variant: 'secondary'
    });
  }

  // Δημιουργία actions
  const actions: CardAction[] = [];
  
  if (showActions) {
    if (onView) {
      actions.push({
        id: 'view',
        label: t('dialog.view', { ns: 'common' }),
        icon: Eye,
        onClick: onView,
      });
    }
    
    if (onEdit) {
      actions.push({
        id: 'edit',
        label: t('dialog.edit', { ns: 'common' }),
        icon: Edit,
        onClick: onEdit,
      });
    }
    
    if (onDelete) {
      actions.push({
        id: 'delete',
        label: t('dialog.delete', { ns: 'common' }),
        icon: Trash2,
        onClick: onDelete,
        variant: 'destructive' as const,
      });
    }
  }

  return (
    <BaseCard
      isSelected={isSelected}
      onSelect={onSelect}
      selectable={selectable}
      status={status}
      badges={badges}
      actions={actions}
      hoverEffects={true}
      variant="default"
      className="h-full"
    >
      {/* Header με κωδικό και τύπο */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-lg text-foreground">
            {property.code}
          </h3>
          
          {property.price && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Τιμή</p>
              <p className="font-semibold text-primary">
                €{property.price.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Περιγραφή */}
        {property.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {property.description}
          </p>
        )}

        {/* Στατιστικά */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {property.area && (
            <div className="flex items-center gap-1">
              <Ruler className={iconSizes.sm} />
              <span>{property.area} τ.μ.</span>
            </div>
          )}
          
          {property.floor && (
            <div className="flex items-center gap-1">
              <UnitIcon className={`${iconSizes.sm} ${unitColor}`} />
              <span>{property.floor}</span>
            </div>
          )}
        </div>

        {/* Τοποθεσία αν υπάρχει */}
        {property.coordinates && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className={iconSizes.sm} />
            <span>X: {property.coordinates.x}, Y: {property.coordinates.y}</span>
          </div>
        )}
      </div>
    </BaseCard>
  );
}