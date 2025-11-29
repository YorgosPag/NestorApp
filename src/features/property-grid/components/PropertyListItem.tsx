'use client';
import { Eye, Square, Bed, Building } from 'lucide-react';
import { CommonBadge } from '@/core/badges';
import { getPropertyImage } from '../utils/images';

export function PropertyListItem({ property, onViewFloorPlan }: { property: any; onViewFloorPlan: (id: string) => void; }) {
  return (
    <div className="w-full bg-white dark:bg-card rounded-xl shadow-md ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 p-4 flex gap-4">
      <img
        src={getPropertyImage(property)}
        alt={property.name}
        className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg flex-shrink-0"
      />
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-foreground">{property.name}</h3>
            <p className="text-sm text-gray-500 dark:text-muted-foreground flex items-center gap-1 mt-1">
              <Building className="h-3 w-3" />
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
          €{property.price?.toLocaleString() || 'Επικοινωνήστε'}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-gray-600 dark:text-muted-foreground text-sm mt-2">
          <span className="flex items-center gap-1">
            <Square className="h-4 w-4" />
            {property.area} m²
          </span>
          {property.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bed className="h-4 w-4" />
              {property.bedrooms}
            </span>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onViewFloorPlan(property.id)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Eye className="h-4 w-4" />
            Δείτε στην κάτοψη
          </button>
        </div>
      </div>
    </div>
  );
}
