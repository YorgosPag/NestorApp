'use client';

/**
 * # «Σχεδιασμένη περιοχή · 2 σχήματα» + Επεξεργασία + Αφαίρεση ορίου (ADR-885)
 *
 * Το ίδιο πλαίσιο με το chip του δήμου (`BoundaryChipFrame`) — για τον άνθρωπο είναι το ίδιο
 * πράγμα. 🏆 Η **Επεξεργασία** είναι ό,τι λείπει από τη Zillow: ξανανοίγει τη σχεδίαση με τα
 * σχήματα **στη θέση τους**, αντί να ζητά ξανασχεδίαση από το μηδέν.
 */

import React from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { GeoDrawnArea } from '@/types/geo/coordinates';
import { BoundaryChipFrame } from '../BoundaryChipFrame';

interface DrawnAreaChipProps {
  readonly area: GeoDrawnArea;
  readonly onRemove: () => void;
  readonly onEdit: () => void;
}

export function DrawnAreaChip({ area, onRemove, onEdit }: DrawnAreaChipProps) {
  const { t, isNamespaceReady } = useTranslation(['search-region']);
  const iconSizes = useIconSizes();

  // Πριν φορτώσει το namespace: τίποτα — ποτέ ωμά κλειδιά (CHECK 3.51).
  return isNamespaceReady ? (
    <BoundaryChipFrame label={t('search-region:draw.label')} title={t('search-region:draw.label')} onRemove={onRemove}>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {t('search-region:draw.shapes', { count: area.shapes.length })}
        <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className={iconSizes.sm} aria-hidden="true" />
          {t('search-region:draw.edit')}
        </Button>
      </p>
    </BoundaryChipFrame>
  ) : null;
}
