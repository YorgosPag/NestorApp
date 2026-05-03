'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Project } from '@/types/project';
import type { PlotFrontage } from '@/types/project-building-code';
import { FrontageAddressSelector } from './FrontageAddressSelector';

interface FrontagesListProps {
  frontages: readonly PlotFrontage[];
  frontagesCount: number;
  project: Project | null;
  isEditing: boolean;
  onFrontageAddressChange(index: number, addressId: string | undefined): void;
}

export function FrontagesList({
  frontages,
  frontagesCount,
  project,
  isEditing,
  onFrontageAddressChange,
}: FrontagesListProps) {
  const { t } = useTranslation('buildingCode');

  const items: PlotFrontage[] = Array.from({ length: frontagesCount }, (_, i) => {
    const index = i + 1;
    return frontages.find((f) => f.index === index) ?? { index };
  });

  return (
    <section className="space-y-4 border-t pt-4">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {t('frontages.sectionTitle')}
      </h4>

      <ul className="space-y-3">
        {items.map((frontage) => (
          <li key={frontage.index} className="grid grid-cols-[7rem_1fr] items-center gap-3">
            <span className="text-sm font-medium">
              {t('frontages.frontageLabel', { index: frontage.index })}
            </span>
            <FrontageAddressSelector
              frontage={frontage}
              project={project}
              isEditing={isEditing}
              onChange={onFrontageAddressChange}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
