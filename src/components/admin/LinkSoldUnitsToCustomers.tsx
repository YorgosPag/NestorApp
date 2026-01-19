import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Users, Link, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface LinkingResult {
  success: boolean;
  message: string;
  linkedUnits: number;
  updates?: Array<{
    unitId: string;
    contactId: string;
    contactName: string;
  }>;
}

export function LinkSoldUnitsToCustomers() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('admin');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LinkingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLinkUnits = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🔗 Starting sold units linking process...');

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const data = await apiClient.post<LinkingResult>('/api/units/admin-link', {});

      if (data?.success) {
        setResult(data);
        console.log('✅ Units linked successfully:', data);
      } else {
        throw new Error('Failed to link units');
      }

    } catch (err) {
      console.error('❌ Error linking units:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className={iconSizes.lg} />
          {t('link.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('link.description')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Action Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleLinkUnits}
            disabled={loading}
            size="lg"
            className="w-full max-w-md"
          >
            {loading ? (
              <>
                <RefreshCw className={`${iconSizes.sm} mr-2 animate-spin`} />
                {t('link.loading')}
              </>
            ) : (
              <>
                <Users className={`${iconSizes.sm} mr-2`} />
                {t('link.button')}
              </>
            )}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className={iconSizes.sm} />
            <AlertDescription>
              <strong>{t('link.error')}</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Success Result */}
        {result?.success && (
          <Alert>
            <CheckCircle className={`${iconSizes.sm} text-green-600`} />
            <AlertDescription>
              <strong>{t('link.success')}</strong> {result.message}
              {result.linkedUnits > 0 && (
                <div className="mt-2">
                  <Badge variant="secondary">
                    {t('link.result', { linkedUnits: result.linkedUnits })}
                  </Badge>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Detailed Results */}
        {result?.updates && result.updates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('link.results')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.updates.map((update, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 bg-muted ${quick.input}`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`${iconSizes.sm} text-green-600`} />
                      <span className="text-sm">
                        <strong>{t('link.unitLabel')}:</strong> {update.unitId}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      → <strong>{update.contactName}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              💡 {t('link.howItWorks')}
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• {t('link.step1')}</li>
              <li>• {t('link.step2')}</li>
              <li>• {t('link.step3')}</li>
              <li>• {t('link.step4')}</li>
            </ul>
          </CardContent>
        </Card>

        {/* Warning */}
        <Alert>
          <AlertTriangle className={iconSizes.sm} />
          <AlertDescription>
            <strong>{t('link.note')}</strong> {t('link.warning')}
          </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
}

export default LinkSoldUnitsToCustomers;