'use client';

import React from 'react';
import { Users } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ElementType;
  title?: string;
  description?: string;
}

function DefaultEmptyState({
  icon: Icon = Users,
  title = "Κάντε μια επιλογή",
  description = "Επιλέξτε ένα στοιχείο από τη λίστα για να δείτε τις λεπτομέρειές του."
}: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-card border rounded-lg min-w-0 shadow-sm text-center p-8">
      <Icon className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

interface DetailsContainerProps {
  children?: React.ReactNode;
  header?: React.ReactNode;
  tabsRenderer?: React.ReactNode;
  selectedItem?: any;
  emptyStateProps?: EmptyStateProps;
}

/**
 * 🏢 ENTERPRISE DetailsContainer - Κεντρικοποιημένο container για λεπτομέρειες
 *
 * Βασισμένο στη συμπεριφορά του UnitsSidebar details container.
 *
 * Architecture:
 * - Header fixed στην κορυφή
 * - Tabs με shrink-0 και border-b px-4
 * - Content expandable με GenericTabsRenderer
 * - min-h-0 σε πολλαπλά επίπεδα για proper flex behavior
 * - Unified empty state για όλους τους τύπους
 */
export function DetailsContainer({
  children,
  header,
  tabsRenderer,
  selectedItem,
  emptyStateProps = {}
}: DetailsContainerProps) {
  if (!selectedItem) {
    return <DefaultEmptyState {...emptyStateProps} />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card border rounded-lg shadow-sm">
      {/* Fixed Header */}
      {header}

      {/* Expandable Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tabs Section (if provided) */}
        {tabsRenderer && (
          <div className="shrink-0 border-b px-4">
            {tabsRenderer}
          </div>
        )}

        {/* Custom Content (if no tabs) */}
        {!tabsRenderer && children && (
          <div className="flex-1 p-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}