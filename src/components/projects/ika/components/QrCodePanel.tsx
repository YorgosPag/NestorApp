'use client';

/**
 * =============================================================================
 * QrCodePanel — Admin QR Code Generation & Display
 * =============================================================================
 *
 * Admin component for generating, displaying, printing, and managing
 * daily QR codes for construction site attendance.
 *
 * Features:
 * - Generate QR for today/specific date
 * - Display QR code image (printable)
 * - Copy check-in URL to clipboard
 * - Token status badge (active/expired/revoked)
 * - Print-friendly layout
 *
 * @module components/projects/ika/components/QrCodePanel
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import React, { useState, useCallback } from 'react';
import {
  QrCode,
  RefreshCw,
  Copy,
  Check,
  Printer,
  AlertCircle,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import { generateAttendanceQrCodeWithPolicy } from '@/services/ika/ika-mutation-gateway';

// =============================================================================
// TYPES
// =============================================================================

interface QrCodePanelProps {
  projectId: string;
}

interface QrGenerateResult {
  success: boolean;
  tokenId?: string;
  qrDataUrl?: string;
  validDate?: string;
  expiresAt?: string;
  checkInUrl?: string;
  error?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QrCodePanel({ projectId }: QrCodePanelProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const [qrData, setQrData] = useState<QrGenerateResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copy, copied } = useCopyToClipboard();

  // =========================================================================
  // GENERATE QR
  // =========================================================================

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await generateAttendanceQrCodeWithPolicy({ projectId, date: today });

      if (data.success) {
        setQrData(data);
      } else {
        setError(data.error ?? t('ika.attendance.qr.generateError'));
      }
    } catch {
      setError(t('ika.attendance.qr.networkError'));
    } finally {
      setIsGenerating(false);
    }
  }, [projectId, t]);

  // =========================================================================
  // COPY URL
  // =========================================================================

  const handleCopyUrl = useCallback(async () => {
    if (!qrData?.checkInUrl) return;
    await copy(qrData.checkInUrl);
  }, [qrData?.checkInUrl, copy]);

  // =========================================================================
  // PRINT
  // =========================================================================

  const handlePrint = useCallback(() => {
    if (!qrData?.qrDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // eslint-disable-next-line design-system/no-hardcoded-colors -- Print window HTML requires inline CSS color strings
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${qrData.validDate}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; padding: 40px; font-family: sans-serif; }
            img { width: 300px; height: 300px; }
            h2 { margin-top: 20px; font-size: 18px; }
            p { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <img src="${qrData.qrDataUrl}" alt="QR Code" />
          <h2>${t('attendance.siteAttendance')}</h2>
          <p>Ημερομηνία: ${qrData.validDate}</p>
          <p>${t('attendance.scanForCheckInOut')}</p>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [qrData, t]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className={cn(typography.card.title, 'flex items-center gap-2')}>
              <QrCode className={iconSizes.md} />
              {t('ika.attendance.qr.title')}
            </CardTitle>
            <CardDescription>
              {t('ika.attendance.qr.description')}
            </CardDescription>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            variant={qrData ? 'outline' : 'default'}
            size="sm"
          >
            {isGenerating ? (
              <Spinner size="small" color="inherit" className="mr-2" />
            ) : (
              <RefreshCw className={cn(iconSizes.sm, 'mr-2')} />
            )}
            {qrData
              ? t('ika.attendance.qr.regenerate')
              : t('ika.attendance.qr.generate')
            }
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Error */}
        {error && (
          <div className={cn("flex items-center gap-2 mb-2", typography.body.sm, getStatusColor('error', 'text'))}>
            <AlertCircle className={iconSizes.sm} />
            {error}
          </div>
        )}

        {/* QR Code Display */}
        {qrData?.qrDataUrl && (
          <div className="flex flex-col items-center gap-2">
            {/* QR Image */}
            <div className="bg-white border border-slate-200 rounded-lg p-2">
              <img
                src={qrData.qrDataUrl}
                alt="QR Code for attendance check-in"
                className="w-48 h-48"
              />
            </div>

            {/* Date badge */}
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full", typography.label.xs, getStatusColor('active', 'bg'), 'bg-opacity-10', getStatusColor('active', 'text'))}>
                {t('ika.attendance.qr.active')}
              </span>
              <span className={cn(typography.body.sm, 'text-slate-500')}>
                {qrData.validDate}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
              >
                {copied ? (
                  <Check className={cn(iconSizes.sm, 'mr-2', getStatusColor('active', 'text'))} />
                ) : (
                  <Copy className={cn(iconSizes.sm, 'mr-2')} />
                )}
                {copied
                  ? t('ika.attendance.qr.copied')
                  : t('ika.attendance.qr.copyUrl')
                }
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
              >
                <Printer className={cn(iconSizes.sm, 'mr-2')} />
                {t('ika.attendance.qr.print')}
              </Button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!qrData && !isGenerating && !error && (
          <div className="flex flex-col items-center py-2 text-center">
            <QrCode className="h-12 w-12 text-slate-300 mb-2" />
            <p className={cn(typography.body.sm, 'text-slate-500')}>
              {t('ika.attendance.qr.emptyState')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
