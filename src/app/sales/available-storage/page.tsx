'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Package,
  DollarSign,
  Warehouse,
  Archive,
  TrendingUp,
  Eye,
  MapPin,
  Calendar,
} from 'lucide-react';

// Placeholder stats for Available Storage
const storageStats: DashboardStat[] = [
  {
    title: 'Διαθέσιμες Αποθήκες',
    value: '89',
    description: 'Προς πώληση τώρα',
    icon: Package,
    color: 'orange',
    trend: { value: -3, label: 'Μείωση' }
  },
  {
    title: 'Μέση Τιμή',
    value: '€45K',
    description: 'Μέσος όρος τιμής',
    icon: DollarSign,
    color: 'green',
    trend: { value: 8, label: 'Αύξηση' }
  },
  {
    title: 'Ενδιαφέρον',
    value: '23',
    description: 'Ενεργές προβολές',
    icon: Eye,
    color: 'purple',
    trend: { value: 15, label: 'Αύξηση' }
  },
  {
    title: 'Μέσος Χρόνος',
    value: '6.8 μήνες',
    description: 'Στην αγορά',
    icon: Calendar,
    color: 'blue',
    trend: { value: -5, label: 'Μείωση' }
  }
];

export default function AvailableStoragePage() {
  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Διαθέσιμες Αποθήκες</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                Αποθήκες προς πώληση - Ενεργές καταχωρήσεις
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title="Διαθέσιμες Αποθήκες - Επισκόπηση"
              stats={storageStats}
              variant="modern"
            />

            {/* Storage Types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Μεγάλες Αποθήκες */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Warehouse className="h-5 w-5" />
                  Μεγάλες Αποθήκες ({'>'}50 τ.μ.)
                </h2>

                <div className="space-y-3">
                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <Warehouse className="h-4 w-4 text-orange-500" />
                      </div>
                      <h3 className="font-medium">Υπόγειες Μεγάλες</h3>
                      <span className="ml-auto bg-orange-500/20 text-orange-500 px-2 py-1 rounded text-sm font-medium">
                        23 διαθέσιμες
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span className="text-green-600 font-medium">€68K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Εύρος τ.μ.</span>
                        <span>50-120 τ.μ.</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Warehouse className="h-4 w-4 text-blue-500" />
                      </div>
                      <h3 className="font-medium">Ισόγειες Μεγάλες</h3>
                      <span className="ml-auto bg-blue-500/20 text-blue-500 px-2 py-1 rounded text-sm font-medium">
                        18 διαθέσιμες
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span className="text-green-600 font-medium">€85K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Εύρος τ.μ.</span>
                        <span>55-95 τ.μ.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Μικρές Αποθήκες */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  Μικρές Αποθήκες (≤50 τ.μ.)
                </h2>

                <div className="space-y-3">
                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Archive className="h-4 w-4 text-purple-500" />
                      </div>
                      <h3 className="font-medium">Υπόγειες Μικρές</h3>
                      <span className="ml-auto bg-purple-500/20 text-purple-500 px-2 py-1 rounded text-sm font-medium">
                        31 διαθέσιμες
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span className="text-green-600 font-medium">€28K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Εύρος τ.μ.</span>
                        <span>8-35 τ.μ.</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Archive className="h-4 w-4 text-green-500" />
                      </div>
                      <h3 className="font-medium">Ισόγειες Μικρές</h3>
                      <span className="ml-auto bg-green-500/20 text-green-500 px-2 py-1 rounded text-sm font-medium">
                        17 διαθέσιμες
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span className="text-green-600 font-medium">€35K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Εύρος τ.μ.</span>
                        <span>12-45 τ.μ.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Analysis & Market Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ανάλυση Τιμών */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Ανάλυση Τιμών
                </h2>

                <div className="p-6 bg-card border rounded-lg">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Οικονομικές ({'<'}€30K)</span>
                      <div className="text-right">
                        <div className="font-medium text-green-600">34 αποθήκες</div>
                        <div className="text-xs text-muted-foreground">€18K - €29K</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Μεσαίες (€30K - €60K)</span>
                      <div className="text-right">
                        <div className="font-medium text-blue-600">38 αποθήκες</div>
                        <div className="text-xs text-muted-foreground">€35K - €58K</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Premium ({'>'}€60K)</span>
                      <div className="text-right">
                        <div className="font-medium text-purple-600">17 αποθήκες</div>
                        <div className="text-xs text-muted-foreground">€65K - €125K</div>
                      </div>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center font-semibold">
                        <span>Μέση τιμή ανά τ.μ.</span>
                        <span className="text-green-600">€1,450/τ.μ.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Δραστηριότητα Αγοράς */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Δραστηριότητα Αγοράς
                </h2>

                <div className="p-6 bg-card border rounded-lg">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ενεργές προβολές</span>
                      <span className="font-medium text-blue-600">23 προβολές</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Αιτήματα επίσκεψης</span>
                      <span className="font-medium text-green-600">8 αιτήματα</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Υπό διαπραγμάτευση</span>
                      <span className="font-medium text-orange-600">5 αποθήκες</span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Πιο δημοφιλείς</span>
                          <span>Υπόγειες 15-25 τ.μ.</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Μέσος χρόνος πώλησης</span>
                          <span className="font-medium">6.8 μήνες</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="p-4 bg-muted/50 border border-dashed rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4" />
                <span className="font-medium">Διαθέσιμες Αποθήκες</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Εδώ βλέπετε όλες τις αποθήκες που είναι ενεργά προς πώληση.
                Περιλαμβάνονται τιμές ανά κατηγορία, ενδιαφέρον αγοραστών και market trends.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}