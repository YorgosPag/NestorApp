/**
 * =============================================================================
 * 🏢 ENTERPRISE: FileManagerErrorView
 * =============================================================================
 *
 * Error view component with admin notification and email provider selection.
 * Enterprise error reporting pattern with multi-provider email support.
 *
 * @module components/file-manager/FileManagerErrorView
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useErrorReporting,
  openEmailCompose,
  EMAIL_PROVIDERS,
  type EmailProvider,
} from '@/components/ui/ErrorBoundary/ErrorBoundary';
import { notificationConfig } from '@/config/error-reporting';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/styles/design-tokens';

// ============================================================================
// TYPES
// ============================================================================

interface FileManagerErrorViewProps {
  error: Error;
  onRetry: () => void;
  t: (key: string) => string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FileManagerErrorView({ error, onRetry, t }: FileManagerErrorViewProps) {
  const [showEmailOptions, setShowEmailOptions] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { reportError } = useErrorReporting();
  const colors = useSemanticColors();

  const errorId = reportError(error, {
    component: 'FileManager',
    action: 'Data Loading Error',
    url: window.location.href,
  });

  const emailData = {
    to: notificationConfig.channels.adminEmail,
    subject: `🚨 File Manager Error - ${new Date().toISOString()}`,
    body: `
📋 ERROR REPORT - File Manager
================================

📍 Error Message: ${error.message}

📌 Error ID: ${errorId}

⏰ Timestamp: ${new Date().toISOString()}

🌐 URL: ${window.location.href}

📚 Stack Trace:
${error.stack || 'Not available'}

---
Αυτό το email δημιουργήθηκε αυτόματα από το File Manager.
    `.trim(),
  };

  const handleEmailProviderSelect = (provider: EmailProvider) => {
    openEmailCompose(provider, emailData);
    setEmailSent(true);
    setShowEmailOptions(false);
  };

  return (
    <main className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-6">
          <section className="text-center" role="alert">
            {/* Error Icon */}
            <figure className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </figure>

            {/* Error Title */}
            <h2 className="text-xl font-semibold text-destructive mb-2">
              {t('manager.errorLoading')}
            </h2>

            {/* Error Message */}
            <p className={cn('mb-6', colors.text.muted)}>
              {error.message}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={onRetry} variant="default">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('manager.retry')}
              </Button>

              <Button
                onClick={() => setShowEmailOptions(true)}
                variant="outline"
                disabled={emailSent || showEmailOptions}
              >
                {emailSent ? (
                  <>
                    <Mail className="h-4 w-4 mr-2 text-emerald-600" />
                    {t('errorReporting.sent')}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    {t('errorReporting.notifyAdmin')}
                  </>
                )}
              </Button>
            </div>

            {/* Email Provider Selection */}
            {showEmailOptions && (
              <div className="mt-4 p-4 bg-muted border border-border rounded-md text-left">
                <p className="font-medium text-foreground mb-3 text-center flex items-center justify-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{t('errorReporting.selectProvider')}</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {EMAIL_PROVIDERS.map((provider) => {
                    const IconComponent = provider.Icon;
                    return (
                      <Button
                        key={provider.id}
                        onClick={() => handleEmailProviderSelect(provider.id)}
                        variant="outline"
                        size="sm"
                        className="flex items-center justify-start gap-2"
                      >
                        <IconComponent className="h-4 w-4" />
                        <span>{provider.labelEl}</span>
                      </Button>
                    );
                  })}
                </div>
                <p className={cn('text-xs mt-2 text-center', colors.text.muted)}>
                  {t('errorReporting.redirectHint')}
                </p>
              </div>
            )}

            {/* Admin Email Info */}
            <p className={cn('text-xs mt-4', colors.text.muted)}>
              {t('errorReporting.emailLabel')}: {notificationConfig.channels.adminEmail}
            </p>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
