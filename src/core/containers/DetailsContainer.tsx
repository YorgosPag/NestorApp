// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { Users, Plus } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface EmptyStateProps {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

function DefaultEmptyState({
  icon: Icon = Users,
  title,
  description,
  action
}: EmptyStateProps) {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: i18n-enabled default values
  const displayTitle = title || t('emptyState.selectItem.title');
  const displayDescription = description || t('emptyState.selectItem.description');
  return (
    <div className={`flex-1 flex flex-col items-center justify-center bg-card border rounded-lg min-w-0 shadow-sm text-center ${spacing.padding.lg}`}>
      <Icon className={`${iconSizes.xl4} ${colors.text.muted} ${spacing.margin.bottom.md}`} />
      <h2 className="text-xl font-semibold text-foreground">{displayTitle}</h2>
      <p className={colors.text.muted}>{displayDescription}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Generic selected item interface */
interface SelectedItemBase {
  id?: string;
  name?: string;
}

interface DetailsContainerProps {
  children?: React.ReactNode;
  header?: React.ReactNode;
  tabsRenderer?: React.ReactNode;
  selectedItem?: SelectedItemBase | null;
  emptyStateProps?: EmptyStateProps;
  /** 🏢 ENTERPRISE: Auto-generate action button in empty state when provided */
  onCreateAction?: () => void;
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
  emptyStateProps = {},
  onCreateAction
}: DetailsContainerProps) {
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();

  if (!selectedItem) {
    // 🏢 ENTERPRISE: Auto-generate action button if onCreateAction provided and no explicit action
    const autoAction = !emptyStateProps.action && onCreateAction ? (
      <Button variant="outline" onClick={onCreateAction}>
        <Plus className="mr-2 h-4 w-4" />
        {emptyStateProps.title}
      </Button>
    ) : emptyStateProps.action;

    return <DefaultEmptyState {...emptyStateProps} action={autoAction} />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm">
      {/* Fixed Header - Never scrolls */}
      <div className="shrink-0">
        {header}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Tabs Section (if provided) - flex-1 allows tabs to expand to full height */}
        {tabsRenderer && (
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {tabsRenderer}
          </div>
        )}

        {/* Custom Content (if no tabs) */}
        {!tabsRenderer && children && (
          <div className={`flex-1 ${spacing.padding.sm}`}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
