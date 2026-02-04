'use client';

/**
 * =============================================================================
 * TWO-FACTOR AUTHENTICATION ENROLLMENT COMPONENT
 * =============================================================================
 *
 * Enterprise component for 2FA enrollment with QR code
 * Following Google/Microsoft security patterns
 *
 * Features:
 * - QR code display for authenticator apps
 * - Manual secret entry fallback
 * - OTP verification
 * - Backup codes display
 *
 * @module components/account/TwoFactorEnrollment
 * @enterprise ADR-025 - Two-Factor Authentication
 */

import React, { useState, useCallback } from 'react';
import {
  Smartphone,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Shield,
  QrCode,
  Loader2,
  ChevronRight,
  Download
} from 'lucide-react';
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
import { auth, db } from '@/lib/firebase';
import { twoFactorService } from '@/services/two-factor';
import type { UserTwoFactorState, TotpSecretInfo } from '@/services/two-factor';
import { AUTH_EVENTS } from '@/config/domain-constants';

// =============================================================================
// TYPES
// =============================================================================

type EnrollmentStep = 'initial' | 'qr_code' | 'verify' | 'backup_codes' | 'complete';

interface TwoFactorEnrollmentProps {
  /** User ID */
  userId: string;
  /** Callback when enrollment status changes */
  onStatusChange?: (status: UserTwoFactorState) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TwoFactorEnrollment({ userId, onStatusChange }: TwoFactorEnrollmentProps) {
  const { t } = useTranslation('common');
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  // State
  const [step, setStep] = useState<EnrollmentStep>('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<TotpSecretInfo | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [twoFactorState, setTwoFactorState] = useState<UserTwoFactorState | null>(null);
  const [claimsSynced, setClaimsSynced] = useState(false);
  const [claimsSyncing, setClaimsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Initialize service
  React.useEffect(() => {
    if (db) {
      twoFactorService.initialize(db);
    }
  }, []);

  // Load 2FA state
  const loadTwoFactorState = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = await twoFactorService.getUserTwoFactorState(userId);
      setTwoFactorState(state);
      onStatusChange?.(state);

      if (state.status === 'enrolled') {
        setStep('complete');
      }
    } catch (err) {
      console.error('Failed to load 2FA state:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, onStatusChange]);

  React.useEffect(() => {
    loadTwoFactorState();
  }, [loadTwoFactorState]);

  // Sync custom claims if user is enrolled but token is stale
  React.useEffect(() => {
    const syncClaimsIfNeeded = async () => {
      if (!auth.currentUser || !twoFactorState || twoFactorState.status !== 'enrolled') {
        return;
      }

      if (claimsSynced || claimsSyncing) {
        return;
      }

      setClaimsSyncing(true);
      try {
        const tokenResult = await auth.currentUser.getIdTokenResult(true);
        const mfaEnrolled = tokenResult.claims.mfaEnrolled === true;

        if (!mfaEnrolled) {
          const syncResult = await twoFactorService.syncMfaEnrollmentClaim();
          if (!syncResult.success) {
            setError(syncResult.error || t('twoFactor.errors.syncFailed'));
            return;
          }

          await auth.currentUser.getIdToken(true);
          window.dispatchEvent(new CustomEvent(AUTH_EVENTS.REFRESH_SESSION));
        }

        setClaimsSynced(true);
      } catch (err) {
        console.error('Failed to sync MFA claims:', err);
      } finally {
        setClaimsSyncing(false);
      }
    };

    syncClaimsIfNeeded();
  }, [twoFactorState, claimsSynced, claimsSyncing, t]);

  // Start enrollment
  const handleStartEnrollment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await twoFactorService.startTotpEnrollment();

      if (result.success && result.totpSecret && result.qrCodeDataUrl) {
        setTotpSecret(result.totpSecret);
        setQrCodeDataUrl(result.qrCodeDataUrl);
        setStep('qr_code');
      } else {
        setError(result.error || t('twoFactor.errors.startFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('twoFactor.errors.startFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Verify code
  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError(t('twoFactor.errors.invalidCodeLength'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await twoFactorService.completeTotpEnrollment(verificationCode);

      if (result.success && result.backupCodes) {
        setBackupCodes(result.backupCodes);
        setStep('backup_codes');

        const syncResult = await twoFactorService.syncMfaEnrollmentClaim();
        if (!syncResult.success) {
          setError(syncResult.error || t('twoFactor.errors.syncFailed'));
          return;
        }

        if (auth.currentUser) {
          await auth.currentUser.getIdToken(true);
          window.dispatchEvent(new CustomEvent(AUTH_EVENTS.REFRESH_SESSION));
        }
      } else {
        setError(result.error || t('twoFactor.errors.verifyFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('twoFactor.errors.verifyFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Complete enrollment
  const handleComplete = async () => {
    setStep('complete');
    await loadTwoFactorState();
  };

  // Copy secret to clipboard
  const handleCopySecret = async () => {
    if (!totpSecret) return;

    try {
      await navigator.clipboard.writeText(totpSecret.secretKey);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Copy backup codes
  const handleCopyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Download backup codes
  const handleDownloadBackupCodes = () => {
    const content = `Nestor Pagonis - Backup Codes\n${'='.repeat(40)}\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\n${t('twoFactor.backupFileNote')}\n\nGenerated: ${new Date().toISOString()}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nestor-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await twoFactorService.disableTwoFactor('all');

      if (result.success) {
        setShowDisableDialog(false);
        setStep('initial');
        setTwoFactorState(null);
        await loadTwoFactorState();
      } else {
        setError(result.error || t('twoFactor.errors.disableFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('twoFactor.errors.disableFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncClaims = async () => {
    if (!auth.currentUser || claimsSyncing) {
      return;
    }

    setClaimsSyncing(true);
    setError(null);
    setSyncMessage(null);

    try {
      const syncResult = await twoFactorService.syncMfaEnrollmentClaim();
      if (!syncResult.success) {
        setError(syncResult.error || t('twoFactor.errors.syncFailed'));
        return;
      }

      await auth.currentUser.getIdToken(true);
      window.dispatchEvent(new CustomEvent(AUTH_EVENTS.REFRESH_SESSION));
      setClaimsSynced(true);
      setSyncMessage(t('twoFactor.syncSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('twoFactor.errors.syncFailed'));
    } finally {
      setClaimsSyncing(false);
    }
  };

  // ==========================================================================
  // RENDER STEPS
  // ==========================================================================

  // Initial state - not enrolled
  const renderInitialStep = () => (
    <CardContent className={layout.flexColGap4}>
      <figure
        className={cn(
          layout.flexCenterGap2,
          layout.padding4,
          borders.radiusClass.md,
          colors.bg.muted
        )}
      >
        <Smartphone className={cn(iconSizes.lg, colors.text.muted)} aria-hidden="true" />
        <figcaption className={cn(typography.body.sm, colors.text.muted, 'text-center')}>
          {t('twoFactor.description')}
        </figcaption>
      </figure>

      <Button
        onClick={handleStartEnrollment}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className={cn(iconSizes.sm, 'animate-spin mr-2')} aria-hidden="true" />
        ) : (
          <Shield className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
        )}
        {t('twoFactor.enableButton')}
      </Button>
    </CardContent>
  );

  // QR Code step
  const renderQrCodeStep = () => (
    <CardContent className={layout.flexColGap4}>
      {/* QR Code */}
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

      {/* Manual entry fallback */}
      {totpSecret && (
        <section className={cn(layout.padding3, borders.radiusClass.md, colors.bg.muted)}>
          <header className={cn(layout.flexCenterGap2, 'mb-2')}>
            <KeyRound className={cn(iconSizes.xs, colors.text.muted)} aria-hidden="true" />
            <h4 className={cn(typography.body.sm, 'font-medium')}>
              {t('twoFactor.manualEntry')}
            </h4>
          </header>
          <output className={cn(
            layout.flexCenterBetween,
            layout.padding2,
            borders.radiusClass.sm,
            'bg-background font-mono text-sm'
          )}>
            <code className="break-all">{totpSecret.secretKey}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopySecret}
              aria-label={t('copy.copyText')}
            >
              {copiedSecret ? (
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

  // Verification step
  const renderVerifyStep = () => (
    <CardContent className={layout.flexColGap4}>
      <figure
        className={cn(
          layout.flexCenterGap2,
          layout.padding3,
          borders.radiusClass.md,
          colors.bg.muted
        )}
      >
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
        <output
          role="alert"
          className={cn(
            layout.flexCenterGap2,
            layout.padding3,
            borders.radiusClass.md,
            colors.bg.error,
            colors.text.error
          )}
        >
          <AlertTriangle className={iconSizes.sm} aria-hidden="true" />
          {error}
        </output>
      )}

      <nav className={cn(layout.flexCenterGap2)}>
        <Button variant="outline" onClick={() => setStep('qr_code')} className="flex-1">
          {t('buttons.cancel')}
        </Button>
        <Button
          onClick={handleVerifyCode}
          disabled={isLoading || verificationCode.length !== 6}
          className="flex-1"
        >
          {isLoading ? (
            <Loader2 className={cn(iconSizes.sm, 'animate-spin')} aria-hidden="true" />
          ) : (
            t('twoFactor.verify')
          )}
        </Button>
      </nav>
    </CardContent>
  );

  // Backup codes step
  const renderBackupCodesStep = () => (
    <CardContent className={layout.flexColGap4}>
      <figure
        className={cn(
          layout.flexCenterGap2,
          layout.padding3,
          borders.radiusClass.md,
          colors.bg.success
        )}
      >
        <Check className={cn(iconSizes.md, colors.text.success)} aria-hidden="true" />
        <figcaption className={cn(typography.body.sm, colors.text.success, 'font-medium')}>
          {t('twoFactor.enrollmentSuccess')}
        </figcaption>
      </figure>

      <section>
        <header className={cn(layout.flexCenterBetween, 'mb-2')}>
          <h4 className={cn(typography.body.base, 'font-medium')}>
            {t('twoFactor.backupCodes')}
          </h4>
          <Badge variant="secondary">{backupCodes.length} {t('twoFactor.codes')}</Badge>
        </header>

        <output
          className={cn(
            'grid grid-cols-2 gap-2',
            layout.padding3,
            borders.radiusClass.md,
            colors.bg.muted
          )}
        >
          {backupCodes.map((code, i) => (
            <code
              key={i}
              className={cn(
                layout.padding2,
                borders.radiusClass.sm,
                'bg-background font-mono text-sm text-center'
              )}
            >
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

      <Button onClick={handleComplete} className="w-full">
        {t('twoFactor.complete')}
      </Button>
    </CardContent>
  );

  // Enrolled state
  const renderCompleteStep = () => (
    <CardContent className={layout.flexColGap4}>
      <figure
        className={cn(
          layout.flexCenterGap2,
          layout.padding4,
          borders.radiusClass.md,
          colors.bg.success
        )}
      >
        <Shield className={cn(iconSizes.lg, colors.text.success)} aria-hidden="true" />
        <figcaption className={layout.flexColGap2}>
          <span className={cn(typography.body.base, 'font-medium')}>
            {t('twoFactor.enabled')}
          </span>
          <span className={cn(typography.body.sm, colors.text.muted)}>
            {t('twoFactor.enabledDescription')}
          </span>
        </figcaption>
      </figure>

      {twoFactorState && (
        <section className={cn(layout.padding3, borders.radiusClass.md, colors.bg.muted)}>
          <dl className={layout.flexColGap2}>
            <div className={layout.flexCenterBetween}>
              <dt className={cn(typography.body.sm, colors.text.muted)}>
                {t('twoFactor.method')}
              </dt>
              <dd className={typography.body.sm}>Google Authenticator</dd>
            </div>
            {twoFactorState.enrolledAt && (
              <div className={layout.flexCenterBetween}>
                <dt className={cn(typography.body.sm, colors.text.muted)}>
                  {t('twoFactor.enrolledAt')}
                </dt>
                <dd className={typography.body.sm}>
                  {new Date(twoFactorState.enrolledAt).toLocaleDateString('el-GR')}
                </dd>
              </div>
            )}
            <div className={layout.flexCenterBetween}>
              <dt className={cn(typography.body.sm, colors.text.muted)}>
                {t('twoFactor.backupCodesRemaining')}
              </dt>
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
        <output
          role="status"
          className={cn(
            layout.flexCenterGap2,
            layout.padding3,
            borders.radiusClass.md,
            colors.bg.success,
            colors.text.success
          )}
        >
          <Check className={iconSizes.sm} aria-hidden="true" />
          {syncMessage}
        </output>
      )}

      <Button
        variant="outline"
        onClick={handleSyncClaims}
        disabled={claimsSyncing}
        className="w-full"
      >
        {claimsSyncing ? (
          <Loader2 className={cn(iconSizes.sm, 'animate-spin mr-2')} aria-hidden="true" />
        ) : (
          <Shield className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
        )}
        {t('twoFactor.syncClaims')}
      </Button>

      <Button
        variant="destructive"
        onClick={() => setShowDisableDialog(true)}
        className="w-full"
      >
        {t('twoFactor.disable')}
      </Button>

      {/* Disable confirmation dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('twoFactor.disableTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('twoFactor.disableDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable2FA}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
              ) : (
                t('twoFactor.disable')
              )}
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
            <Badge variant="default" className="ml-2 bg-green-600">
              {t('twoFactor.active')}
            </Badge>
          ) : (
            <Badge variant="outline" className={cn(colors.text.muted, 'ml-2')}>
              {t('account.security.comingSoon')}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {t('account.security.twoFactorDescription')}
        </CardDescription>
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
