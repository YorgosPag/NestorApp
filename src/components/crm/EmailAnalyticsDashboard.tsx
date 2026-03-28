'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Eye, MousePointer, TrendingUp, Construction, ArrowLeft, Building2, Star } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized navigation entities for unit icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useRouter } from 'next/navigation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

export function EmailAnalyticsDashboard() {
  const router = useRouter();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: Use centralized unit icon for residential
  const ResidentialIcon = NAVIGATION_ENTITIES.unit.icon;

  const handleBackToCRM = () => {
    router.push('/crm');
  };

  const dashboardStats: DashboardStat[] = [
    {
      title: 'Σύνολο Emails',
      value: 0,
      description: 'Απεσταλμένα',
      icon: Mail,
      color: 'blue',
    },
    {
      title: 'Ποσοστό Παράδοσης',
      value: '0%',
      description: '0/0 παραδόθηκαν',
      icon: TrendingUp,
      color: 'green',
    },
    {
      title: 'Ποσοστό Ανοίγματος',
      value: '0%',
      description: '0 ανοίγματα',
      icon: Eye,
      color: 'cyan',
    },
    {
      title: 'Ποσοστό Κλικ',
      value: '0%',
      description: '0 κλικ',
      icon: MousePointer,
      color: 'purple',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleBackToCRM}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className={iconSizes.sm} />
            Πίσω στο CRM
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Email Analytics</h2>
            <p className={colors.text.muted}>Αναλυτικά στοιχεία email marketing</p>
          </div>
        </div>
      </div>

      {/* Stats Cards — 🏢 ENTERPRISE: Centralized UnifiedDashboard */}
      <UnifiedDashboard
        stats={dashboardStats}
        columns={4}
        className=""
      />

      {/* Coming Soon with Templates Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className={`${iconSizes.md} text-orange-500`} />
            Email Analytics - Σύντομα Διαθέσιμο
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("text-center py-8", colors.text.muted)}>
            <Mail className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Analytics Dashboard Υπό Κατασκευή
            </h3>
            <p className={cn("mb-4", colors.text.muted)}>
              Σύντομα θα μπορείτε να δείτε:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <ul className={cn("text-left space-y-2 text-sm", colors.text.muted)}>
                <li>Αναλυτικά στοιχεία email campaigns</li>
                <li>Ποσοστά ανοίγματος και κλικ</li>
                <li>Πρόσφατη δραστηριότητα emails</li>
                <li>Στατιστικά ανά ακίνητο</li>
                <li>Email performance tracking</li>
              </ul>
              <ul className={cn("text-left space-y-2 text-sm", colors.text.muted)}>
                <li className="flex items-center gap-2"><ResidentialIcon className={iconSizes.sm} /> Residential template analytics</li>
                <li className="flex items-center gap-2"><Building2 className={iconSizes.sm} /> Commercial template analytics</li>
                <li className="flex items-center gap-2"><Star className={iconSizes.sm} /> Premium template analytics</li>
                <li>Template performance comparison</li>
                <li>A/B testing results</li>
              </ul>
            </div>
            <p className={cn("text-xs mt-6", colors.text.muted)}>
              Τα analytics θα ενεργοποιηθούν μόλις ρυθμιστεί το Mailgun webhook.<br/>
              Τώρα διαθέσιμα 3 email templates στο Share Modal!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
