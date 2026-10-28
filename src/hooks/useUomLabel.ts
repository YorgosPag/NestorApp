'use client';

/**
 * @fileoverview Η ετικέτα μονάδας μέτρησης στην UI (ADR-923 §5.11 «3γ» Α10) — το `t` του namespace `uom` δεμένο στον
 *   **έναν** μορφοποιητή `formatUom`. Δέχεται κάθε αποθηκευμένη γραφή (`'τεμ'` · `'pcs'` · `'m²'`)· άγνωστη εμφανίζεται
 *   αυτούσια. Ίδιο σχήμα με το `useFloorLabel` (ADR-903).
 * @module hooks/useUomLabel
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatUom, type UomLabelForm } from '@/lib/uom/uom-label';

/** `(γραφή, μορφή?) => ετικέτα` — κενό για απούσα τιμή. */
export function useUomLabel(): (raw: string | null | undefined, form?: UomLabelForm) => string {
  const { t } = useTranslation('uom');
  return useCallback((raw: string | null | undefined, form?: UomLabelForm) => formatUom(raw, t, form), [t]);
}
