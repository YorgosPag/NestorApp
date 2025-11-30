'use client';

/**
 * Navigation Page - Full page hierarchical navigation
 * Εταιρείες → Έργα → Κτίρια → Όροφοι → Μονάδες
 */
import React from 'react';
import { AdaptiveMultiColumnNavigation, NavigationBreadcrumb } from '@/components/navigation';
import { MapPin } from 'lucide-react';

export default function NavigationPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-card">
        <div className="max-w-full mx-auto px-2 sm:px-3 lg:px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <MapPin className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
                Πλοήγηση Ακινήτων
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-full mx-auto px-2 sm:px-3 lg:px-4 py-3">
          <NavigationBreadcrumb />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-2 sm:px-3 lg:px-4 py-6">
        <AdaptiveMultiColumnNavigation />
      </div>
    </div>
  );
}