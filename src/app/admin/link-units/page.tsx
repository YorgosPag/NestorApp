'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LinkSoldUnitsToCustomers from '@/components/admin/LinkSoldUnitsToCustomers';
import SoldUnitsPreview from '@/components/admin/SoldUnitsPreview';
// Enterprise Configuration Management - CLAUDE.md Protocol compliance
import { useEnterpriseConfig } from '@/core/configuration/useEnterpriseConfig';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

export default function LinkUnitsPage() {
  // Enterprise Configuration Hook - replaces hardcoded values
  const { companyConfig, isLoading } = useEnterpriseConfig();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  // Get current project name from centralized configuration
  // 🏢 ENTERPRISE: Use company name as fallback (currentProject not in CompanyConfiguration)
  const currentProjectName = companyConfig?.name || 'έργου';

  return (
    <div className={`min-h-screen ${colors.bg.primary} p-6`}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className={`${iconSizes.sm} mr-2`} />
              Πίσω στη Διαχείριση
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Σύνδεση Sold Units με Customers</h1>
            <p className={colors.text.muted}>
              {isLoading ? (
                'Φόρτωση στοιχείων έργου...'
              ) : (
                `Διόρθωση του προβλήματος με τους πελάτες του ${currentProjectName}`
              )}
            </p>
          </div>
        </div>

        {/* Units Preview */}
        <div>
          <h2 className="text-xl font-semibold mb-4">📊 Τρέχουσα Κατάσταση Units</h2>
          <SoldUnitsPreview />
        </div>

        {/* Main Tool */}
        <div>
          <h2 className="text-xl font-semibold mb-4">🔧 Εργαλείο Σύνδεσης</h2>
          <LinkSoldUnitsToCustomers />
        </div>

        {/* Additional Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className={`p-6 bg-card ${quick.card}`}>
            <h3 className="font-semibold mb-3">🎯 Στόχος</h3>
            <p className={cn("text-sm", colors.text.muted)}>
              Να συνδέσουμε τα units που έχουν status "sold" με τους αντίστοιχους πελάτες
              ώστε να εμφανίζονται στο tab "Πελάτες Έργου".
            </p>
          </div>

          <div className={`p-6 bg-card ${quick.card}`}>
            <h3 className="font-semibold mb-3">⚙️ Τι θα γίνει</h3>
            <ul className={cn("text-sm space-y-1", colors.text.muted)}>
              <li>• Εύρεση sold units χωρίς soldTo field</li>
              <li>• Αυτόματη σύνδεση με υπάρχοντα contacts</li>
              <li>• Ενημέρωση της βάσης δεδομένων</li>
              <li>• Άμεση εμφάνιση πελατών στο UI</li>
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
}