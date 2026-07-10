'use client';

/**
 * ADR-632 Φ5 — Slab-opening Advanced Properties panel («όπως οι μεγάλοι»: Revit
 * Properties palette / C4D Attribute manager / Figma inspector — κάθε επιλεγμένο
 * στοιχείο έχει panel με ιδιότητες + warnings).
 *
 * Presentational, read-only readout (kind / εμβαδό / κατάσταση διαχείρισης) +
 * το `SlabOpeningWarningsSection` (surfacing των `validation.violationKeys` ως
 * κείμενο — π.χ. auto «well» opening στο χείλος πλάκας). Η επεξεργασία
 * kind/fireRating + το Override ζουν στο contextual ribbon tab (SSoT edit path).
 *
 * @see ./sections/SlabOpeningWarningsSection.tsx
 * @see ../wall-advanced-panel/BimPropertiesRouter.tsx — mount point
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { isManagedOpeningParams } from '../../bim/stairs/managed-slab-opening-lock';
import { SlabOpeningWarningsSection } from './sections/SlabOpeningWarningsSection';

export interface SlabOpeningAdvancedPanelProps {
  readonly opening: SlabOpeningEntity;
  readonly containerClassName?: string;
}

/** managed → engine-owned/locked· detached → user-overridden· manual → κανονικό. */
function resolveStatusKey(opening: SlabOpeningEntity): 'managed' | 'detached' | 'manual' {
  if (isManagedOpeningParams(opening.params)) return 'managed';
  if (opening.params.autoStairId != null && opening.params.autoStairDetached === true) {
    return 'detached';
  }
  return 'manual';
}

export function SlabOpeningAdvancedPanel({
  opening,
  containerClassName,
}: SlabOpeningAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { params, geometry } = opening;
  const statusKey = resolveStatusKey(opening);

  return (
    <div className={containerClassName ?? 'flex flex-col gap-3 p-2'}>
      <SlabOpeningWarningsSection opening={opening} />
      <section className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold text-foreground">
          {t('slabOpeningAdvancedPanel.sections.info.title')}
        </h4>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">{t('slabOpeningAdvancedPanel.info.kind')}</dt>
          <dd className="text-foreground">
            {t(`ribbon.commands.slabOpeningEditor.kind.${params.kind}`)}
          </dd>
          <dt className="text-muted-foreground">{t('slabOpeningAdvancedPanel.info.area')}</dt>
          <dd className="text-foreground">{`${geometry.area.toFixed(2)} m²`}</dd>
          <dt className="text-muted-foreground">{t('slabOpeningAdvancedPanel.info.status')}</dt>
          <dd className="text-foreground">{t(`slabOpeningAdvancedPanel.status.${statusKey}`)}</dd>
        </dl>
      </section>
    </div>
  );
}
