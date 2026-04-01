'use client';

// ============================================================================
// 🏢 ENTERPRISE: ErrorFallbackUI — Shared Error Presentation Component
// ============================================================================
// Single source of truth for error UI. Used by both ErrorBoundaryClass (via
// bridge) and RouteErrorFallback. Eliminates ~570 lines of duplicated JSX.
// @pattern Google — Presentational component, zero business logic
// ============================================================================

import React from 'react';
import {
  AlertTriangle, RefreshCw, Home, ArrowLeft, Bug,
  Copy, Check, Mail, Send, HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { componentSizes } from '@/styles/design-tokens';
import { notificationConfig } from '@/config/error-reporting';
import { EMAIL_PROVIDERS } from './email-compose';
import { ERROR_DIALOG_BUTTON_IDS } from './errorDialogTour';
import type { ErrorFallbackUIProps } from './types';

export function ErrorFallbackUI({
  error,
  errorId,
  errorInfo,
  componentName,
  enableRetry = true,
  enableReporting = true,
  showErrorDetails = process.env.NODE_ENV === 'development',
  retryCount = 0,
  maxRetries = 3,
  onRetry,
  actionState,
  actionHandlers,
  tokens,
  showTourTrigger,
  showTourButton,
  onStartTour,
  digest,
}: ErrorFallbackUIProps) {
  const { borderTokens, colors, typography, spacingTokens, t } = tokens;
  const {
    isReporting, reportSent, isSendingToAdmin,
    emailSent, copySuccess, showEmailOptions,
  } = actionState;
  const {
    handleCopyDetails, handleSendToAdmin, handleReportError,
    handleEmailProviderSelect, handleShowEmailOptions,
    handleGoHome, handleGoBack,
  } = actionHandlers;

  return (
    <main className={`min-h-screen ${colors.bg.primary} flex items-center justify-center ${spacingTokens.padding.md}`}>
      {showTourTrigger}

      <article className="max-w-2xl w-full">
        <section className={`bg-card ${borderTokens.quick.error} ${spacingTokens.padding.xl} shadow-lg ${borderTokens.radiusClass.lg}`}>
          {/* Error Header */}
          <header className={`flex items-center ${spacingTokens.gap.sm} ${spacingTokens.margin.bottom.lg}`}>
            <figure className={`${spacingTokens.padding.sm} ${colors.bg.error} ${borderTokens.radiusClass.full}`}>
              <AlertTriangle className={`${componentSizes.icon.xl} ${colors.text.error}`} />
            </figure>
            <div>
              <h1 className={`${typography.heading.lg} ${colors.text.error}`}>
                {t('boundary.title')}
              </h1>
              <p className={colors.text.error}>
                {componentName
                  ? t('boundary.subtitleWithComponent', { component: componentName })
                  : t('boundary.unexpectedError')}
              </p>
            </div>
          </header>

          {/* Error Message */}
          <section className={`${spacingTokens.margin.bottom.lg} ${spacingTokens.padding.md} ${colors.bg.error} ${borderTokens.quick.error} ${borderTokens.radiusClass.md}`}>
            <p className={`${colors.text.error} ${typography.label.sm}`}>
              {error.message}
            </p>
          </section>

          {/* Action Buttons */}
          <nav className={`flex flex-wrap ${spacingTokens.gap.sm} ${spacingTokens.margin.bottom.lg}`}>
            {enableRetry && retryCount < maxRetries && (
              <Button
                id={ERROR_DIALOG_BUTTON_IDS.retry}
                onClick={onRetry}
                variant="default"
                className={`flex items-center ${spacingTokens.gap.sm}`}
              >
                <RefreshCw className={componentSizes.icon.sm} />
                <span>
                  {retryCount > 0
                    ? t('boundary.tryAgainCount', { current: retryCount + 1, max: maxRetries + 1 })
                    : t('boundary.tryAgain')}
                </span>
              </Button>
            )}

            <Button
              id={ERROR_DIALOG_BUTTON_IDS.back}
              onClick={handleGoBack}
              variant="outline"
              className={`flex items-center ${spacingTokens.gap.sm}`}
            >
              <ArrowLeft className={componentSizes.icon.sm} />
              <span>{t('boundary.back')}</span>
            </Button>

            <Button
              id={ERROR_DIALOG_BUTTON_IDS.home}
              onClick={handleGoHome}
              variant="outline"
              className={`flex items-center ${spacingTokens.gap.sm}`}
            >
              <Home className={componentSizes.icon.sm} />
              <span>{t('boundary.home')}</span>
            </Button>

            {showTourButton && onStartTour && (
              <Button
                id={ERROR_DIALOG_BUTTON_IDS.helpButton}
                onClick={onStartTour}
                variant="ghost"
                className={`flex items-center ${spacingTokens.gap.sm}`}
                title={t('boundary.guide')}
              >
                <HelpCircle className={componentSizes.icon.sm} />
                <span>{t('boundary.guide')}</span>
              </Button>
            )}
          </nav>

          {/* Enterprise Error Reporting */}
          {enableReporting && (
            <section className={spacingTokens.spaceBetween.md}>
              {/* Copy & Admin Actions */}
              <div className={`flex items-center justify-between ${spacingTokens.padding.md} bg-muted ${borderTokens.radiusClass.md} flex-wrap ${spacingTokens.gap.sm}`}>
                <div className={`flex items-center ${spacingTokens.gap.sm}`}>
                  <Bug className={`${componentSizes.icon.md} text-muted-foreground`} />
                  <div>
                    <p className={typography.label.sm}>{t('boundary.errorActions')}</p>
                    <p className={`${typography.body.sm} text-muted-foreground`}>
                      {t('boundary.errorActionsDesc')}
                    </p>
                  </div>
                </div>
                <div className={`flex flex-wrap ${spacingTokens.gap.sm}`}>
                  <Button
                    id={ERROR_DIALOG_BUTTON_IDS.copy}
                    onClick={handleCopyDetails}
                    disabled={copySuccess}
                    variant="outline"
                    size="sm"
                    className={`flex items-center ${spacingTokens.gap.sm}`}
                  >
                    {copySuccess ? (
                      <>
                        <Check className={`${componentSizes.icon.sm} ${colors.text.success}`} />
                        <span>{t('boundary.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className={componentSizes.icon.sm} />
                        <span>{t('boundary.copy')}</span>
                      </>
                    )}
                  </Button>
                  <Button
                    id={ERROR_DIALOG_BUTTON_IDS.notify}
                    onClick={handleSendToAdmin}
                    disabled={isSendingToAdmin || emailSent || showEmailOptions}
                    variant="default"
                    size="sm"
                    className={`flex items-center ${spacingTokens.gap.sm}`}
                  >
                    {isSendingToAdmin ? (
                      <>
                        <RefreshCw className={`${componentSizes.icon.sm} animate-spin`} />
                        <span>{t('boundary.sending')}</span>
                      </>
                    ) : emailSent ? (
                      <>
                        <Check className={`${componentSizes.icon.sm} ${colors.text.success}`} />
                        <span>{t('boundary.sent')}</span>
                      </>
                    ) : (
                      <>
                        <Send className={componentSizes.icon.sm} />
                        <span>{t('boundary.notifyAdmin')}</span>
                      </>
                    )}
                  </Button>
                  <Button
                    id={ERROR_DIALOG_BUTTON_IDS.email}
                    onClick={handleShowEmailOptions}
                    disabled={showEmailOptions || emailSent}
                    variant="outline"
                    size="sm"
                    className={`flex items-center ${spacingTokens.gap.sm}`}
                  >
                    <Mail className={componentSizes.icon.sm} />
                    <span>{t('boundary.sendEmail')}</span>
                  </Button>
                </div>
              </div>

              {/* Email Provider Selection */}
              {showEmailOptions && (
                <div className={`${spacingTokens.padding.md} bg-muted border ${borderTokens.quick.default} ${borderTokens.radiusClass.md}`}>
                  <p className={`${typography.label.sm} ${colors.text.primary} ${spacingTokens.margin.bottom.sm} flex items-center ${spacingTokens.gap.sm}`}>
                    <Mail className={componentSizes.icon.sm} />
                    <span>{t('boundary.selectEmailProvider')}</span>
                  </p>
                  <div className={`grid grid-cols-2 ${spacingTokens.gap.sm}`}>
                    {EMAIL_PROVIDERS.map((provider) => {
                      const IconComponent = provider.Icon;
                      return (
                        <Button
                          key={provider.id}
                          onClick={() => handleEmailProviderSelect(provider.id)}
                          variant="outline"
                          size="sm"
                          className={`flex items-center justify-start ${spacingTokens.gap.sm}`}
                        >
                          <IconComponent className={componentSizes.icon.sm} />
                          <span>{provider.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                  <p className={`${typography.body.xs} ${colors.text.muted} ${spacingTokens.margin.top.sm}`}>
                    {t('boundary.emailWillOpen')}
                  </p>
                </div>
              )}

              {/* Anonymous Error Reporting */}
              <div className={`flex items-center justify-between ${spacingTokens.padding.md} bg-muted/50 ${borderTokens.radiusClass.md} flex-wrap ${spacingTokens.gap.sm}`}>
                <div className={`flex items-center ${spacingTokens.gap.sm}`}>
                  <Send className={`${componentSizes.icon.md} text-muted-foreground`} />
                  <div>
                    <p className={typography.label.sm}>{t('boundary.anonymousReport')}</p>
                    <p className={`${typography.body.sm} text-muted-foreground`}>
                      {t('boundary.anonymousReportDesc')}
                    </p>
                  </div>
                </div>
                <Button
                  id={ERROR_DIALOG_BUTTON_IDS.report}
                  onClick={handleReportError}
                  disabled={isReporting || reportSent}
                  variant="outline"
                  size="sm"
                >
                  {isReporting ? (
                    <>
                      <RefreshCw className={`${componentSizes.icon.sm} ${spacingTokens.margin.right.sm} animate-spin`} />
                      {t('boundary.sending')}
                    </>
                  ) : reportSent ? (
                    <>
                      <Check className={`${componentSizes.icon.sm} ${spacingTokens.margin.right.sm} ${colors.text.success}`} />
                      {t('boundary.sent')}
                    </>
                  ) : (
                    t('boundary.reportError')
                  )}
                </Button>
              </div>
            </section>
          )}

          {/* Error Details (Development) */}
          {showErrorDetails && (
            <details className={spacingTokens.margin.top.lg}>
              <summary className={`cursor-pointer text-muted-foreground ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${spacingTokens.margin.bottom.sm}`}>
                {t('boundary.technicalDetails')}
              </summary>
              <div className={spacingTokens.spaceBetween.md}>
                <div>
                  <div className={`flex items-center justify-between ${spacingTokens.margin.bottom.sm}`}>
                    <h4 className={typography.label.sm}>{t('boundary.errorStack')}</h4>
                    <Button onClick={handleCopyDetails} variant="ghost" size="sm" disabled={copySuccess}>
                      {copySuccess ? (
                        <Check className={`${componentSizes.icon.sm} ${colors.text.success}`} />
                      ) : (
                        <Copy className={componentSizes.icon.sm} />
                      )}
                    </Button>
                  </div>
                  <pre className={`${typography.body.xs} bg-muted ${spacingTokens.padding.sm} ${borderTokens.radiusClass.default} overflow-auto max-h-40`}>
                    {error.stack}
                  </pre>
                </div>

                {errorInfo?.componentStack && (
                  <div>
                    <h4 className={`${typography.label.sm} ${spacingTokens.margin.bottom.sm}`}>{t('boundary.componentStack')}</h4>
                    <pre className={`${typography.body.xs} bg-muted ${spacingTokens.padding.sm} ${borderTokens.radiusClass.default} overflow-auto max-h-40`}>
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}

                <div className={`${typography.body.xs} text-muted-foreground ${spacingTokens.spaceBetween.xs}`}>
                  <p><strong>{t('boundary.errorId')}:</strong> {errorId}</p>
                  {digest && <p><strong>{t('boundary.digest')}:</strong> {digest}</p>}
                  <p><strong>{t('boundary.timestamp')}:</strong> {new Date().toISOString()}</p>
                  <p><strong>{t('boundary.url')}:</strong> {typeof window !== 'undefined' ? window.location.href : 'SSR'}</p>
                </div>
              </div>
            </details>
          )}

          {/* Admin Email Footer */}
          <footer className={`${spacingTokens.margin.top.lg} ${spacingTokens.padding.top.md} border-t text-center ${typography.body.xs} text-muted-foreground`}>
            <p>{t('boundary.adminEmail')}: {notificationConfig.channels.adminEmail}</p>
          </footer>
        </section>
      </article>
    </main>
  );
}
