'use client';

/**
 * Κοινόχρηστοι ανά κτίριο (ADR-931) — κάθε γραμμή οδηγεί στην καρτέλα του κτιρίου, όπου
 * ο χώρος **καταχωρείται και διορθώνεται**. Το όνομα κτιρίου έρχεται από τη ζωντανή λίστα κτιρίων.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';
import { ENTITY_ROUTES } from '@/lib/routes';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatNumber } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';
import type { BuildingTally } from '@/lib/common-spaces/common-space-stats';

interface CommonSpacesByBuildingProps {
  readonly buildings: readonly BuildingTally[];
  readonly buildingNames: ReadonlyMap<string, string>;
}

export function CommonSpacesByBuilding({ buildings, buildingNames }: CommonSpacesByBuildingProps) {
  const { t } = useTranslation('common-spaces');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <section className="space-y-4" aria-labelledby="common-spaces-by-building">
      <h2 id="common-spaces-by-building" className="text-lg font-semibold flex items-center gap-2">
        <Building2 className={iconSizes.md} aria-hidden="true" />
        {t('byBuilding.title')}
      </h2>
      <ul className={cn('bg-card divide-y', quick.card)}>
        {buildings.map((entry) => (
          <li key={entry.buildingId}>
            <Link
              href={ENTITY_ROUTES.buildings.withId(entry.buildingId)}
              className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-accent/50 transition-colors"
            >
              <span className="font-medium">
                {buildingNames.get(entry.buildingId) ?? t('byBuilding.unknownBuilding')}
              </span>
              <span className={cn('text-sm', colors.text.muted)}>
                {t('spacesCount', { count: entry.count })}
                {entry.areaM2 > 0 && ` · ${t('stats.areaValue', { area: formatNumber(entry.areaM2, { maximumFractionDigits: 1 }) })}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
