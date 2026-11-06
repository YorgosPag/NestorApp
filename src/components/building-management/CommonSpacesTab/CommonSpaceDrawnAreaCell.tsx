'use client';

/**
 * Το κελί «Από την κάτοψη» (ADR-931 §6 Β1) — **πέρα από τη Revit**, που δείχνει μόνο το υπολογισμένο: εδώ φαίνονται
 * σχέδιο **και** δήλωση, και όταν διαφωνούν πάνω από το όριο (`areaDivergenceOf`) ο άνθρωπος βλέπει σήμα και
 * αποφασίζει («υιοθέτηση σχεδίου»). Ποτέ σιωπηλή διόρθωση.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { formatNumber } from '@/lib/intl-formatting';
import { areaDivergenceOf } from '@/lib/common-spaces/common-space-area';
import type { CommonSpace } from '@/types/common-space';

type Translate = (key: string, options?: Record<string, string | number>) => string;

const AREA_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 2 };
const PERCENT_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 1 };

export interface CommonSpaceDrawnAreaCellProps {
  readonly space: CommonSpace;
  readonly t: Translate;
  readonly mutedClass: string;
  readonly adopting: boolean;
  readonly onAdopt: (space: CommonSpace) => void;
}

function AdoptButton({ space, t, adopting, onAdopt }: Omit<CommonSpaceDrawnAreaCellProps, 'mutedClass'>) {
  return (
    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={adopting} onClick={() => onAdopt(space)}>
      {t(adopting ? 'tab.area.adopting' : 'tab.area.adopt')}
    </Button>
  );
}

export function CommonSpaceDrawnAreaCell(props: CommonSpaceDrawnAreaCellProps) {
  const { space, t, mutedClass } = props;
  if (space.drawnArea === undefined) {
    return <span className={`text-xs ${mutedClass}`}>{t('tab.area.notDrawn')}</span>;
  }

  const drawn = formatNumber(space.drawnArea, AREA_FORMAT);
  const divergence = areaDivergenceOf(space);
  const bound = space.areaSource === 'drawn';

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="font-mono text-xs">{drawn}</span>
      {bound && (
        <>
          <Badge variant="info">{t('tab.area.boundToDrawing')}</Badge>
          <InfoTooltip content={t('tab.area.boundToDrawingHint')} />
        </>
      )}
      {divergence.kind === 'diverges' && (
        <>
          <Badge variant="warning">
            {t('tab.area.diverges', { percent: formatNumber(divergence.ratio * 100, PERCENT_FORMAT) })}
          </Badge>
          <InfoTooltip
            content={t('tab.area.divergesHint', {
              drawn,
              declared: formatNumber(divergence.declared, AREA_FORMAT),
            })}
          />
        </>
      )}
      {!bound && (divergence.kind === 'diverges' || space.area === undefined) && <AdoptButton {...props} />}
    </span>
  );
}
