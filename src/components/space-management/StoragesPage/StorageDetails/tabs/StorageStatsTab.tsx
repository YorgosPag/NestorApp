'use client';

import React from 'react';
import { formatCurrency } from '@/lib/intl-utils';
import type { Storage } from '@/types/storage/contracts';
import { BarChart3, TrendingUp, DollarSign, Square } from 'lucide-react';

interface StorageStatsTabProps {
  storage: Storage;
}

function getEfficiencyScore(storage: Storage): number {
  // Calculate a simple efficiency score based on price per m² and status
  if (!storage.price || storage.status === 'maintenance') return 0;

  const pricePerSqm = storage.price / storage.area;
  const statusMultiplier = storage.status === 'occupied' ? 1.2 :
                          storage.status === 'reserved' ? 1.1 : 1.0;

  // Normalize to 0-100 scale (assuming €500/m² is max efficiency)
  return Math.min(100, Math.round((pricePerSqm / 500) * 100 * statusMultiplier));
}

export function StorageStatsTab({ storage }: StorageStatsTabProps) {
  const pricePerSqm = storage.price && storage.area ? storage.price / storage.area : 0;
  const efficiencyScore = getEfficiencyScore(storage);

  const stats = [
    {
      icon: Square,
      label: 'Συνολική Επιφάνεια',
      value: `${storage.area} m²`,
      color: 'text-blue-600'
    },
    {
      icon: DollarSign,
      label: 'Συνολική Αξία',
      value: storage.price ? formatCurrency(storage.price) : 'Δεν έχει οριστεί',
      color: 'text-green-600'
    },
    {
      icon: TrendingUp,
      label: 'Τιμή ανά m²',
      value: pricePerSqm ? formatCurrency(pricePerSqm) : 'Δεν υπολογίζεται',
      color: 'text-purple-600'
    },
    {
      icon: BarChart3,
      label: 'Βαθμός Αποδοτικότητας',
      value: `${efficiencyScore}%`,
      color: efficiencyScore > 70 ? 'text-green-600' :
             efficiencyScore > 40 ? 'text-yellow-600' : 'text-red-600'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Statistics Cards */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Στατιστικά Αποθήκης
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="bg-card border rounded-lg p-4 text-center">
                <IconComponent className={`w-8 h-8 mx-auto mb-2 ${stat.color}`} />
                <p className="text-lg font-semibold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Detailed Analysis */}
      <section>
        <h3 className="font-semibold mb-4">Αναλυτικά Στοιχεία</h3>
        <div className="bg-card border rounded-lg p-4 space-y-4">
          {/* Efficiency Breakdown */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Αποδοτικότητα</span>
              <span className="text-sm font-medium">{efficiencyScore}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  efficiencyScore > 70 ? 'bg-green-500' :
                  efficiencyScore > 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${efficiencyScore}%` }}
              />
            </div>
          </div>

          {/* Status Analysis */}
          <div>
            <span className="text-sm font-medium">Ανάλυση Κατάστασης</span>
            <p className="text-sm text-muted-foreground mt-1">
              {storage.status === 'available' ?
                'Η αποθήκη είναι διαθέσιμη για μίσθωση ή πώληση.' :
               storage.status === 'occupied' ?
                'Η αποθήκη είναι κατειλημμένη και παράγει εισόδημα.' :
               storage.status === 'reserved' ?
                'Η αποθήκη έχει κρατηθεί για συγκεκριμένη χρήση.' :
                'Η αποθήκη βρίσκεται σε συντήρηση και δεν είναι διαθέσιμη.'}
            </p>
          </div>

          {/* Price Analysis */}
          {storage.price && (
            <div>
              <span className="text-sm font-medium">Οικονομική Ανάλυση</span>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Συνολική Αξία:</span>
                  <span className="font-medium ml-2">{formatCurrency(storage.price)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Κόστος/m²:</span>
                  <span className="font-medium ml-2">{formatCurrency(pricePerSqm)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Technical Details */}
      <section>
        <h3 className="font-semibold mb-4">Τεχνικές Προδιαγραφές</h3>
        <div className="bg-card border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Τύπος:</span>
              <span className="font-medium ml-2">
                {storage.type === 'large' ? 'Μεγάλη Αποθήκη' :
                 storage.type === 'small' ? 'Μικρή Αποθήκη' :
                 storage.type === 'basement' ? 'Υπόγεια Αποθήκη' :
                 storage.type === 'ground' ? 'Ισόγεια Αποθήκη' :
                 storage.type === 'special' ? 'Ειδική Αποθήκη' : 'Άγνωστο'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Κτίριο:</span>
              <span className="font-medium ml-2">{storage.building}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Όροφος:</span>
              <span className="font-medium ml-2">{storage.floor}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}