/**
 * =============================================================================
 * TWO-FACTOR ENROLLMENT - Custom Hook
 * =============================================================================
 *
 * Manages all state, effects, and handlers for 2FA enrollment.
 *
 * @module components/account/useTwoFactorEnrollment
 * @enterprise ADR-025 - Two-Factor Authentication
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useState, useCallback, useEffect } from 'react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { auth, db } from '@/lib/firebase';
import { twoFactorService } from '@/services/two-factor';
import type { UserTwoFactorState, TotpSecretInfo } from '@/services/two-factor';
import { AUTH_EVENTS } from '@/config/domain-constants';
import { PRODUCT_NAME } from '@/constants/product-identity';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('TwoFactorEnrollment');

export type EnrollmentStep = 'initial' | 'qr_code' | 'verify' | 'backup_codes' | 'complete';

interface UseTwoFactorEnrollmentParams {
  userId: string;
  onStatusChange?: (status: UserTwoFactorState) => void;
}

export function useTwoFactorEnrollment({ userId, onStatusChange }: UseTwoFactorEnrollmentParams) {
  const { t } = useTranslation(COMMON_NAMESPACES);

  // State
  const [step, setStep] = useState<EnrollmentStep>('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<TotpSecretInfo | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const { copy: copySecret, copied: copiedSecret } = useCopyToClipboard();
  const { copy: copyCodes, copied: copiedCodes } = useCopyToClipboard();
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [twoFactorState, setTwoFactorState] = useState<UserTwoFactorState | null>(null);
  const [claimsSynced, setClaimsSynced] = useState(false);
  const [claimsSyncing, setClaimsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Initialize service
  useEffect(() => {
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
      logger.error('Failed to load 2FA state', { error: err });
    } finally {
      setIsLoading(false);
    }
  }, [userId, onStatusChange]);

  useEffect(() => {
    loadTwoFactorState();
  }, [loadTwoFactorState]);

  /**
   * **Γράψε το claim `mfaEnrolled` και κάνε το να ΦΤΑΣΕΙ στη συνεδρία.**
   *
   * ⚠️ **Τα τρία βήματα είναι ΕΝΑ και αδιαίρετο**: γράψιμο του claim · **αναγκαστική**
   * ανανέωση του token (`getIdToken(true)`) · ειδοποίηση της συνεδρίας. Αν λείψει το
   * δεύτερο, το claim υπάρχει στον διακομιστή και η οθόνη κρατά **παλιό** token — δηλαδή
   * ο χρήστης είναι εγγεγραμμένος και το app δεν το ξέρει. Γι' αυτό δεν είναι τρεις
   * γραμμές που τυχαίνει να γειτονεύουν: είναι **μία πράξη**.
   *
   * 🧹 Εξήχθη 2026-09-12 (CHECK 3.28 — 9 γραμμές / 57 tokens σε **δύο** σημεία αυτού του
   * αρχείου: το effect συγχρονισμού και το χειροκίνητο κουμπί). Ο καλών παίρνει τον
   * χρήστη **ως όρισμα** επειδή το `auth.currentUser` μπορεί να έχει αλλάξει μετά το
   * `await` — και τα δύο σημεία τον έχουν ήδη ελέγξει.
   *
   * @returns `true` αν το claim έφτασε· `false` αν όχι — **το μήνυμα σφάλματος έχει ήδη
   *          μπει στο state**, ο καλών απλώς σταματά.
   */
  const claimMfaEnrollment = useCallback(
    async (user: NonNullable<typeof auth.currentUser>): Promise<boolean> => {
      const syncResult = await twoFactorService.syncMfaEnrollmentClaim();
      if (!syncResult.success) {
        setError(syncResult.error || t('twoFactor.errors.syncFailed'));
        return false;
      }

      await user.getIdToken(true);
      window.dispatchEvent(new CustomEvent(AUTH_EVENTS.REFRESH_SESSION));
      return true;
    },
    [t],
  );

  // Sync custom claims if user is enrolled but token is stale
  useEffect(() => {
    const syncClaimsIfNeeded = async () => {
      if (!auth.currentUser || !twoFactorState || twoFactorState.status !== 'enrolled') {
        return;
      }

      if (claimsSynced || claimsSyncing) {
        return;
      }

      const user = auth.currentUser;
      setClaimsSyncing(true);
      try {
        const tokenResult = await user.getIdTokenResult(true);
        const mfaEnrolled = tokenResult.claims.mfaEnrolled === true;

        if (!mfaEnrolled && !(await claimMfaEnrollment(user))) {
          return;
        }

        setClaimsSynced(true);
      } catch (err) {
        logger.error('Failed to sync MFA claims', { error: err });
      } finally {
        setClaimsSyncing(false);
      }
    };

    syncClaimsIfNeeded();
  }, [twoFactorState, claimsSynced, claimsSyncing, t, claimMfaEnrollment]);

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
    await copySecret(totpSecret.secretKey);
  };

  // Copy backup codes
  const handleCopyBackupCodes = async () => {
    await copyCodes(backupCodes.join('\n'));
  };

  // Download backup codes
  const handleDownloadBackupCodes = () => {
    const content = `${PRODUCT_NAME} - Backup Codes\n${'='.repeat(40)}\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\n${t('twoFactor.backupFileNote')}\n\nGenerated: ${nowISO()}`;

    const blob = new Blob([content], { type: 'text/plain' });
    triggerExportDownload({ blob, filename: 'nestor-backup-codes.txt' });
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
    const user = auth.currentUser;
    if (!user || claimsSyncing) {
      return;
    }

    setClaimsSyncing(true);
    setError(null);
    setSyncMessage(null);

    try {
      if (!(await claimMfaEnrollment(user))) {
        return;
      }

      setClaimsSynced(true);
      setSyncMessage(t('twoFactor.syncSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('twoFactor.errors.syncFailed'));
    } finally {
      setClaimsSyncing(false);
    }
  };

  return {
    // State
    step,
    setStep,
    isLoading,
    error,
    totpSecret,
    qrCodeDataUrl,
    verificationCode,
    setVerificationCode,
    backupCodes,
    copiedSecret,
    copiedCodes,
    showDisableDialog,
    setShowDisableDialog,
    twoFactorState,
    claimsSyncing,
    syncMessage,
    // Handlers
    handleStartEnrollment,
    handleVerifyCode,
    handleComplete,
    handleCopySecret,
    handleCopyBackupCodes,
    handleDownloadBackupCodes,
    handleDisable2FA,
    handleSyncClaims,
  };
}
