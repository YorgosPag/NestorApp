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
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <TooltipProvider>
      <div className={`flex h-screen ${colors.bg.primary}`}>
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Home className={`${iconSizes.md} ${colors.text.muted}`} />
                <h1 className="text-lg font-semibold">Διαθέσιμα Διαμερίσματα</h1>
              </div>
              <div className={`ml-auto text-sm ${colors.text.muted}`}>
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
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                    <Home className={`${iconSizes.md} ${colors.text.info}`} />
                  </div>
                  <h3 className="font-semibold">Γκαρσονιέρες</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  Διαμερίσματα ενός δωματίου
                </p>
                <div className="text-2xl font-bold">34</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>Μέση τιμή</span>
                    <span className={`${colors.text.success} font-medium`}>€185K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>Εύρος τ.μ.</span>
                    <span>25-45 τ.μ.</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>Ενεργές προβολές</span>
                    <span className={`${colors.text.warning} font-medium`}>12</span>
                  </div>
                </div>
              </div>

              {/* Δυάρια */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                    <Home className={`${iconSizes.md} ${colors.text.success}`} />
                  </div>
                  <h3 className="font-semibold">Δυάρια</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  Διαμερίσματα δύο δωματίων
                </p>
                <div className="text-2xl font-bold">67</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>Μέση τιμή</span>
                    <span className={`${colors.text.success} font-medium`}>€295K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>Εύρος τ.μ.</span>
                    <span>55-85 τ.μ.</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>Ενεργές προβολές</span>
                    <span className={`${colors.text.warning} font-medium`}>31</span>
                  </div>
                </div>
              </div>

              {/* Τριάρια+ */}
              <div className={`p-6 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <Home className={`${iconSizes.md} ${colors.text.warning}`} />
                  </div>
                  <h3 className="font-semibold">Τριάρια+</h3>
                </div>
                <p className={`text-sm ${colors.text.muted} mb-2`}>
                  Διαμερίσματα τριών+ δωματίων
                </p>
                <div className="text-2xl font-bold">41</div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>Μέση τιμή</span>
                    <span className={`${colors.text.success} font-medium`}>€485K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>Εύρος τ.μ.</span>
                    <span>90-150 τ.μ.</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={colors.text.muted}>Ενεργές προβολές</span>
                    <span className={`${colors.text.warning} font-medium`}>24</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Ranges & Interest */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Κλιμάκια Τιμών */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className={iconSizes.md} />
                  Κλιμάκια Τιμών
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">€100K - €250K</span>
                      <span className={`${colors.bg.success}/20 ${colors.text.success} px-2 py-1 rounded text-sm font-medium`}>
                        42 διαθέσιμα
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Γκαρσονιέρες και μικρά δυάρια
                    </p>
                  </div>

                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">€250K - €400K</span>
                      <span className={`${colors.bg.info}/20 ${colors.text.info} px-2 py-1 rounded text-sm font-medium`}>
                        67 διαθέσιμα
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Δυάρια και μικρά τριάρια
                    </p>
                  </div>

                  <div className={`p-4 bg-card ${quick.card}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">€400K+</span>
                      <span className={`${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
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
                  <Eye className={iconSizes.md} />
                  Ενδιαφέρον & Δραστηριότητα
                </h2>

                <div className={`p-6 bg-card ${quick.card}`}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Users className={iconSizes.sm} />
                        Ενεργές επισκέψεις
                      </span>
                      <span className={`font-medium ${colors.text.success}`}>127 αιτήματα</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className={iconSizes.sm} />
                        Προγραμματισμένες επισκέψεις
                      </span>
                      <span className={`font-medium ${colors.text.info}`}>34 ραντεβού</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <DollarSign className={iconSizes.sm} />
                        Προσφορές υπό εξέταση
                      </span>
                      <span className={`font-medium ${colors.text.warning}`}>18 προσφορές</span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <TrendingUp className={iconSizes.sm} />
                          Hot Properties ({'>'}5 προβολές/εβδομάδα)
                        </span>
                        <span className={`font-semibold ${colors.text.error}`}>23 ακίνητα</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <Home className={iconSizes.sm} />
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