'use client';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

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
  const colors = useSemanticColors();
  const { radius } = useBorderTokens();
  return (
    <>
      {show && (
        <div className={`mt-4 p-4 ${colors.bg.secondary} ${radius.lg} border ${colors.border.muted}`}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`text-sm font-medium ${colors.text.primary} mb-1 block`}>Εύρος Τιμής (€)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Από"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                  className={`flex-1 px-3 py-2 border ${colors.border.muted} ${colors.bg.primary} ${radius.md} focus:outline-none ${colors.interactive.focus.ring}`}
                />
                <input
                  type="number"
                  placeholder="Έως"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                  className={`flex-1 px-3 py-2 border ${colors.border.muted} ${colors.bg.primary} ${radius.md} focus:outline-none ${colors.interactive.focus.ring}`}
                />
              </div>
            </div>
            <div>
              <label className={`text-sm font-medium ${colors.text.primary} mb-1 block`}>Εμβαδόν (m²)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Από"
                  value={areaRange.min}
                  onChange={(e) => setAreaRange({ ...areaRange, min: e.target.value })}
                  className={`flex-1 px-3 py-2 border ${colors.border.muted} ${colors.bg.primary} ${radius.md} focus:outline-none ${colors.interactive.focus.ring}`}
                />
                <input
                  type="number"
                  placeholder="Έως"
                  value={areaRange.max}
                  onChange={(e) => setAreaRange({ ...areaRange, max: e.target.value })}
                  className={`flex-1 px-3 py-2 border ${colors.border.muted} ${colors.bg.primary} ${radius.md} focus:outline-none ${colors.interactive.focus.ring}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
