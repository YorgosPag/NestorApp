'use client';

/**
 * Οι στήλες του πίνακα κοινόχρηστων (ADR-931) — όροφος/εμβαδόν από τα **κοινά** builders
 * των χώρων κτιρίου (ADR-184 · ADR-898 Φ4β), όχι αντίγραφα.
 */

import { useMemo } from 'react';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { CommonSpace } from '@/types/common-space';
import { buildAreaColumn, buildFloorColumn, type SpaceColumn } from '../shared';
import { CommonSpaceDrawnAreaCell } from './CommonSpaceDrawnAreaCell';

type Translate = (key: string, options?: Record<string, string | number>) => string;

/** ADR-931 Β1 — η ενέργεια «υιοθέτηση σχεδίου» της στήλης «Από την κάτοψη». */
export interface DrawnAreaActions {
  readonly adoptingId: string | null;
  readonly onAdopt: (space: CommonSpace) => void;
}

export function useCommonSpaceColumns(t: Translate, drawn: DrawnAreaActions): SpaceColumn<CommonSpace>[] {
  const floorLabel = useFloorLabel();
  const colors = useSemanticColors();

  return useMemo(() => [
    {
      key: 'name',
      label: t('tab.columns.name'),
      sortValue: (space) => space.name,
      render: (space) => <span className="font-medium">{space.name}</span>,
      exportCell: (space) => space.name,
    },
    {
      key: 'category',
      label: t('tab.columns.category'),
      sortValue: (space) => t(`categories.${space.category}`),
      render: (space) => <span className={colors.text.muted}>{t(`categories.${space.category}`)}</span>,
      exportCell: (space) => t(`categories.${space.category}`),
    },
    buildFloorColumn<CommonSpace>(t('tab.columns.floor'), colors.text.muted, floorLabel),
    buildAreaColumn<CommonSpace>(t('tab.columns.area'), (space) => space.area ?? null),
    {
      key: 'drawnArea',
      label: t('tab.columns.drawnArea'),
      sortValue: (space) => space.drawnArea ?? null,
      render: (space) => (
        <CommonSpaceDrawnAreaCell
          space={space}
          t={t}
          mutedClass={colors.text.muted}
          adopting={drawn.adoptingId === space.id}
          onAdopt={drawn.onAdopt}
        />
      ),
      exportCell: (space) => space.drawnArea ?? null,
      exportFormat: 'number',
      exportTotal: 'sum',
    },
    {
      key: 'legalNature',
      label: t('tab.columns.legalNature'),
      sortValue: (space) => space.legalNature,
      render: (space) => <span className={colors.text.muted}>{t(`legalNature.${space.legalNature}`)}</span>,
      exportCell: (space) => t(`legalNature.${space.legalNature}`),
    },
  ], [t, colors.text.muted, floorLabel, drawn.adoptingId, drawn.onAdopt]);
}
