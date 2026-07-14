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
// ADR-654 — real-time panel sync during a grip/body drag: read the live geometry patch published
// by `useImagePropsGripSync` (SAME applyImageGripDrag SSoT as commit/ghost) and overlay it on the
// committed image so Θέση/Πλάτος/Ύψος/Περιστροφή track the drag frame-for-frame. Cleared on release.
import {
  getEntityPropsLivePreview,
  subscribeEntityPropsLivePreview,
  withEntityPropsLivePreview,
} from '../../systems/grip/EntityPropsLivePreviewStore';

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
  // Live grip/body-drag overlay (ADR-654): re-renders this panel at drag frequency (leaf-only,
  // ADR-040 — no canvas), feeding the bridge the LIVE geometry so the fields track the drag.
  const livePreview = React.useSyncExternalStore(
    subscribeEntityPropsLivePreview,
    getEntityPropsLivePreview,
    getEntityPropsLivePreview,
  );
  const liveImage = withEntityPropsLivePreview(image, livePreview);
  const bridge = useImagePropertyBridge(liveImage, levelManager);

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
