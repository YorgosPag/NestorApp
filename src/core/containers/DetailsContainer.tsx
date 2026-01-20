// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  icon?: React.ElementType;
  title?: string;
  description?: string;
}

function DefaultEmptyState({
  icon: Icon = Users,
  title,
  description
}: EmptyStateProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('common');

  // 🏢 ENTERPRISE: i18n-enabled default values
  const displayTitle = title || t('emptyState.selectItem.title');
  const displayDescription = description || t('emptyState.selectItem.description');
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-card border rounded-lg min-w-0 shadow-sm text-center p-8">
      <Icon className={`${iconSizes.xl4} text-muted-foreground mb-4`} />
      <h2 className="text-xl font-semibold text-foreground">{displayTitle}</h2>
      <p className="text-muted-foreground">{displayDescription}</p>
    </div>
  );
}

/** Generic selected item interface */
interface SelectedItemBase {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

interface DetailsContainerProps {
  children?: React.ReactNode;
  header?: React.ReactNode;
  tabsRenderer?: React.ReactNode;
  selectedItem?: SelectedItemBase | null;
  emptyStateProps?: EmptyStateProps;
}

/**
 * 🏢 ENTERPRISE DetailsContainer - Κεντρικοποιημένο container για λεπτομέρειες
 *
 * Βασισμένο στη συμπεριφορά του UnitsSidebar details container.
 *
 * Architecture:
 * - Header fixed στην κορυφή (shrink-0)
 * - Content area με flex-1 overflow-y-auto για internal scrolling
 * - Tabs μέσα στο scrollable content area
 * - min-h-0 σε πολλαπλά επίπεδα για proper flex behavior
 * - overflow-hidden στο outer για να μην scroll το parent
 * - Unified empty state για όλους τους τύπους
 *
 * 🔒 SCROLL BEHAVIOR:
 * - Το outer div έχει overflow-hidden (δεν scroll)
 * - Μόνο το content area κάνει scroll (overflow-y-auto)
 * - Ταυτόσιμη συμπεριφορά με ListContainer
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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm">
      {/* Fixed Header - Never scrolls */}
      <div className="shrink-0">
        {header}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Tabs Section (if provided) - flex-1 allows tabs to expand to full height */}
        {tabsRenderer && (
          <div className="px-4 flex-1 flex flex-col min-h-0">
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