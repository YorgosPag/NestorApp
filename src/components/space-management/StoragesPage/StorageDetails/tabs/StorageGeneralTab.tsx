'use client';

import React from 'react';
import { formatDate, formatCurrency } from '@/lib/intl-utils';
import type { Storage } from '@/types/storage/contracts';
import { Warehouse, MapPin, Calendar, User, Euro, Layers } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

interface StorageGeneralTabProps {
  storage: Storage;
}

export function StorageGeneralTab({ storage }: StorageGeneralTabProps) {
  const iconSizes = useIconSizes();
  return (
    <div className="p-6 space-y-6">
      {/* Βασικές Πληροφορίες */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Warehouse className={iconSizes.md} />
          Βασικές Πληροφορίες
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Όνομα Αποθήκης</label>
            <p className="mt-1 text-sm">{storage.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Τύπος</label>
            <p className="mt-1 text-sm">
              {storage.type === 'large' ? 'Μεγάλη' :
               storage.type === 'small' ? 'Μικρή' :
               storage.type === 'basement' ? 'Υπόγεια' :
               storage.type === 'ground' ? 'Ισόγεια' :
               storage.type === 'special' ? 'Ειδική' : 'Άγνωστο'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Κατάσταση</label>
            <p className="mt-1 text-sm">
              {storage.status === 'available' ? 'Διαθέσιμη' :
               storage.status === 'occupied' ? 'Κατειλημμένη' :
               storage.status === 'reserved' ? 'Κρατημένη' :
               storage.status === 'maintenance' ? 'Συντήρηση' : 'Άγνωστη'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Επιφάνεια</label>
            <p className="mt-1 text-sm">{storage.area} m²</p>
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
            <label className="text-sm font-medium text-muted-foreground">Κτίριο</label>
            <p className="mt-1 text-sm">{storage.building}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Όροφος</label>
            <p className="mt-1 text-sm">{storage.floor}</p>
          </div>
        </div>
      </section>

      {/* Οικονομικά Στοιχεία */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          {/* 🏢 ENTERPRISE: Using Euro icon for financial section */}
          <Euro className={iconSizes.md} />
          Οικονομικά Στοιχεία
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Τιμή</label>
            <p className="mt-1 text-sm">
              {storage.price ? formatCurrency(storage.price) : 'Δεν έχει οριστεί'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Τιμή ανά m²</label>
            <p className="mt-1 text-sm">
              {storage.price && storage.area
                ? formatCurrency(storage.price / storage.area)
                : 'Δεν υπολογίζεται'
              }
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Έργο</label>
            <p className="mt-1 text-sm">
              {storage.projectId || 'Δεν έχει καθοριστεί'}
            </p>
          </div>
        </div>
      </section>

      {/* Περιγραφή & Σημειώσεις */}
      {(storage.description || storage.notes) && (
        <section>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Layers className={iconSizes.md} />
            Περιγραφή & Σημειώσεις
          </h3>
          <div className="space-y-4">
            {storage.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Περιγραφή</label>
                <p className="mt-1 text-sm">{storage.description}</p>
              </div>
            )}
            {storage.notes && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Σημειώσεις</label>
                <p className="mt-1 text-sm">{storage.notes}</p>
              </div>
            )}
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
          {storage.lastUpdated && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Τελευταία Ενημέρωση</label>
              <p className="mt-1 text-sm">{formatDate(
                storage.lastUpdated instanceof Date
                  ? storage.lastUpdated.toISOString()
                  : storage.lastUpdated
              )}</p>
            </div>
          )}
          {storage.owner && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Ιδιοκτήτης</label>
              <p className="mt-1 text-sm">{storage.owner}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}