'use client';
import { Eye, Square, Bed, Building } from 'lucide-react';
import { CommonBadge } from '@/core/badges';
import { getPropertyImage } from '../utils/images';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

export function PropertyListItem({ property, onViewFloorPlan }: { property: any; onViewFloorPlan: (id: string) => void; }) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { radius } = useBorderTokens();
  return (
    <div className={`w-full ${colors.bg.primary} ${radius.xl} shadow-md ring-1 ${colors.border.muted} overflow-hidden p-4 flex gap-4 ${TRANSITION_PRESETS.SMOOTH_ALL} ${INTERACTIVE_PATTERNS.CARD_ENHANCED}`}>
      <img
        src={getPropertyImage(property)}
        alt={property.name}
        className={`w-24 h-24 sm:w-32 sm:h-32 object-cover ${radius.lg} flex-shrink-0`}
      />
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div>
            <h3 className={`text-lg font-bold ${colors.text.primary}`}>{property.name}</h3>
            <p className={`text-sm ${colors.text.muted} flex items-center gap-1 mt-1`}>
              <Building className={iconSizes.xs} />
              {property.project} • {property.building} • {property.floor}ος όροφος
            </p>
          </div>
          <CommonBadge
            status="category"
            customLabel={property.type}
            className="text-xs truncate max-w-[90px]"
          />
        </div>

        <div className={`text-xl font-bold ${colors.text.info} mt-2`}>
          €{property.price?.toLocaleString() || 'Επικοινωνήστε'}
        </div>

        <div className={`flex flex-wrap items-center gap-2 sm:gap-4 ${colors.text.muted} text-sm mt-2`}>
          <span className="flex items-center gap-1">
            <Square className={iconSizes.sm} />
            {property.area} m²
          </span>
          {property.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bed className={iconSizes.sm} />
              {property.bedrooms}
            </span>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onViewFloorPlan(property.id)}
            className={`px-4 py-2 ${colors.bg.info} ${colors.text.infoContrast} ${radius.lg} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS} flex items-center gap-2 text-sm font-medium`}
          >
            <Eye className={iconSizes.sm} />
            Δείτε στην κάτοψη
          </button>
        </div>
      </div>
    </div>
  );
}
