'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  DollarSign,
  Home,
  Package,
  Car,
  CheckCircle,
  ShoppingCart,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

// Placeholder stats for Sales
const salesStats: DashboardStat[] = [
  {
    title: 'Συνολικά Πωλήσιμα',
    value: '892',
    description: 'Όλα τα διαθέσιμα ακίνητα',
    icon: ShoppingCart,
    color: 'blue',
    trend: { value: 12, label: 'Αύξηση' }
  },
  {
    title: 'Διαθέσιμα',
    value: '324',
    description: 'Προς πώληση',
    icon: DollarSign,
    color: 'green',
    trend: { value: -5, label: 'Μείωση' }
  },
  {
    title: 'Πωλημένα',
    value: '568',
    description: 'Ολοκληρωμένες πωλήσεις',
    icon: CheckCircle,
    color: 'purple',
    trend: { value: 18, label: 'Αύξηση' }
  },
  {
    title: 'Συνολική Αξία',
    value: '€24.8M',
    description: 'Αξία portfolio',
    icon: TrendingUp,
    color: 'orange',
    trend: { value: 8, label: 'Αύξηση' }
  }
];

export default function SalesPage() {
  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Πωλήσεις</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                Πωλήσιμα ακίνητα - Τι πωλείται και σε ποιον
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title="Επισκόπηση Πωλήσεων"
              stats={salesStats}
              variant="modern"
            />

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Διαθέσιμα Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Διαθέσιμα προς Πώληση
                </h2>

                <div className="space-y-3">
                  {/* Available Apartments */}
                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Home className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-medium">Διαθέσιμα Διαμερίσματα</h3>
                      <span className="ml-auto bg-primary/20 text-primary px-2 py-1 rounded text-sm font-medium">
                        142
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Διαμερίσματα, μεζονέτες και γκαρσονιέρες προς πώληση
                    </p>
                  </div>

                  {/* Available Storage */}
                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <Package className="h-4 w-4 text-orange-500" />
                      </div>
                      <h3 className="font-medium">Διαθέσιμες Αποθήκες</h3>
                      <span className="ml-auto bg-orange-500/20 text-orange-500 px-2 py-1 rounded text-sm font-medium">
                        89
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Αποθήκες και χώροι αποθήκευσης προς πώληση
                    </p>
                  </div>

                  {/* Available Parking */}
                  <div className="p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Car className="h-4 w-4 text-blue-500" />
                      </div>
                      <h3 className="font-medium">Διαθέσιμα Parking</h3>
                      <span className="ml-auto bg-blue-500/20 text-blue-500 px-2 py-1 rounded text-sm font-medium">
                        93
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Θέσεις στάθμευσης υπόγειες και εξωτερικές
                    </p>
                  </div>
                </div>
              </div>

              {/* Πωλημένα Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Πωλημένα Ακίνητα
                </h2>

                <div className="p-6 bg-card border rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <h3 className="font-semibold">Ολοκληρωμένες Πωλήσεις</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Διαμερίσματα</span>
                      <span className="font-medium">344 πωληθέντα</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Αποθήκες</span>
                      <span className="font-medium">235 πωληθείσες</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Parking</span>
                      <span className="font-medium">344 πωληθέντα</span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center font-semibold">
                        <span>Συνολικά</span>
                        <span>568 ακίνητα</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Συνολική αξία</span>
                        <span>€18.4M</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="p-4 bg-muted/50 border border-dashed rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4" />
                <span className="font-medium">Πωλήσιμα Ακίνητα</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Εδώ βλέπετε όλα τα ακίνητα που έχουν ενεργοποιηθεί για πώληση.
                Περιλαμβάνονται τιμές, αγοραστές, συμβόλαια και ιστορικό πωλήσεων.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}