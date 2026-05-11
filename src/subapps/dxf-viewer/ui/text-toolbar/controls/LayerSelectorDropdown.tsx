'use client';

/**
 * ADR-344 Phase 5.C + Q17 — Layer picker for text entities.
 *
 * Radix Select (ADR-001 canonical). Locked layers render with a lock icon
 * and are disabled unless the current user has `canUnlockLayer` (Q8).
 * Layer 0 — AutoCAD default unset layer — renders with a warning badge.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, AlertTriangle } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { MixedValue } from '../../../text-engine/types';

export interface LayerSelectorEntry {
  readonly id: string;
  readonly name: string;
  readonly locked: boolean;
  readonly frozen: boolean;
}

interface LayerSelectorDropdownProps {
  readonly value: MixedValue<string>;
  readonly layers: readonly LayerSelectorEntry[];
  readonly canUnlockLayer: boolean;
  readonly onChange: (layerId: string) => void;
  readonly disabled?: boolean;
}

export function LayerSelectorDropdown({
  value,
  layers,
  canUnlockLayer,
  onChange,
  disabled,
}: LayerSelectorDropdownProps) {
  const { t } = useTranslation(['textToolbar']);

  const visibleLayers = layers.filter((l) => !l.frozen);

  return (
    <Select
      value={value ?? undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger
        size="md"
        aria-label={t('textToolbar:layer.label')}
        data-state={value === null ? 'indeterminate' : 'determinate'}
      >
        <SelectValue placeholder={value === null ? t('textToolbar:layer.mixed') : t('textToolbar:layer.placeholder')} />
      </SelectTrigger>
      <SelectContent>
        {visibleLayers.map((layer) => {
          const isLocked = layer.locked && !canUnlockLayer;
          const isLayerZero = layer.id === '0';
          return (
            <SelectItem
              key={layer.id}
              value={layer.id}
              disabled={isLocked}
            >
              <span className="inline-flex items-center gap-2">
                {layer.locked ? <Lock className="h-3 w-3" aria-hidden="true" /> : null}
                {isLayerZero ? <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden="true" /> : null}
                <span>{layer.name}</span>
                {isLayerZero ? (
                  <span className="text-xs text-amber-600">
                    {t('textToolbar:layer.zeroFallback')}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
