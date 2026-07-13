'use client';

/**
 * ADR-641 (single-click selection surface) — sidebar «Ιδιότητες» tab wrapper για
 * BLOCK. Mounted από τον `BimPropertiesRouter` όταν το primary-selected entity είναι
 * block. Mirror του `ColumnPropertiesTab`.
 *
 * Resolve του block από το reactive `currentScene` prop (re-render σε κάθε param edit,
 * ίδιο path με γραμμή/κολώνα). Writer = ο κοινός `useBlockPropertyBridge`.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isBlockEntity } from '../../types/entities';
import type { BlockEntity } from '../../types/entities';
import { BlockAdvancedPanel } from './BlockAdvancedPanel';
import type { SceneModel } from '../../types/scene';

export interface BlockPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function BlockPropertiesTab({
  primarySelectedId,
  currentScene,
}: BlockPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  const block = React.useMemo<BlockEntity | null>(() => {
    if (!primarySelectedId || !currentScene) return null;
    const entity = currentScene.entities.find((e) => e.id === primarySelectedId);
    return entity && isBlockEntity(entity) ? entity : null;
  }, [primarySelectedId, currentScene]);

  if (!block) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('blockAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <section aria-label={t('blockAdvancedPanel.title')}>
      <BlockAdvancedPanel block={block} containerClassName="flex flex-col gap-3 p-2" />
    </section>
  );
}
