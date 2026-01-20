'use client';

/**
 * Navigation Page - Full page hierarchical navigation
 * Εταιρείες → Έργα → Κτίρια → Όροφοι → Μονάδες
 *
 * 🏢 ENTERPRISE: i18n support
 */
import React from 'react';
import { AdaptiveMultiColumnNavigation, NavigationBreadcrumb } from '@/components/navigation';
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function NavigationPage() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('navigation');

  return (
    <main className={`min-h-screen ${colors.bg.primary}`}>
      {/* Header */}
      <header className={`${quick.separatorH} ${colors.bg.primary}`}>
        <div className="max-w-full mx-auto px-2 sm:px-3 lg:px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <MapPin className={`${iconSizes.lg} ${colors.text.primary}`} />
              <h1 className={`text-2xl font-bold ${colors.text.primary} dark:text-foreground`}>
                {t('page.title')}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className={`${colors.bg.primary} ${quick.separatorH}`} aria-label={t('page.menuLabel')}>
        <div className="max-w-full mx-auto px-2 sm:px-3 lg:px-4 py-3">
          <NavigationBreadcrumb />
        </div>
      </nav>

      {/* Main Content */}
      <section className="max-w-full mx-auto px-2 sm:px-3 lg:px-4 py-6" role="main" aria-label={t('page.mainAreaLabel')}>
        <AdaptiveMultiColumnNavigation />
      </section>
    </main>
  );
}