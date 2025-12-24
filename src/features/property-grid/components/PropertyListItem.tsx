'use client';
import { Eye, Square, Bed, Building } from 'lucide-react';
import { CommonBadge } from '@/core/badges';
import { formatCurrency } from '@/lib/intl-utils';
import { getPropertyImage } from '../utils/images';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

export function PropertyListItem({ property, onViewFloorPlan }: { property: any; onViewFloorPlan: (id: string) => void; }) {
  const iconSizes = useIconSizes();

  return (
    <div className={`w-full bg-white dark:bg-card rounded-xl shadow-md ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden p-4 flex gap-4 ${TRANSITION_PRESETS.SMOOTH_ALL} ${INTERACTIVE_PATTERNS.CARD_ENHANCED}`}>
      <img
        src={getPropertyImage(property)}
        alt={property.name}
        className={`${iconSizes.xl6} sm:${iconSizes.xl8} object-cover rounded-lg flex-shrink-0`}
      />
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-foreground">{property.name}</h3>
            <p className="text-sm text-gray-500 dark:text-muted-foreground flex items-center gap-1 mt-1">
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

        <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-2">
          {property.price ? formatCurrency(property.price) : 'Επικοινωνήστε'}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-gray-600 dark:text-muted-foreground text-sm mt-2">
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
            className={`px-4 py-2 bg-blue-600 text-white rounded-lg ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS} flex items-center gap-2 text-sm font-medium`}
          >
            <Eye className={iconSizes.sm} />
            Δείτε στην κάτοψη
          </button>
        </div>
      </div>
    </div>
  );
}
