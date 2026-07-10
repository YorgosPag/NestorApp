'use client';

/**
 * ADR-632 Φ5 — sidebar «Properties» tab wrapper για slab-opening. Mounted από τον
 * `BimPropertiesRouter` όταν το primary-selected entity είναι slab-opening.
 * Mirror του `FoundationPropertiesTab` (απλούστερο precedent) — resolve από το
 * reactive `currentScene` prop (re-render σε κάθε param/validation edit).
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isSlabOpeningEntity } from '../../types/entities';
import { useResolvedSelectedEntity } from '../../hooks/selection/useResolvedSelectedEntity';
import { SlabOpeningAdvancedPanel } from './SlabOpeningAdvancedPanel';
import type { SceneModel } from '../../types/scene';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';

export interface SlabOpeningPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function SlabOpeningPropertiesTab({
  primarySelectedId,
  currentScene,
}: SlabOpeningPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const selected = useResolvedSelectedEntity(primarySelectedId, currentScene);
  const opening = React.useMemo<SlabOpeningEntity | null>(
    () => (selected && isSlabOpeningEntity(selected) ? selected : null),
    [selected],
  );

  if (!opening) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('slabOpeningAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <section aria-label={t('slabOpeningAdvancedPanel.title')}>
      <SlabOpeningAdvancedPanel opening={opening} containerClassName="flex flex-col gap-3 p-2" />
    </section>
  );
}
