// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { Property } from '@/types/property-viewer';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Centralized Property Icon & Color (SSoT)
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

interface PropertyDetailsHeaderProps {
  property: Property | null;
  /** 🏢 ENTERPRISE: Edit mode state - Pattern A (entity header) */
  isEditMode?: boolean;
  /** Whether we are creating a new property (inline form) */
  isCreatingNewUnit?: boolean;
  /** 🏢 ENTERPRISE: Toggle edit mode callback (enters edit mode) */
  onToggleEditMode?: () => void;
  /** 🏢 ENTERPRISE: Exit edit mode callback (cancel without save) */
  onExitEditMode?: () => void;
  /** Callback for creating a new property */
  onNewProperty?: () => void;
  /** Callback for deleting the current property */
  onDeleteProperty?: () => void;
}

export function PropertyDetailsHeader({
  property,
  isEditMode = false,
  isCreatingNewUnit = false,
  onToggleEditMode,
  onExitEditMode,
  onNewProperty,
  onDeleteProperty,
}: PropertyDetailsHeaderProps) {
  const { t } = useTranslation('properties');

  const handleHeaderSave = useCallback(() => {
    const form = document.getElementById('property-fields-form') as HTMLFormElement | null;
    if (form) {
      form.requestSubmit();
    } else {
      onExitEditMode?.();
    }
  }, [onExitEditMode]);

  const handleHeaderCancel = useCallback(() => {
    onExitEditMode?.();
  }, [onExitEditMode]);

  if (!property) {
    return (
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={PropertyIcon}
          iconColor={propertyColor}
          title={t('details.selectProperty')}
          subtitle={t('details.noUnitSelected')}
          variant="detailed"
          className="h-[81px] flex items-center"
        />
      </div>
    );
  }

  const actions = isEditMode
    ? [
        createEntityAction(
          'save',
          isCreatingNewUnit
            ? t('navigation.actions.newUnit.create')
            : t('buildingSelector.save'),
          handleHeaderSave
        ),
        createEntityAction('cancel', t('buttons.cancel', { ns: 'common' }), handleHeaderCancel),
      ]
    : [
        createEntityAction('edit', t('navigation.actions.edit.label'), () => onToggleEditMode?.()),
        createEntityAction('new', t('navigation.actions.newUnit.label'), () => onNewProperty?.()),
        createEntityAction('delete', t('navigation.actions.delete.label'), () => onDeleteProperty?.()),
      ];

  const headerTitle = isCreatingNewUnit
    ? t('navigation.actions.newUnit.label')
    : property.name;

  return (
    <>
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={PropertyIcon}
          iconColor={propertyColor}
          title={headerTitle}
          actions={actions}
          variant="detailed"
        />
      </div>
    </>
  );
}
