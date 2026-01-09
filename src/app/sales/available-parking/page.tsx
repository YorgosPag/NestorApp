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
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageContainer } from '@/core/containers';

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
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <TooltipProvider>
      <PageContainer fullScreen ariaLabel="Διαθέσιμα Parking">
        {/* Header */}
          <div className={`border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}>
            <div className="flex h-14 items-center px-4">
              <div className="flex items-center gap-2">
                <Car className={`${iconSizes.md} ${colors.text.muted}`} />
                <h1 className="text-lg font-semibold">Διαθέσιμα Parking</h1>
              </div>
              <div className={`ml-auto text-sm ${colors.text.muted}`}>
                Θέσεις στάθμευσης προς πώληση - Ενεργές καταχωρήσεις
              </div>
            </div>
          </div>

          {/* Dashboard Stats - Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                  <Building2 className={iconSizes.md} />
                  Υπόγεια Parking
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                        <Building2 className={`${iconSizes.sm} ${colors.text.info}`} />
                      </div>
                      <h3 className="font-medium">Κλειστά Υπόγεια</h3>
                      <span className={`ml-auto ${colors.bg.info}/20 ${colors.text.info} px-2 py-1 rounded text-sm font-medium`}>
                        56 διαθέσιμα
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Μέση τιμή</span>
                        <span className={`${colors.text.success} font-medium`}>€28K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Εύρος</span>
                        <span>€18K - €42K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Ζήτηση</span>
                        <span className={`${colors.text.warning} font-medium`}>Υψηλή</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                        <Square className={`${iconSizes.sm} ${colors.text.accent}`} />
                      </div>
                      <h3 className="font-medium">Ημι-υπαίθρια</h3>
                      <span className={`ml-auto ${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        19 διαθέσιμα
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Μέση τιμή</span>
                        <span className={`${colors.text.success} font-medium`}>€19K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Εύρος</span>
                        <span>€12K - €28K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Ζήτηση</span>
                        <span className={`${colors.text.info} font-medium`}>Μέτρια</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Εξωτερικά Parking */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Square className={iconSizes.md} />
                  Εξωτερικά Parking
                </h2>

                <div className="space-y-3">
                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                        <Building2 className={`${iconSizes.sm} ${colors.text.success}`} />
                      </div>
                      <h3 className="font-medium">Σκεπαστά</h3>
                      <span className={`ml-auto ${colors.bg.success}/20 ${colors.text.success} px-2 py-1 rounded text-sm font-medium`}>
                        12 διαθέσιμα
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Μέση τιμή</span>
                        <span className={`${colors.text.success} font-medium`}>€16K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Εύρος</span>
                        <span>€10K - €25K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Ζήτηση</span>
                        <span className={`${colors.text.success} font-medium`}>Καλή</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 bg-card ${quick.card} hover:bg-accent/50 transition-colors cursor-pointer`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                        <Square className={`${iconSizes.sm} ${colors.text.warning}`} />
                      </div>
                      <h3 className="font-medium">Υπαίθρια</h3>
                      <span className={`ml-auto ${colors.bg.warning}/20 ${colors.text.warning} px-2 py-1 rounded text-sm font-medium`}>
                        6 διαθέσιμα
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Μέση τιμή</span>
                        <span className={`${colors.text.success} font-medium`}>€8K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Εύρος</span>
                        <span>€4K - €12K</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={colors.text.muted}>Ζήτηση</span>
                        <span className={`${colors.text.error} font-medium`}>Χαμηλή</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Τιμές ανά Τύπο */}
              <div className={`p-6 bg-card ${quick.card}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 ${colors.bg.info}/10 rounded-lg`}>
                    <DollarSign className={`${iconSizes.md} ${colors.text.info}`} />
                  </div>
                  <h3 className="font-semibold">Τιμές ανά Τύπο</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Premium (κλειστά)</span>
                    <span className={`font-medium ${colors.text.success}`}>€25K - €42K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Standard (σκεπαστά)</span>
                    <span className={`font-medium ${colors.text.info}`}>€12K - €25K</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Economy (υπαίθρια)</span>
                    <span className={`font-medium ${colors.text.warning}`}>€4K - €12K</span>
                  </div>
                </div>
              </div>

              {/* Δραστηριότητα */}
              <div className={`p-6 bg-card ${quick.card}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 ${colors.bg.success}/10 rounded-lg`}>
                    <Eye className={`${iconSizes.md} ${colors.text.success}`} />
                  </div>
                  <h3 className="font-semibold">Δραστηριότητα</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ενεργές προβολές</span>
                    <span className={`font-medium ${colors.text.info}`}>31</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Αιτήματα επίσκεψης</span>
                    <span className={`font-medium ${colors.text.success}`}>12</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Υπό διαπραγμάτευση</span>
                    <span className={`font-medium ${colors.text.warning}`}>7</span>
                  </div>
                </div>
              </div>

              {/* Trends */}
              <div className={`p-6 bg-card ${quick.card}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 ${colors.bg.warning}/10 rounded-lg`}>
                    <TrendingUp className={`${iconSizes.md} ${colors.text.accent}`} />
                  </div>
                  <h3 className="font-semibold">Market Trends</h3>
                </div>
                <div className="space-y-3">
                  <div className="text-sm">
                    <div className={colors.text.muted}>Πιο δημοφιλείς</div>
                    <div className="font-medium">Κλειστά υπόγεια</div>
                  </div>
                  <div className="text-sm">
                    <div className={colors.text.muted}>Ταχύτερη πώληση</div>
                    <div className="font-medium">3.4 μήνες</div>
                  </div>
                  <div className="text-sm">
                    <div className={colors.text.muted}>Απόδοση επένδυσης</div>
                    <div className={`font-medium ${colors.text.success}`}>+6% ετησίως</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className={`p-4 bg-muted/50 ${quick.card}`}>
              <div className="flex items-center gap-2 text-sm">
                <Car className={iconSizes.sm} />
                <span className="font-medium">Διαθέσιμα Parking</span>
              </div>
              <p className={`text-sm ${colors.text.muted} mt-1`}>
                Εδώ βλέπετε όλες τις θέσεις στάθμευσης που είναι ενεργά προς πώληση.
                Περιλαμβάνονται τιμές ανά κατηγορία, ενδιαφέρον αγοραστών και market analysis.
              </p>
            </div>
          </div>
      </PageContainer>
    </TooltipProvider>
  );
}