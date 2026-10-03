'use client';

/**
 * @fileoverview Η ετικέτα ορόφου στην UI (ADR-903) — το `t` του namespace `floors` δεμένο στον
 * **έναν** μορφοποιητή `formatFloorRef`. Δέχεται `FloorRef` ή ωμή τιμή (αριθμό / παλιό κείμενο),
 * που περνά από τον **έναν** parser· άγνωστο κείμενο εμφανίζεται αυτούσιο (ποτέ σιωπηλό «Ισόγειο»).
 * @module hooks/useFloorLabel
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatFloorRef } from '@/lib/floor/floor-label';
import { parseLegacyFloor, type FloorRef } from '@/lib/floor/floor-ref';

export type FloorLabelInput = FloorRef | number | string | null | undefined;

/** `(τιμή) => ετικέτα` — κενό για απούσα τιμή. */
export function useFloorLabel(): (value: FloorLabelInput) => string {
  const { t } = useTranslation('floors');
  return useCallback(
    (value: FloorLabelInput) => {
      if (value === null || value === undefined || value === '') return '';
      const ref = typeof value === 'object' ? value : parseLegacyFloor(value);
      return ref === null ? String(value).trim() : formatFloorRef(ref, t);
    },
    [t],
  );
}
