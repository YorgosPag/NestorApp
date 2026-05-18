/**
 * QUICK PROPERTIES HOVER POPOVER — ADR-357 §4 G9 Phase 8
 *
 * ADR-040 micro-leaf subscriber: the ONLY React consumer of QuickPropertiesStore.
 * Rendered after 800ms stable hover on an existing entity (activeTool='select').
 * Shows: Layer, Color, Length (lines only), Angle (lines only), Linetype.
 *
 * RULE (ADR-040): MUST NOT be called from CanvasSection/CanvasLayerStack internals
 * — it is mounted as a sibling (like GripHoverMenu) so orchestrators stay
 * subscription-free.
 */

'use client';

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useDisplayUnit } from '../../hooks/common/useDisplayUnit';
import { formatDisplayValue, DISPLAY_UNIT_LABELS } from '../../config/units';
import { QuickPropertiesStore } from './QuickPropertiesStore';
import { resolveEntityLayerName } from '../../stores/LayerStore';
import type { DxfScene, DxfEntity, DxfLine } from '../../canvas-v2/dxf-canvas/dxf-types';
import styles from './QuickPropertiesHoverPopover.module.css';

interface Props {
  dxfScene: DxfScene | null;
  activeTool: string;
}

function getColorDisplay(entity: DxfEntity, byLayerLabel: string): string {
  if (entity.colorMode === 'Concrete') {
    if (entity.color) return entity.color;
    if (entity.colorAci != null) return `ACI ${entity.colorAci}`;
  }
  return byLayerLabel;
}

function getConcreteColor(entity: DxfEntity): string | null {
  return entity.colorMode === 'Concrete' && entity.color ? entity.color : null;
}

export function QuickPropertiesHoverPopover({ dxfScene, activeTool }: Props) {
  const snapshot = useSyncExternalStore(
    QuickPropertiesStore.subscribe,
    QuickPropertiesStore.getSnapshot,
    QuickPropertiesStore.getSnapshot,
  );
  const { t } = useTranslation('dxf-viewer-shell');
  const { displayUnit } = useDisplayUnit();

  const { entityId, position } = snapshot;

  if (!entityId || !position || activeTool !== 'select' || !dxfScene) return null;

  const entity = dxfScene.entities.find(e => e.id === entityId);
  if (!entity) return null;

  const layerId = entity.layerId;
  const layer = layerId != null ? dxfScene.layersById?.[layerId] : undefined;
  const layerName = layer?.name ?? resolveEntityLayerName(entity) ?? '—';
  const byLayerLabel = t('quickProperties.byLayer');
  const colorDisplay = getColorDisplay(entity, byLayerLabel);
  const concreteColor = getConcreteColor(entity);

  let lengthStr: string | null = null;
  let angleStr: string | null = null;

  if (entity.type === 'line') {
    const line = entity as DxfLine;
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const lengthMm = Math.hypot(dx, dy);
    lengthStr = `${formatDisplayValue(lengthMm, displayUnit)} ${DISPLAY_UNIT_LABELS[displayUnit]}`;
    // Y-up coordinate system: 0° = East, positive = counter-clockwise
    let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    angleStr = `${angle.toFixed(2)}°`;
  }

  const linetypeName = entity.linetypeName ?? byLayerLabel;

  return (
    <div
      className={styles.popover}
      style={{ left: position.x + 16, top: position.y + 8 }}
      role="tooltip"
      aria-live="polite"
    >
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt className={styles.label}>{t('quickProperties.layer')}</dt>
          <dd className={styles.value}>{layerName}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.label}>{t('quickProperties.color')}</dt>
          <dd className={styles.value}>
            {concreteColor && (
              <span
                className={styles.colorSwatch}
                style={{ '--qp-color-swatch': concreteColor } as React.CSSProperties}
              />
            )}
            {colorDisplay}
          </dd>
        </div>
        {lengthStr && (
          <div className={styles.row}>
            <dt className={styles.label}>{t('quickProperties.length')}</dt>
            <dd className={styles.value}>{lengthStr}</dd>
          </div>
        )}
        {angleStr && (
          <div className={styles.row}>
            <dt className={styles.label}>{t('quickProperties.angle')}</dt>
            <dd className={styles.value}>{angleStr}</dd>
          </div>
        )}
        <div className={styles.row}>
          <dt className={styles.label}>{t('quickProperties.linetype')}</dt>
          <dd className={styles.value}>{linetypeName}</dd>
        </div>
      </dl>
    </div>
  );
}
