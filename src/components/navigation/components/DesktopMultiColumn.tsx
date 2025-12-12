'use client';

import React from 'react';

// Temporary simplified version to fix syntax errors
export function DesktopMultiColumn() {
  return (
    <nav className="hidden md:block" role="navigation" aria-label="Πλοήγηση Ιεραρχίας">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-center text-gray-500">
            Navigation Component - Temporarily Simplified
          </div>
        </div>
      </section>
    </nav>
  );
}