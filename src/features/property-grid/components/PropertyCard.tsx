'use client';
import { Eye, ArrowRight, Heart, Square, Bed, Bath, Building } from 'lucide-react';
import { getPropertyImage } from '../utils/images';

export function PropertyCard({ property, onViewFloorPlan }: { property: any; onViewFloorPlan: (id: string) => void; }) {
  return (
    <div className="bg-white dark:bg-card rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer">
      <div className="relative h-48 overflow-hidden bg-gray-100 dark:bg-muted/30">
        <img
          src={getPropertyImage(property)}
          alt={property.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
            Διαθέσιμο
          </span>
        </div>
        <button className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-gray-800/80 backdrop-blur rounded-full hover:bg-white dark:hover:bg-gray-700 transition-colors">
          <Heart className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-foreground">{property.name}</h3>
            <p className="text-sm text-gray-500 dark:text-muted-foreground flex items-center gap-1 mt-1">
              <Building className="h-3 w-3" />
              {property.project} • {property.building} • {property.floor}ος όροφος
            </p>
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-muted rounded-lg text-foreground">
            {property.type}
          </span>
        </div>

        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-3">
          €{property.price?.toLocaleString() || 'Επικοινωνήστε'}
        </div>

        <div className="flex items-center gap-4 text-gray-600 dark:text-muted-foreground text-sm mb-4">
          <span className="flex items-center gap-1">
            <Square className="h-4 w-4" />
            {property.area} m²
          </span>
          {property.bedrooms !== undefined && property.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bed className="h-4 w-4" />
              {property.bedrooms}
            </span>
          )}
          {property.bathrooms !== undefined && property.bathrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bath className="h-4 w-4" />
              {property.bathrooms}
            </span>
          )}
        </div>

        {property.tags && property.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {property.tags.slice(0, 3).map((tag: string, idx: number) => (
              <span key={idx} className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onViewFloorPlan(property.id)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <Eye className="h-4 w-4" />
            Δείτε στην κάτοψη
          </button>
          <button className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <ArrowRight className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
