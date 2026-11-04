'use client';

/**
 * Μία ομάδα κοινόχρηστων (ADR-931): πλήθος, δηλωμένο εμβαδόν, και οι κατηγορίες που **υπάρχουν**.
 * Ομάδα χωρίς χώρους εμφανίζεται με 0 — η οθόνη δείχνει και ό,τι λείπει.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatNumber } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { GroupTally } from '@/lib/common-spaces/common-space-stats';
import { COMMON_SPACE_GROUP_VISUALS } from './common-space-group-visuals';

interface CommonSpaceGroupCardProps {
  readonly tally: GroupTally;
}

export function CommonSpaceGroupCard({ tally }: CommonSpaceGroupCardProps) {
  const { t } = useTranslation('common-spaces');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const Icon = COMMON_SPACE_GROUP_VISUALS[tally.group].icon;

  return (
    <article className={cn('p-6 bg-card', quick.card)} aria-labelledby={`common-group-${tally.group}`}>
      <header className="flex items-center gap-3 mb-3">
        <Icon className={cn(iconSizes.md, colors.text.muted)} aria-hidden="true" />
        <h3 id={`common-group-${tally.group}`} className="font-semibold">
          {t(`groups.${tally.group}.title`)}
        </h3>
      </header>
      <p className={cn('text-sm mb-2', colors.text.muted)}>{t(`groups.${tally.group}.description`)}</p>
      <p className="text-2xl font-bold">{formatNumber(tally.count)}</p>
      {tally.areaM2 > 0 && (
        <p className={cn('text-xs mt-1', colors.text.muted)}>
          {t('stats.areaValue', { area: formatNumber(tally.areaM2, { maximumFractionDigits: 1 }) })}
        </p>
      )}
      {tally.categories.length === 0 ? (
        <p className={cn('text-xs mt-3', colors.text.muted)}>{t('noSpacesInGroup')}</p>
      ) : (
        <dl className="mt-3 space-y-1 text-sm">
          {tally.categories.map((entry) => (
            <div key={entry.category} className="flex justify-between gap-2">
              <dt className={colors.text.muted}>{t(`categories.${entry.category}`)}</dt>
              <dd className="font-medium">{t('spacesCount', { count: entry.count })}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
