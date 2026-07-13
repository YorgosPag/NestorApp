'use client';

/**
 * ADR-641 (single-click selection surface) — Block Properties panel (object inspector).
 *
 * Presentational· mirror του `LinePropertiesTab`/`ColumnAdvancedPanel`. Διατρέχει το
 * SSoT descriptor (`BLOCK_PROPERTY_GROUPS`) και αποδίδει sections με τον ΚΟΙΝΟ
 * `EntityPropertySection` renderer (ίδιος με γραμμή/γραμμοσκίαση). Read/write μέσω του
 * `useBlockPropertyBridge` (undoable `UpdateEntityCommand`).
 *
 * @see ./block-property-fields.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import type { BlockEntity } from '../../types/entities';
import { EntityPropertySection } from '../entity-properties/EntityPropertyRow';
import { BLOCK_PROPERTY_GROUPS } from './block-property-fields';
import { useBlockPropertyBridge } from './useBlockPropertyBridge';

export interface BlockAdvancedPanelProps {
  readonly block: BlockEntity;
  readonly containerClassName?: string;
}

export function BlockAdvancedPanel({
  block,
  containerClassName,
}: BlockAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const bridge = useBlockPropertyBridge(block, levelManager);

  return (
    <div className={containerClassName ?? 'flex flex-col gap-3 p-2'}>
      {BLOCK_PROPERTY_GROUPS.map((group) => (
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
