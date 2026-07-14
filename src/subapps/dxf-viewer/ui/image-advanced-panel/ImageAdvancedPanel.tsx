'use client';

/**
 * ADR-654 — Image (entourage) Properties panel (object inspector).
 *
 * Presentational· mirror του `BlockAdvancedPanel`. Διατρέχει το SSoT descriptor
 * (`IMAGE_PROPERTY_GROUPS`) και αποδίδει sections με τον ΚΟΙΝΟ `EntityPropertySection`
 * renderer (ίδιος με block/γραμμή/γραμμοσκίαση). Read/write μέσω του `useImagePropertyBridge`
 * (undoable `UpdateEntityCommand`).
 *
 * @see ./image-property-fields.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import type { ImageEntity } from '../../types/image';
import { EntityPropertySection } from '../entity-properties/EntityPropertyRow';
import { IMAGE_PROPERTY_GROUPS } from './image-property-fields';
import { useImagePropertyBridge } from './useImagePropertyBridge';

export interface ImageAdvancedPanelProps {
  readonly image: ImageEntity;
  readonly containerClassName?: string;
}

export function ImageAdvancedPanel({
  image,
  containerClassName,
}: ImageAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const bridge = useImagePropertyBridge(image, levelManager);

  return (
    <div className={containerClassName ?? 'flex flex-col gap-3 p-2'}>
      {IMAGE_PROPERTY_GROUPS.map((group) => (
        <EntityPropertySection
          key={group.id}
          title={t(group.titleKey)}
          group={group}
          getComboboxState={bridge.getComboboxState}
          onComboboxChange={bridge.onComboboxChange}
        />
      ))}
    </div>
  );
}
