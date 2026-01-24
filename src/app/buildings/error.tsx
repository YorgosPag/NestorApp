// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { Building, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from 'react-i18next';

interface BuildingsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BuildingsError({ error, reset }: BuildingsErrorProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('building');

  React.useEffect(() => {
    console.error('Buildings page error:', error);
  }, [error]);

  return (
    <main className={`min-h-screen ${colors.bg.primary} p-6`}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className={`${iconSizes.xl4} bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Building className={`${iconSizes.xl} text-destructive`} />
          </div>
          <h1 className="text-2xl font-semibold mb-2">{t('error.title')}</h1>
          <p className="text-muted-foreground mb-6">
            {t('error.message')}
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-muted p-4 rounded-lg mb-6">
            <details>
              <summary className="cursor-pointer font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className={`${iconSizes.sm} text-amber-500`} />
                {t('error.technicalDetails')}
              </summary>
              <div className={`mt-2 p-3 ${colors.bg.primary} rounded border`}>
                <p className="text-sm font-mono text-muted-foreground break-words">
                  <strong>Error:</strong> {error.message}
                </p>
                {error.digest && (
                  <p className="text-sm font-mono text-muted-foreground mt-1">
                    <strong>Digest:</strong> {error.digest}
                  </p>
                )}
              </div>
            </details>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={reset}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className={iconSizes.sm} />
            {t('error.tryAgain')}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => window.history.back()}
              className={`border border-input ${colors.bg.primary} hover:bg-accent hover:text-accent-foreground px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors`}
            >
              <ArrowLeft className={iconSizes.sm} />
              {t('error.back')}
            </button>

            <button
              onClick={() => window.location.href = '/'}
              className={`border border-input ${colors.bg.primary} hover:bg-accent hover:text-accent-foreground px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors`}
            >
              {t('error.home')}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            {t('error.supportMessage')}
          </p>
        </div>
      </div>
    </main>
  );
}