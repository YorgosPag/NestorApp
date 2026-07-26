'use client';

/**
 * @module reports/sections/projects/EnergyClassDistribution
 * @enterprise ADR-265 Phase 7 — Units by energy class pie chart
 * @enterprise ADR-710 §11.6 — the defect this chart carried, removed at the source
 *
 * It used to map each class to a palette slot by hand, and "A+" and "A" were both given
 * slot 3 — two slices of the same pie in an identical colour, which no reader can tell
 * apart. "B+" was missing from the map altogether and fell to the fallback slot, which
 * "E" already held. Neither could fail a test, because both rendered perfectly.
 *
 * Now the chart declares the EU class order and nothing else, so two classes cannot
 * collide. The order is the canonical ENERGY_CLASSES SSoT — best to worst.
 *
 * Open, recorded rather than guessed (ADR-710 §11.7): the scale is **ordinal**, so the
 * textbook encoding is a sequential ramp rather than nine categorical hues, and there are
 * nine classes against a palette ceiling of eight. No ramp token exists in globals.css,
 * and inventing one here would create a second palette outside the reach of CHECK 3.32.
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportCategoryPies,
  ReportEmptyState,
} from '@/components/reports/core';
import { ENERGY_CLASSES } from '@/constants/energy-classes';
import type { EnergyClassItem } from './types';

interface EnergyClassDistributionProps {
  data: EnergyClassItem[];
  loading?: boolean;
}

export function EnergyClassDistribution({ data, loading }: EnergyClassDistributionProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      {
        data,
        categoryLabel: t('chart.category.energyClass'),
        categoryOrder: ENERGY_CLASSES,
      },
    ],
    [data, t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.energyClass.title')} id="energy-class">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.energyClass.title')}
      description={t('projects.energyClass.description')}
      id="energy-class"
    >
      <ReportCategoryPies charts={charts} size="md" />
    </ReportSection>
  );
}
