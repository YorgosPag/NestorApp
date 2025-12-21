'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Home,
  DollarSign,
  MapPin,
  Calendar,
  TrendingUp,
  BarChart3,
  Eye,
  Users,
} from 'lucide-react';

// Placeholder stats for Available Apartments
const availableStats: DashboardStat[] = [
  {
    title: 'Διαθέσιμα Διαμερίσματα',
    value: '142',
    description: 'Προς πώληση τώρα',
    icon: Home,
    color: 'blue',
    trend: { value: -8, label: 'Μείωση' }
  },
  {
    title: 'Μέση Τιμή',
    value: '€385K',
    description: 'Μέσος όρος τιμής',
    icon: DollarSign,
    color: 'green',
    trend: { value: 12, label: 'Αύξηση' }
  },
  {
    title: 'Ενδιαφέρον',
    value: '67',
    description: 'Ενεργές προβολές',
    icon: Eye,
    color: 'purple',
    trend: { value: 23, label: 'Αύξηση' }
  },
  {
    title: 'Μέσος Χρόνος',
    value: '4.2 μήνες',
    description: 'Στην αγορά',
    icon: Calendar,
    color: 'orange',
    trend: { value: -15, label: 'Μείωση' }
  }
];

export default function AvailableApartmentsPage() {
  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Διαθέσιμα Διαμερίσματα</h1>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                Διαμερίσματα προς πώληση - Ενεργές καταχωρήσεις
              </div>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="p-6 space-y-6">
            <UnifiedDashboard
              title="Διαθέσιμα Διαμερίσματα - Επισκόπηση"
              stats={availableStats}
              variant="modern"
            />

            {/* Available Types */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Γκαρσονιέρες */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Home className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold">Γκαρσονιέρες</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Διαμερίσματα ενός δωματίου
                </p>
                <div className="text-2xl font-bold">34</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Μέση τιμή</span>
                    <span className="text-green-600 font-medium">€185K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Εύρος τ.μ.</span>
                    <span>25-45 τ.μ.</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ενεργές προβολές</span>
                    <span className="text-orange-600 font-medium">12</span>
                  </div>
                </div>
              </div>

              {/* Δυάρια */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Home className="h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="font-semibold">Δυάρια</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Διαμερίσματα δύο δωματίων
                </p>
                <div className="text-2xl font-bold">67</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Μέση τιμή</span>
                    <span className="text-green-600 font-medium">€295K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Εύρος τ.μ.</span>
                    <span>55-85 τ.μ.</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ενεργές προβολές</span>
                    <span className="text-orange-600 font-medium">31</span>
                  </div>
                </div>
              </div>

              {/* Τριάρια+ */}
              <div className="p-6 bg-card border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Home className="h-5 w-5 text-purple-500" />
                  </div>
                  <h3 className="font-semibold">Τριάρια+</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Διαμερίσματα τριών+ δωματίων
                </p>
                <div className="text-2xl font-bold">41</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Μέση τιμή</span>
                    <span className="text-green-600 font-medium">€485K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Εύρος τ.μ.</span>
                    <span>90-150 τ.μ.</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ενεργές προβολές</span>
                    <span className="text-orange-600 font-medium">24</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Ranges & Interest */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Κλιμάκια Τιμών */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Κλιμάκια Τιμών
                </h2>

                <div className="space-y-3">
                  <div className="p-4 bg-card border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">€100K - €250K</span>
                      <span className="bg-green-500/20 text-green-500 px-2 py-1 rounded text-sm font-medium">
                        42 διαθέσιμα
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Γκαρσονιέρες και μικρά δυάρια
                    </p>
                  </div>

                  <div className="p-4 bg-card border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">€250K - €400K</span>
                      <span className="bg-blue-500/20 text-blue-500 px-2 py-1 rounded text-sm font-medium">
                        67 διαθέσιμα
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Δυάρια και μικρά τριάρια
                    </p>
                  </div>

                  <div className="p-4 bg-card border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">€400K+</span>
                      <span className="bg-purple-500/20 text-purple-500 px-2 py-1 rounded text-sm font-medium">
                        33 διαθέσιμα
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Μεγάλα τριάρια, τετράρια, μεζονέτες
                    </p>
                  </div>
                </div>
              </div>

              {/* Ενδιαφέρον & Δραστηριότητα */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Ενδιαφέρον & Δραστηριότητα
                </h2>

                <div className="p-6 bg-card border rounded-lg">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Ενεργές επισκέψεις
                      </span>
                      <span className="font-medium text-green-600">127 αιτήματα</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Προγραμματισμένες επισκέψεις
                      </span>
                      <span className="font-medium text-blue-600">34 ραντεβού</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Προσφορές υπό εξέταση
                      </span>
                      <span className="font-medium text-orange-600">18 προσφορές</span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Hot Properties ({'>'}5 προβολές/εβδομάδα)
                        </span>
                        <span className="font-semibold text-red-600">23 ακίνητα</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="p-4 bg-muted/50 border border-dashed rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Home className="h-4 w-4" />
                <span className="font-medium">Διαθέσιμα Διαμερίσματα</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Εδώ βλέπετε όλα τα διαμερίσματα που είναι ενεργά προς πώληση.
                Περιλαμβάνονται τιμές, ενδιαφέρον αγοραστών και στατιστικά πωλήσεων.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}