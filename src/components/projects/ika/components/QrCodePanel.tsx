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
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';

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

  const [qrData, setQrData] = useState<QrGenerateResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // =========================================================================
  // GENERATE QR
  // =========================================================================

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/attendance/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, date: today }),
      });

      const data = (await res.json()) as QrGenerateResult;

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

    try {
      await navigator.clipboard.writeText(qrData.checkInUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = qrData.checkInUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [qrData?.checkInUrl]);

  // =========================================================================
  // PRINT
  // =========================================================================

  const handlePrint = useCallback(() => {
    if (!qrData?.qrDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

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
          <h2>Παρουσιολόγιο Εργοταξίου</h2>
          <p>Ημερομηνία: ${qrData.validDate}</p>
          <p>Σκανάρετε για check-in/check-out</p>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [qrData]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
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
              <Loader2 className={cn(iconSizes.sm, 'mr-2 animate-spin')} />
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
          <div className="flex items-center gap-2 text-sm text-red-600 mb-4">
            <AlertCircle className={iconSizes.sm} />
            {error}
          </div>
        )}

        {/* QR Code Display */}
        {qrData?.qrDataUrl && (
          <div className="flex flex-col items-center gap-4">
            {/* QR Image */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <img
                src={qrData.qrDataUrl}
                alt="QR Code for attendance check-in"
                className="w-48 h-48"
              />
            </div>

            {/* Date badge */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {t('ika.attendance.qr.active')}
              </span>
              <span className="text-sm text-slate-500">
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
                  <Check className={cn(iconSizes.sm, 'mr-2 text-green-500')} />
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
          <div className="flex flex-col items-center py-8 text-center">
            <QrCode className="h-12 w-12 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">
              {t('ika.attendance.qr.emptyState')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
