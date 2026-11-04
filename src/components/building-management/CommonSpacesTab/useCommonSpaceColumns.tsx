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

type Translate = (key: string) => string;

export function useCommonSpaceColumns(t: Translate): SpaceColumn<CommonSpace>[] {
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
      key: 'legalNature',
      label: t('tab.columns.legalNature'),
      sortValue: (space) => space.legalNature,
      render: (space) => <span className={colors.text.muted}>{t(`legalNature.${space.legalNature}`)}</span>,
      exportCell: (space) => t(`legalNature.${space.legalNature}`),
    },
  ], [t, colors.text.muted, floorLabel]);
}
