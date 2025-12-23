'use client';
import { Eye, ArrowRight, Heart, Square, Bed, Bath, Building } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { PropertyBadge, CommonBadge } from '@/core/badges';
import { getPropertyImage } from '../utils/images';
import { COMPLEX_HOVER_EFFECTS, TRANSITION_PRESETS, INTERACTIVE_PATTERNS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';

export function PropertyCard({ property, onViewFloorPlan }: { property: any; onViewFloorPlan: (id: string) => void; }) {
  const iconSizes = useIconSizes();
  return (
    <article className={`w-full flex flex-col bg-white dark:bg-card rounded-xl shadow-md ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden group cursor-pointer ${COMPLEX_HOVER_EFFECTS.FEATURE_CARD}`} itemScope itemType="https://schema.org/RealEstateProperty">
      <header className="relative h-48 overflow-hidden bg-gray-100 dark:bg-muted/30">
        <img
          src={getPropertyImage(property)}
          alt={property.name}
          className={`w-full h-full object-cover ${GROUP_HOVER_PATTERNS.SCALE_ON_GROUP} ${TRANSITION_PRESETS.SLOW_TRANSFORM}`}
        />
        <aside className="absolute top-3 left-3" role="status" aria-label="Κατάσταση Ακινήτου">
          <PropertyBadge
            status="available"
            customLabel="Διαθέσιμο"
          />
        </aside>
        <button className={`absolute top-3 right-3 p-2 bg-white/90 dark:bg-gray-800/80 backdrop-blur rounded-full ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
          <Heart className={`${iconSizes.sm} text-gray-600 dark:text-gray-300`} />
        </button>
      </header>

      <main className="p-5">
        <header className="flex justify-between items-start mb-2">
          <section aria-label="Πληροφορίες Ακινήτου">
            <h3 className="text-lg font-bold text-gray-900 dark:text-foreground" itemProp="name">{property.name}</h3>
            <p className="text-sm text-gray-500 dark:text-muted-foreground flex items-center gap-1 mt-1">
              <Building className={iconSizes.xs} />
              <span itemProp="location">{property.project} • {property.building} • {property.floor}ος όροφος</span>
            </p>
          </section>
          <CommonBadge
            status="category"
            customLabel={property.type}
            className="text-xs truncate max-w-[90px]"
          />
        </header>

        <aside className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-3" role="region" aria-label="Τιμή Ακινήτου">
          <span itemProp="price">€{property.price?.toLocaleString() || 'Επικοινωνήστε'}</span>
        </aside>

        <section className="flex flex-wrap items-center gap-2 sm:gap-4 text-gray-600 dark:text-muted-foreground text-sm mb-4" aria-label="Χαρακτηριστικά Ακινήτου">
          <span className="flex items-center gap-1" itemProp="floorSize">
            <Square className={iconSizes.sm} />
            {property.area} m²
          </span>
          {property.bedrooms !== undefined && property.bedrooms > 0 && (
            <span className="flex items-center gap-1" itemProp="numberOfRooms">
              <Bed className={iconSizes.sm} />
              {property.bedrooms}
            </span>
          )}
          {property.bathrooms !== undefined && property.bathrooms > 0 && (
            <span className="flex items-center gap-1" itemProp="numberOfBathroomsTotal">
              <Bath className={iconSizes.sm} />
              {property.bathrooms}
            </span>
          )}
        </section>

        {property.tags && property.tags.length > 0 && (
          <section className="flex flex-wrap gap-1 mb-4" aria-label="Χαρακτηριστικά Ταγκς">
            {property.tags.slice(0, 3).map((tag: string, idx: number) => (
              <CommonBadge
                key={idx}
                status="feature"
                customLabel={tag}
              />
            ))}
          </section>
        )}

        <footer className="flex gap-2" role="contentinfo" aria-label="Ενέργειες Ακινήτου">
          <button
            onClick={() => onViewFloorPlan(property.id)}
            className={`flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-medium ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
          >
            <Eye className={iconSizes.sm} />
            Δείτε στην κάτοψη
          </button>
          <button className={`px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
            <ArrowRight className={`${iconSizes.sm} text-gray-600 dark:text-gray-300`} />
          </button>
        </footer>
      </main>
    </article>
  );
}
