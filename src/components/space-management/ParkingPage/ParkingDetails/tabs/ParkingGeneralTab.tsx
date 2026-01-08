'use client';

/**
 * 🅿️ ENTERPRISE PARKING GENERAL TAB COMPONENT
 *
 * Γενικές πληροφορίες θέσης στάθμευσης
 * Ακολουθεί το exact pattern από StorageGeneralTab.tsx
 */

import React from 'react';
import { formatDate, formatCurrency } from '@/lib/intl-utils';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { Car, MapPin, Calendar, Euro, Layers } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { PARKING_TYPE_LABELS, PARKING_STATUS_LABELS } from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';

interface ParkingGeneralTabProps {
  parking: ParkingSpot;
}

export function ParkingGeneralTab({ parking }: ParkingGeneralTabProps) {
  const iconSizes = useIconSizes();

  // Get type label
  const getTypeLabel = (type: string | undefined): string => {
    if (!type) return 'Άγνωστο';
    return PARKING_TYPE_LABELS[type as keyof typeof PARKING_TYPE_LABELS] || type;
  };

  // Get status label
  const getStatusLabel = (status: string | undefined): string => {
    if (!status) return 'Άγνωστη';
    return PARKING_STATUS_LABELS[status as keyof typeof PARKING_STATUS_LABELS] || status;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Βασικές Πληροφορίες */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Car className={iconSizes.md} />
          Βασικές Πληροφορίες
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Κωδικός Θέσης</label>
            <p className="mt-1 text-sm">{parking.number || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Τύπος</label>
            <p className="mt-1 text-sm">{getTypeLabel(parking.type)}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Κατάσταση</label>
            <p className="mt-1 text-sm">{getStatusLabel(parking.status)}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Επιφάνεια</label>
            <p className="mt-1 text-sm">{parking.area ? `${parking.area} m²` : 'N/A'}</p>
          </div>
        </div>
      </section>

      {/* Τοποθεσία */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <MapPin className={iconSizes.md} />
          Τοποθεσία
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Επίπεδο/Όροφος</label>
            <p className="mt-1 text-sm">{parking.floor || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Θέση</label>
            <p className="mt-1 text-sm">{parking.location || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Κτίριο ID</label>
            <p className="mt-1 text-sm font-mono text-xs">{parking.buildingId || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Έργο ID</label>
            <p className="mt-1 text-sm font-mono text-xs">{parking.projectId || 'N/A'}</p>
          </div>
        </div>
      </section>

      {/* Οικονομικά Στοιχεία */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Euro className={iconSizes.md} />
          Οικονομικά Στοιχεία
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Τιμή</label>
            <p className="mt-1 text-sm">
              {parking.price !== undefined && parking.price > 0
                ? formatCurrency(parking.price)
                : parking.price === 0
                  ? 'Κοινόχρηστη (Δωρεάν)'
                  : 'Δεν έχει οριστεί'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Τιμή ανά m²</label>
            <p className="mt-1 text-sm">
              {parking.price && parking.area && parking.price > 0
                ? formatCurrency(parking.price / parking.area)
                : 'Δεν υπολογίζεται'}
            </p>
          </div>
        </div>
      </section>

      {/* Σημειώσεις */}
      {parking.notes && (
        <section>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Layers className={iconSizes.md} />
            Σημειώσεις
          </h3>
          <div>
            <p className="text-sm bg-muted/50 p-4 rounded-lg">{parking.notes}</p>
          </div>
        </section>
      )}

      {/* Στοιχεία Ενημέρωσης */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar className={iconSizes.md} />
          Στοιχεία Ενημέρωσης
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {parking.createdAt && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Δημιουργήθηκε</label>
              <p className="mt-1 text-sm">{formatDate(
                parking.createdAt instanceof Date
                  ? parking.createdAt.toISOString()
                  : typeof parking.createdAt === 'object' && 'toDate' in parking.createdAt
                    ? (parking.createdAt as { toDate: () => Date }).toDate().toISOString()
                    : String(parking.createdAt)
              )}</p>
            </div>
          )}
          {parking.updatedAt && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Τελευταία Ενημέρωση</label>
              <p className="mt-1 text-sm">{formatDate(
                parking.updatedAt instanceof Date
                  ? parking.updatedAt.toISOString()
                  : typeof parking.updatedAt === 'object' && 'toDate' in parking.updatedAt
                    ? (parking.updatedAt as { toDate: () => Date }).toDate().toISOString()
                    : String(parking.updatedAt)
              )}</p>
            </div>
          )}
          {parking.createdBy && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Δημιουργήθηκε από</label>
              <p className="mt-1 text-sm">{parking.createdBy}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
