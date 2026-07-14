'use client';

/**
 * ADR-654 — sidebar «Ιδιότητες» tab wrapper για entourage IMAGE (έπιπλο/άνθρωπος/
 * όχημα/φυτό, `type:'image'`). Mounted από τον `BimPropertiesRouter` όταν το
 * primary-selected entity είναι image. Mirror του `BlockPropertiesTab`.
 *
 * Resolve της εικόνας από το reactive `currentScene` prop (re-render σε κάθε param
 * edit, ίδιο path με block/γραμμή). Writer = ο κοινός `useImagePropertyBridge`.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isImageEntity } from '../../types/entities';
import type { ImageEntity } from '../../types/image';
import { ImageAdvancedPanel } from './ImageAdvancedPanel';
import type { SceneModel } from '../../types/scene';

export interface ImagePropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function ImagePropertiesTab({
  primarySelectedId,
  currentScene,
}: ImagePropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  const image = React.useMemo<ImageEntity | null>(() => {
    if (!primarySelectedId || !currentScene) return null;
    const entity = currentScene.entities.find((e) => e.id === primarySelectedId);
    return entity && isImageEntity(entity) ? (entity as ImageEntity) : null;
  }, [primarySelectedId, currentScene]);

  if (!image) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('imageAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <section aria-label={t('imageAdvancedPanel.title')}>
      <ImageAdvancedPanel image={image} containerClassName="flex flex-col gap-3 p-2" />
    </section>
  );
}
