'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LinkSoldUnitsToCustomers from '@/components/admin/LinkSoldUnitsToCustomers';
import SoldUnitsPreview from '@/components/admin/SoldUnitsPreview';
import { COMPANY_CONFIG } from '@/config/company-config';

export default function LinkUnitsPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Πίσω στη Διαχείριση
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Σύνδεση Sold Units με Customers</h1>
            <p className="text-muted-foreground">
              Διόρθωση του προβλήματος με τους πελάτες του έργου {COMPANY_CONFIG.SAMPLE_PROJECT_NAME}
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

          <div className="p-6 bg-card border rounded-lg">
            <h3 className="font-semibold mb-3">🎯 Στόχος</h3>
            <p className="text-sm text-muted-foreground">
              Να συνδέσουμε τα units που έχουν status "sold" με τους αντίστοιχους πελάτες
              ώστε να εμφανίζονται στο tab "Πελάτες Έργου".
            </p>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <h3 className="font-semibold mb-3">⚙️ Τι θα γίνει</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
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