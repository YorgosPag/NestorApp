'use client';

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function AdvancedFiltersPanel({
  show,
  priceRange, setPriceRange,
  areaRange, setAreaRange,
}: {
  show: boolean;
  priceRange: { min: string; max: string };
  setPriceRange: (r: { min: string; max: string }) => void;
  areaRange: { min: string; max: string };
  setAreaRange: (r: { min: string; max: string }) => void;
}) {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  // Enterprise input styling - centralized pattern
  const inputClasses = `flex-1 px-3 py-2 ${quick.input} dark:border-border ${colors.bg.primary} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <>
      {show && (
        <div className={`mt-4 p-4 ${colors.bg.secondary} dark:bg-muted/30 ${quick.card}`}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`text-sm font-medium ${colors.text.foreground} mb-1 block`}>{t('grid.filters.priceRange')}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={t('grid.filters.from')}
                  value={priceRange.min}
                  onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                  className={inputClasses}
                />
                <input
                  type="number"
                  placeholder={t('grid.filters.to')}
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                  className={inputClasses}
                />
              </div>
            </div>
            <div>
              <label className={`text-sm font-medium ${colors.text.foreground} mb-1 block`}>{t('grid.filters.area')}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={t('grid.filters.from')}
                  value={areaRange.min}
                  onChange={(e) => setAreaRange({ ...areaRange, min: e.target.value })}
                  className={inputClasses}
                />
                <input
                  type="number"
                  placeholder={t('grid.filters.to')}
                  value={areaRange.max}
                  onChange={(e) => setAreaRange({ ...areaRange, max: e.target.value })}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}