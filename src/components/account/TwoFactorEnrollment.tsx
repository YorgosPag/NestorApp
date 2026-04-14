'use client';

/**
 * =============================================================================
 * TWO-FACTOR AUTHENTICATION ENROLLMENT COMPONENT
 * =============================================================================
 *
 * Enterprise component for 2FA enrollment with QR code.
 * Render-only: all logic delegated to useTwoFactorEnrollment hook.
 *
 * @module components/account/TwoFactorEnrollment
 * @enterprise ADR-025 - Two-Factor Authentication
 */

import React from 'react';
import {
  Smartphone,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Shield,
  QrCode,
  ChevronRight,
  Download
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateShort } from '@/lib/intl-utils';
import type { UserTwoFactorState } from '@/services/two-factor';
import { useTwoFactorEnrollment } from './useTwoFactorEnrollment';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface TwoFactorEnrollmentProps {
  userId: string;
  onStatusChange?: (status: UserTwoFactorState) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TwoFactorEnrollment({ userId, onStatusChange }: TwoFactorEnrollmentProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const {
    step, setStep, isLoading, error,
    totpSecret, qrCodeDataUrl,
    verificationCode, setVerificationCode,
    backupCodes, copiedSecret, copiedCodes,
    showDisableDialog, setShowDisableDialog,
    twoFactorState, claimsSyncing, syncMessage,
    handleStartEnrollment, handleVerifyCode,
    handleComplete, handleCopySecret,
    handleCopyBackupCodes, handleDownloadBackupCodes,
    handleDisable2FA, handleSyncClaims,
  } = useTwoFactorEnrollment({ userId, onStatusChange });

  // ==========================================================================
  // RENDER STEPS
  // ==========================================================================

  const renderInitialStep = () => (
    <CardContent className={layout.flexColGap4}>
      <figure className={cn(layout.flexCenterGap2, layout.padding4, borders.radiusClass.md, colors.bg.muted)}>
        <Smartphone className={cn(iconSizes.lg, colors.text.muted)} aria-hidden="true" />
        <figcaption className={cn(typography.body.sm, colors.text.muted, 'text-center')}>
          {t('twoFactor.description')}
        </figcaption>
      </figure>

      <Button onClick={handleStartEnrollment} disabled={isLoading} className="w-full">
        {isLoading ? (
          <Spinner size="small" color="inherit" className="mr-2" />
        ) : (
          <Shield className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
        )}
        {t('twoFactor.enableButton')}
      </Button>
    </CardContent>
  );

  const renderQrCodeStep = () => (
    <CardContent className={layout.flexColGap4}>
      <figure className={cn('flex flex-col items-center', layout.padding4)}>
        {qrCodeDataUrl && (
          <img
            src={qrCodeDataUrl}
            alt={t('twoFactor.qrCodeAlt')}
            className={cn(borders.radiusClass.md, 'bg-white p-2')}
            width={200}
            height={200}
          />
        )}
        <figcaption className={cn(typography.body.sm, colors.text.muted, 'mt-2 text-center')}>
          {t('twoFactor.scanQrCode')}
        </figcaption>
      </figure>

      {totpSecret && (
        <section className={cn(layout.padding3, borders.radiusClass.md, colors.bg.muted)}>
          <header className={cn(layout.flexCenterGap2, 'mb-2')}>
            <KeyRound className={cn(iconSizes.xs, colors.text.muted)} aria-hidden="true" />
            <h4 className={cn(typography.body.sm, 'font-medium')}>
              {t('twoFactor.manualEntry')}
            </h4>
          </header>
          <output className={cn(layout.flexCenterBetween, layout.padding2, borders.radiusClass.sm, 'bg-background font-mono text-sm')}>
            <code className="break-all">{totpSecret.secretKey}</code>
            <Button variant="ghost" size="sm" onClick={handleCopySecret} aria-label={t('copy.copyText')}>
              {copiedSecret ? (
                // eslint-disable-next-line design-system/enforce-semantic-colors
                <Check className={cn(iconSizes.xs, 'text-green-500')} />
              ) : (
                <Copy className={iconSizes.xs} />
              )}
            </Button>
          </output>
        </section>
      )}

      <Button onClick={() => setStep('verify')} className="w-full">
        {t('twoFactor.continue')}
        <ChevronRight className={cn(iconSizes.sm, 'ml-2')} aria-hidden="true" />
      </Button>
    </CardContent>
  );

  const renderVerifyStep = () => (
    <CardContent className={layout.flexColGap4}>
      <figure className={cn(layout.flexCenterGap2, layout.padding3, borders.radiusClass.md, colors.bg.muted)}>
        <QrCode className={cn(iconSizes.md, colors.text.primary)} aria-hidden="true" />
        <figcaption className={cn(typography.body.sm)}>
          {t('twoFactor.enterCode')}
        </figcaption>
      </figure>

      <fieldset className={layout.flexColGap2}>
        <label htmlFor="verification-code" className={cn(typography.body.sm, 'font-medium')}>
          {t('twoFactor.verificationCode')}
        </label>
        <Input
          id="verification-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="text-center text-2xl font-mono tracking-widest"
          autoComplete="one-time-code"
        />
      </fieldset>

      {error && (
        <output role="alert" className={cn(layout.flexCenterGap2, layout.padding3, borders.radiusClass.md, colors.bg.error, colors.text.error)}>
          <AlertTriangle className={iconSizes.sm} aria-hidden="true" />
          {error}
        </output>
      )}

      <nav className={cn(layout.flexCenterGap2)}>
        <Button variant="outline" onClick={() => setStep('qr_code')} className="flex-1">
          {t('buttons.cancel')}
        </Button>
        <Button onClick={handleVerifyCode} disabled={isLoading || verificationCode.length !== 6} className="flex-1">
          {isLoading ? <Spinner size="small" color="inherit" /> : t('twoFactor.verify')}
        </Button>
      </nav>
    </CardContent>
  );

  const renderBackupCodesStep = () => (
    <CardContent className={layout.flexColGap4}>
      <figure className={cn(layout.flexCenterGap2, layout.padding3, borders.radiusClass.md, colors.bg.success)}>
        <Check className={cn(iconSizes.md, colors.text.success)} aria-hidden="true" />
        <figcaption className={cn(typography.body.sm, colors.text.success, 'font-medium')}>
          {t('twoFactor.enrollmentSuccess')}
        </figcaption>
      </figure>

      <section>
        <header className={cn(layout.flexCenterBetween, 'mb-2')}>
          <h4 className={cn(typography.body.base, 'font-medium')}>{t('twoFactor.backupCodes')}</h4>
          <Badge variant="secondary">{backupCodes.length} {t('twoFactor.codes')}</Badge>
        </header>

        <output className={cn('grid grid-cols-2 gap-2', layout.padding3, borders.radiusClass.md, colors.bg.muted)}>
          {backupCodes.map((code, i) => (
            <code key={i} className={cn(layout.padding2, borders.radiusClass.sm, 'bg-background font-mono text-sm text-center')}>
              {code}
            </code>
          ))}
        </output>

        <p className={cn(typography.body.sm, colors.text.warning, 'mt-2')}>
          <AlertTriangle className={cn(iconSizes.xs, 'inline mr-1')} aria-hidden="true" />
          {t('twoFactor.backupCodesWarning')}
        </p>
      </section>

      <nav className={cn(layout.flexCenterGap2)}>
        <Button variant="outline" onClick={handleCopyBackupCodes} className="flex-1">
          {copiedCodes ? (
            // eslint-disable-next-line design-system/enforce-semantic-colors
            <Check className={cn(iconSizes.sm, 'mr-2 text-green-500')} />
          ) : (
            <Copy className={cn(iconSizes.sm, 'mr-2')} />
          )}
          {t('copy.copyText')}
        </Button>
        <Button variant="outline" onClick={handleDownloadBackupCodes} className="flex-1">
          <Download className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
          {t('twoFactor.download')}
        </Button>
      </nav>

      <Button onClick={handleComplete} className="w-full">{t('twoFactor.complete')}</Button>
    </CardContent>
  );

  const renderCompleteStep = () => (
    <CardContent className={layout.flexColGap4}>
      <figure className={cn(layout.flexCenterGap2, layout.padding4, borders.radiusClass.md, colors.bg.success)}>
        <Shield className={cn(iconSizes.lg, colors.text.success)} aria-hidden="true" />
        <figcaption className={layout.flexColGap2}>
          <span className={cn(typography.body.base, 'font-medium')}>{t('twoFactor.enabled')}</span>
          <span className={cn(typography.body.sm, colors.text.muted)}>{t('twoFactor.enabledDescription')}</span>
        </figcaption>
      </figure>

      {twoFactorState && (
        <section className={cn(layout.padding3, borders.radiusClass.md, colors.bg.muted)}>
          <dl className={layout.flexColGap2}>
            <div className={layout.flexCenterBetween}>
              <dt className={cn(typography.body.sm, colors.text.muted)}>{t('twoFactor.method')}</dt>
              {/* eslint-disable-next-line custom/no-hardcoded-strings */}
              <dd className={typography.body.sm}>Google Authenticator</dd>
            </div>
            {twoFactorState.enrolledAt && (
              <div className={layout.flexCenterBetween}>
                <dt className={cn(typography.body.sm, colors.text.muted)}>{t('twoFactor.enrolledAt')}</dt>
                <dd className={typography.body.sm}>{formatDateShort(new Date(twoFactorState.enrolledAt))}</dd>
              </div>
            )}
            <div className={layout.flexCenterBetween}>
              <dt className={cn(typography.body.sm, colors.text.muted)}>{t('twoFactor.backupCodesRemaining')}</dt>
              <dd>
                <Badge variant={twoFactorState.backupCodesRemaining < 3 ? 'destructive' : 'secondary'}>
                  {twoFactorState.backupCodesRemaining} / 10
                </Badge>
              </dd>
            </div>
          </dl>
        </section>
      )}

      {syncMessage && (
        <output role="status" className={cn(layout.flexCenterGap2, layout.padding3, borders.radiusClass.md, colors.bg.success, colors.text.success)}>
          <Check className={iconSizes.sm} aria-hidden="true" />
          {syncMessage}
        </output>
      )}

      <Button variant="outline" onClick={handleSyncClaims} disabled={claimsSyncing} className="w-full">
        {claimsSyncing ? (
          <Spinner size="small" color="inherit" className="mr-2" />
        ) : (
          <Shield className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
        )}
        {t('twoFactor.syncClaims')}
      </Button>

      <Button variant="destructive" onClick={() => setShowDisableDialog(true)} className="w-full">
        {t('twoFactor.disable')}
      </Button>

      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('twoFactor.disableTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('twoFactor.disableDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable2FA}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? <Spinner size="small" color="inherit" /> : t('twoFactor.disable')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardContent>
  );

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardHeader>
        <CardTitle className={layout.flexCenterGap2}>
          <Smartphone className={iconSizes.md} aria-hidden="true" />
          {t('account.security.twoFactorTitle')}
          {twoFactorState?.status === 'enrolled' ? (
            <Badge variant="default" className="ml-2 bg-green-600" /* eslint-disable-line design-system/enforce-semantic-colors */>
              {t('twoFactor.active')}
            </Badge>
          ) : (
            <Badge variant="outline" className={cn(colors.text.muted, 'ml-2')}>
              {t('account.security.comingSoon')}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{t('account.security.twoFactorDescription')}</CardDescription>
      </CardHeader>

      {step === 'initial' && renderInitialStep()}
      {step === 'qr_code' && renderQrCodeStep()}
      {step === 'verify' && renderVerifyStep()}
      {step === 'backup_codes' && renderBackupCodesStep()}
      {step === 'complete' && renderCompleteStep()}
    </Card>
  );
}

export default TwoFactorEnrollment;
