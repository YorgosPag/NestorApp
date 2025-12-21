'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Car,
  DollarSign,
  Building2,
  Square,
  TrendingUp,
  Eye,
  MapPin,
  Calendar,
} from 'lucide-react';

// Placeholder stats for Available Parking
const parkingStats: DashboardStat[] = [
  {
    title: 'Διαθέσιμα Parking',
    value: '93',
    description: 'Προς πώληση τώρα',
    icon: Car,
    color: 'blue',
    trend: { value: -2, label: 'Μείωση' }
  },
  {
    title: 'Μέση Τιμή',
    value: '€22K',
    description: 'Μέσος όρος τιμής',
    icon: DollarSign,
    color: 'green',
    trend: { value: 6, label: 'Αύξηση' }
  },
  {
    title: 'Ενδιαφέρον',
    value: '31',
    description: 'Ενεργές προβολές',
    icon: Eye,
    color: 'purple',
    trend: { value: 18, label: 'Αύξηση' }
  },
  {
    title: 'Μέσος Χρόνος',
    value: '3.4 μήνες',
    description: 'Στην αγορά',
    icon: Calendar,
    color: 'orange',
    trend: { value: -12, label: 'Μείωση' }
  }
];

export default function AvailableParkingPage() {
  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Car className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Διαθέσιμα Parking</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                Θέσεις στάθμευσης προς πώληση - Ενεργές καταχωρήσεις
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title="Διαθέσιμα Parking - Επισκόπηση"
              stats={parkingStats}
              variant="modern"
            />

            {/* Parking Types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Υπόγεια Parking */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Υπόγεια Parking
                </h2>

                <div className="space-y-3">
                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Building2 className="h-4 w-4 text-blue-500" />
                      </div>
                      <h3 className="font-medium">Κλειστά Υπόγεια</h3>
                      <span className="ml-auto bg-blue-500/20 text-blue-500 px-2 py-1 rounded text-sm font-medium">
                        56 διαθέσιμα
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span className="text-green-600 font-medium">€28K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Εύρος</span>
                        <span>€18K - €42K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ζήτηση</span>
                        <span className="text-orange-600 font-medium">Υψηλή</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Square className="h-4 w-4 text-purple-500" />
                      </div>
                      <h3 className="font-medium">Ημι-υπαίθρια</h3>
                      <span className="ml-auto bg-purple-500/20 text-purple-500 px-2 py-1 rounded text-sm font-medium">
                        19 διαθέσιμα
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span className="text-green-600 font-medium">€19K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Εύρος</span>
                        <span>€12K - €28K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ζήτηση</span>
                        <span className="text-blue-600 font-medium">Μέτρια</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Εξωτερικά Parking */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Square className="h-5 w-5" />
                  Εξωτερικά Parking
                </h2>

                <div className="space-y-3">
                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Building2 className="h-4 w-4 text-green-500" />
                      </div>
                      <h3 className="font-medium">Σκεπαστά</h3>
                      <span className="ml-auto bg-green-500/20 text-green-500 px-2 py-1 rounded text-sm font-medium">
                        12 διαθέσιμα
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span className="text-green-600 font-medium">€16K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Εύρος</span>
                        <span>€10K - €25K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ζήτηση</span>
                        <span className="text-green-600 font-medium">Καλή</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <Square className="h-4 w-4 text-orange-500" />
                      </div>
                      <h3 className="font-medium">Υπαίθρια</h3>
                      <span className="ml-auto bg-orange-500/20 text-orange-500 px-2 py-1 rounded text-sm font-medium">
                        6 διαθέσιμα
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέση τιμή</span>
                        <span className="text-green-600 font-medium">€8K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Εύρος</span>
                        <span>€4K - €12K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ζήτηση</span>
                        <span className="text-red-600 font-medium">Χαμηλή</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Τιμές ανά Τύπο */}
              <div className="p-6 bg-card border rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold">Τιμές ανά Τύπο</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Premium (κλειστά)</span>
                    <span className="font-medium text-green-600">€25K - €42K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Standard (σκεπαστά)</span>
                    <span className="font-medium text-blue-600">€12K - €25K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Economy (υπαίθρια)</span>
                    <span className="font-medium text-orange-600">€4K - €12K</span>
                  </div>
                </div>
              </div>

              {/* Δραστηριότητα */}
              <div className="p-6 bg-card border rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Eye className="h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="font-semibold">Δραστηριότητα</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ενεργές προβολές</span>
                    <span className="font-medium text-blue-600">31</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Αιτήματα επίσκεψης</span>
                    <span className="font-medium text-green-600">12</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Υπό διαπραγμάτευση</span>
                    <span className="font-medium text-orange-600">7</span>
                  </div>
                </div>
              </div>

              {/* Trends */}
              <div className="p-6 bg-card border rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                  </div>
                  <h3 className="font-semibold">Market Trends</h3>
                </div>
                <div className="space-y-3">
                  <div className="text-sm">
                    <div className="text-muted-foreground">Πιο δημοφιλείς</div>
                    <div className="font-medium">Κλειστά υπόγεια</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Ταχύτερη πώληση</div>
                    <div className="font-medium">3.4 μήνες</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Απόδοση επένδυσης</div>
                    <div className="font-medium text-green-600">+6% ετησίως</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="p-4 bg-muted/50 border border-dashed rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4" />
                <span className="font-medium">Διαθέσιμα Parking</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Εδώ βλέπετε όλες τις θέσεις στάθμευσης που είναι ενεργά προς πώληση.
                Περιλαμβάνονται τιμές ανά κατηγορία, ενδιαφέρον αγοραστών και market analysis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}