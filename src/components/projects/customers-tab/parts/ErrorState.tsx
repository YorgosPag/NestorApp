'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Database, Wifi, Server, AlertCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ErrorStateProps {
  error: string;
  errorType?: 'NETWORK_ERROR' | 'DATABASE_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN_ERROR' | 'API_ERROR';
  canRetry?: boolean;
  onRetry?: () => void;
}

export function ErrorState({ error, errorType, canRetry = true, onRetry }: ErrorStateProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();

  // 🔒 ENTERPRISE: Icon mapping based on error type
  const getErrorIcon = () => {
    switch (errorType) {
      case 'NETWORK_ERROR':
        return <Wifi className={`${iconSizes.xl3} mx-auto mb-2 text-orange-500`} />;
      case 'DATABASE_ERROR':
        return <Database className={`${iconSizes.xl3} mx-auto mb-2 text-red-500`} />;
      case 'API_ERROR':
        return <Server className={`${iconSizes.xl3} mx-auto mb-2 text-red-500`} />;
      case 'VALIDATION_ERROR':
        return <AlertCircle className={`${iconSizes.xl3} mx-auto mb-2 text-yellow-500`} />;
      default:
        return <AlertTriangle className={`${iconSizes.xl3} mx-auto mb-2 text-red-500`} />;
    }
  };

  // 🔒 ENTERPRISE: Context-aware error messages using i18n
  const getErrorContext = () => {
    switch (errorType) {
      case 'NETWORK_ERROR':
        return {
          title: t('errors.network.title'),
          subtitle: t('errors.network.subtitle')
        };
      case 'DATABASE_ERROR':
        return {
          title: t('errors.database.title'),
          subtitle: t('errors.database.subtitle')
        };
      case 'API_ERROR':
        return {
          title: t('errors.api.title'),
          subtitle: t('errors.api.subtitle')
        };
      case 'VALIDATION_ERROR':
        return {
          title: t('errors.validation.title'),
          subtitle: t('errors.validation.subtitle')
        };
      default:
        return {
          title: t('errors.unknown.title'),
          subtitle: t('errors.unknown.subtitle')
        };
    }
  };

  const errorContext = getErrorContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('customers.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          {getErrorIcon()}

          <div className="space-y-2 mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              {errorContext.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {errorContext.subtitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {error}
            </p>
          </div>

          {canRetry && onRetry && (
            <div className="flex flex-col items-center space-y-3">
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="inline-flex items-center"
              >
                <RefreshCw className={`${iconSizes.sm} mr-2`} />
                {t('errors.retryButton')}
              </Button>

              <p className="text-xs text-muted-foreground">
                {t('errors.supportMessage')}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}