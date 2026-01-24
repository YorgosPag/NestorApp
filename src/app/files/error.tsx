/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Manager Error Boundary
 * =============================================================================
 *
 * Error boundary για το File Manager route.
 * Catches runtime errors και displays user-friendly error message.
 * Includes admin notification via email.
 *
 * @route /files
 * @enterprise Error Boundary Pattern (React 18)
 * @updated 2026-01-24 - Added enterprise error reporting with admin email
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Home, Mail, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import Link from 'next/link';
import { notificationConfig } from '@/config/error-reporting';
import { useErrorReporting } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error component για το File Manager
 *
 * Displayed when an unhandled error occurs in the /files route.
 * Provides options to retry, navigate away, or report to admin.
 */
export default function FileManagerError({ error, reset }: ErrorProps) {
  const { t } = useTranslation('common');
  const { t: tFiles } = useTranslation('files');
  const { reportError } = useErrorReporting();

  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log error to enterprise error reporting service
    reportError(error, {
      component: 'FileManagerRoute',
      action: 'Route Error Boundary',
      digest: error.digest,
      url: typeof window !== 'undefined' ? window.location.href : ''
    });

    console.error('File Manager Error:', error);
  }, [error, reportError]);

  const handleSendToAdmin = async () => {
    setIsSending(true);
    try {
      const adminEmail = notificationConfig.channels.adminEmail;
      const subject = encodeURIComponent(`🚨 File Manager Route Error - ${new Date().toISOString()}`);
      const body = encodeURIComponent(`
📋 ERROR REPORT - File Manager Route
=====================================

📍 Error Message: ${error.message}

📌 Error Digest: ${error.digest || 'N/A'}

⏰ Timestamp: ${new Date().toISOString()}

🌐 URL: ${typeof window !== 'undefined' ? window.location.href : 'SSR'}

📚 Stack Trace:
${error.stack || 'Not available'}

---
Αυτό το email δημιουργήθηκε αυτόματα από το File Manager Error Boundary.
      `.trim());

      window.open(`mailto:${adminEmail}?subject=${subject}&body=${body}`, '_self');
      setEmailSent(true);
    } catch (sendError) {
      console.error('Failed to send error report:', sendError);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyError = async () => {
    try {
      const errorDetails = JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'SSR'
      }, null, 2);

      await navigator.clipboard.writeText(errorDetails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error('Failed to copy error:', copyError);
    }
  };

  return (
    <main className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <figure className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </figure>
          <CardTitle className="text-xl">
            {t('errors.fileManager.title', 'File Manager Error')}
          </CardTitle>
          <CardDescription>
            {t('errors.fileManager.description', 'An error occurred while loading the file manager.')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error Details (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <section className="p-3 rounded-md bg-muted text-sm">
              <header className="flex items-center justify-between mb-1">
                <p className="font-medium">Error Details:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyError}
                  className="h-6 px-2"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </header>
              <p className="text-muted-foreground font-mono text-xs break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-muted-foreground font-mono text-xs mt-1">
                  Digest: {error.digest}
                </p>
              )}
            </section>
          )}

          {/* Actions */}
          <nav className="flex flex-col gap-2">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('errors.retry', 'Try Again')}
            </Button>

            {/* 🏢 ENTERPRISE: Admin Notification Button */}
            <Button
              variant="outline"
              onClick={handleSendToAdmin}
              disabled={isSending || emailSent}
              className="w-full"
            >
              {isSending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {tFiles('errorReporting.sending', 'Sending...')}
                </>
              ) : emailSent ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  {tFiles('errorReporting.sent', 'Sent!')}
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  {tFiles('errorReporting.notifyAdmin', 'Notify Administrator')}
                </>
              )}
            </Button>

            <Button variant="ghost" asChild className="w-full">
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                {t('errors.goHome', 'Go to Home')}
              </Link>
            </Button>
          </nav>

          {/* Admin Email Info */}
          <p className="text-center text-xs text-muted-foreground">
            {tFiles('errorReporting.emailLabel', 'Email')}: {notificationConfig.channels.adminEmail}
          </p>

          {/* Support Info */}
          <footer className="text-center text-xs text-muted-foreground pt-2 border-t">
            {t('errors.persistentIssue', 'If this issue persists, please contact support.')}
          </footer>
        </CardContent>
      </Card>
    </main>
  );
}
