'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Eye, MousePointer, TrendingUp, Construction, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function EmailAnalyticsDashboard() {
  const router = useRouter();

  const handleBackToCRM = () => {
    router.push('/crm');
  };

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
            <ArrowLeft className="h-4 w-4" />
            Πίσω στο CRM
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📧 Email Analytics</h2>
            <p className="text-gray-600">Αναλυτικά στοιχεία email marketing</p>
          </div>
        </div>
      </div>

      {/* Placeholder Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Σύνολο Emails
            </CardTitle>
            <Mail className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500 mt-1">Απεσταλμένα</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Ποσοστό Παράδοσης
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-gray-500 mt-1">0/0 παραδόθηκαν</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Ποσοστό Ανοίγματος
            </CardTitle>
            <Eye className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-gray-500 mt-1">0 ανοίγματα</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Ποσοστό Κλικ
            </CardTitle>
            <MousePointer className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-gray-500 mt-1">0 κλικ</p>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon with Templates Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5 text-orange-500" />
            Email Analytics - Σύντομα Διαθέσιμο
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Mail className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Analytics Dashboard Υπό Κατασκευή
            </h3>
            <p className="text-gray-600 mb-4">
              Σύντομα θα μπορείτε να δείτε:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <div className="text-left space-y-2 text-sm text-gray-600">
                <li>• Αναλυτικά στοιχεία email campaigns</li>
                <li>• Ποσοστά ανοίγματος και κλικ</li>
                <li>• Πρόσφατη δραστηριότητα emails</li>
                <li>• Στατιστικά ανά ακίνητο</li>
                <li>• Email performance tracking</li>
              </div>
              <div className="text-left space-y-2 text-sm text-gray-600">
                <li>• 🏠 Residential template analytics</li>
                <li>• 🏢 Commercial template analytics</li>
                <li>• ⭐ Premium template analytics</li>
                <li>• Template performance comparison</li>
                <li>• A/B testing results</li>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-6">
              Τα analytics θα ενεργοποιηθούν μόλις ρυθμιστεί το SendGrid webhook.<br/>
              Τώρα διαθέσιμα 3 email templates στο Share Modal!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
