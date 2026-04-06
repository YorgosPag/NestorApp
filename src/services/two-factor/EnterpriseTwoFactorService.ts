/**
 * =============================================================================
 * ENTERPRISE TWO-FACTOR AUTHENTICATION SERVICE
 * =============================================================================
 *
 * Production-grade 2FA/MFA service using Firebase TOTP MFA
 * Following Google/Microsoft/Okta enterprise security patterns
 *
 * Split (ADR-065 Phase 5):
 * - two-factor-helpers.ts → Backup codes + MFA sign-in helpers
 * - EnterpriseTwoFactorService.ts (this) → Main service class
 * - two-factor.types.ts → TypeScript interfaces
 *
 * @module services/two-factor/EnterpriseTwoFactorService
 * @enterprise ADR-025 - Two-Factor Authentication
 */

import {
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  MultiFactorResolver,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc, updateDoc, Firestore } from 'firebase/firestore';
import QRCode from 'qrcode';
import { auth } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('EnterpriseTwoFactorService');
import { API_ROUTES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';
import { designTokens } from '@/styles/design-tokens';
import type {
  TotpSecretInfo,
  EnrolledTotpFactor,
  BackupCode,
  BackupCodesCollection,
  UserTwoFactorState,
  StartEnrollmentResult,
  CompleteEnrollmentResult,
  VerifyTwoFactorResult,
  DisableTwoFactorResult,
  TwoFactorActionResult,
  TwoFactorStatus
} from './two-factor.types';
import {
  generateBackupCodes,
  storeBackupCodes,
  verifyBackupCode,
  regenerateBackupCodesForUser,
  getBackupCodesRemaining as getBackupCodesCount,
  getMfaResolver as getMfaResolverHelper,
  verifyTotpForSignIn as verifyTotpForSignInHelper,
} from './two-factor-helpers';

// =============================================================================
// CONSTANTS
// =============================================================================

const APP_NAME = 'Nestor Pagonis';
const FIRESTORE_COLLECTION = COLLECTIONS.USER_2FA_SETTINGS;

// =============================================================================
// ENTERPRISE TWO-FACTOR SERVICE
// =============================================================================

/**
 * Enterprise-grade Two-Factor Authentication Service
 *
 * Implements:
 * - TOTP enrollment with Google Authenticator compatibility
 * - Secure backup codes generation and storage
 * - Multi-factor sign-in resolution
 * - Factor management (enable/disable)
 */
export class EnterpriseTwoFactorService {
  private static instance: EnterpriseTwoFactorService;
  private db: Firestore | null = null;
  private pendingTotpSecret: TotpSecret | null = null;
  private isInitialized = false;

  private constructor() {
    logger.info('🔐 EnterpriseTwoFactorService created');
  }

  // ===========================================================================
  // CLAIM SYNC
  // ===========================================================================

  /**
   * Sync MFA enrollment to custom claims (server-side).
   * Required so admin gates see mfaEnrolled=true.
   */
  async syncMfaEnrollmentClaim(): Promise<{ success: boolean; error?: string }> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    try {
      const idToken = await currentUser.getIdToken(true);

      const response = await fetch(API_ROUTES.AUTH.MFA_ENROLL_COMPLETE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const payload = await response.json();
        return { success: false, error: payload?.error || payload?.message || 'Failed to sync MFA' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Failed to sync MFA') };
    }
  }

  /** Get singleton instance */
  static getInstance(): EnterpriseTwoFactorService {
    if (!EnterpriseTwoFactorService.instance) {
      EnterpriseTwoFactorService.instance = new EnterpriseTwoFactorService();
    }
    return EnterpriseTwoFactorService.instance;
  }

  /** Initialize service with Firestore instance */
  initialize(firestore: Firestore): void {
    if (this.isInitialized) return;

    this.db = firestore;
    this.isInitialized = true;
    logger.info('🔐 EnterpriseTwoFactorService initialized');
  }

  // ===========================================================================
  // USER 2FA STATE
  // ===========================================================================

  /** Get user's 2FA state */
  async getUserTwoFactorState(userId: string): Promise<UserTwoFactorState> {
    const currentUser = auth.currentUser;

    // Get enrolled factors from Firebase Auth
    const enrolledFactors: EnrolledTotpFactor[] = [];
    let status: TwoFactorStatus = 'not_enrolled';

    if (currentUser) {
      const mfaUser = multiFactor(currentUser);
      const factors = mfaUser.enrolledFactors;

      for (const factor of factors) {
        if (factor.factorId === TotpMultiFactorGenerator.FACTOR_ID) {
          enrolledFactors.push({
            uid: factor.uid,
            displayName: factor.displayName || 'Authenticator App',
            factorId: factor.factorId,
            enrolledAt: factor.enrollmentTime ? new Date(factor.enrollmentTime) : new Date()
          });
        }
      }

      if (enrolledFactors.length > 0) {
        status = 'enrolled';
      }
    }

    // Get backup codes info from Firestore
    let hasBackupCodes = false;
    let backupCodesRemaining = 0;

    if (this.db) {
      try {
        const docRef = doc(this.db, FIRESTORE_COLLECTION, userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.backupCodes) {
            const backupCodesData = data.backupCodes as BackupCodesCollection | BackupCode[];
            const codes = Array.isArray(backupCodesData)
              ? backupCodesData
              : Array.isArray(backupCodesData.codes)
                ? backupCodesData.codes
                : [];

            hasBackupCodes = codes.length > 0;
            backupCodesRemaining = Array.isArray(backupCodesData)
              ? codes.filter(c => !c.used).length
              : typeof backupCodesData.remainingCount === 'number'
                ? backupCodesData.remainingCount
                : codes.filter(c => !c.used).length;
          }
        }
      } catch (error) {
        logger.warn('⚠️ [2FA] Failed to get backup codes info:', error);
      }
    }

    return {
      userId,
      status,
      enabledMethods: enrolledFactors.length > 0 ? ['totp'] : [],
      primaryMethod: enrolledFactors.length > 0 ? 'totp' : undefined,
      totpFactors: enrolledFactors,
      hasBackupCodes,
      backupCodesRemaining,
      enrolledAt: enrolledFactors[0]?.enrolledAt
    };
  }

  // ===========================================================================
  // ENROLLMENT
  // ===========================================================================

  /** Start TOTP enrollment - generates secret and QR code */
  async startTotpEnrollment(displayName?: string): Promise<StartEnrollmentResult> {
    void displayName; // reserved for future use
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    if (!currentUser.email) {
      return { success: false, error: 'User must have verified email for 2FA' };
    }

    try {
      const mfaUser = multiFactor(currentUser);
      const session = await mfaUser.getSession();

      const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
      this.pendingTotpSecret = totpSecret;

      const qrCodeUri = totpSecret.generateQrCodeUrl(currentUser.email, APP_NAME);

      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUri, {
        width: 200,
        margin: 2,
        color: {
          dark: designTokens.colors.text.primary,
          light: designTokens.colors.background.primary
        }
      });

      const secretInfo: TotpSecretInfo = {
        secretKey: totpSecret.secretKey,
        qrCodeUri,
        accountName: currentUser.email,
        issuer: APP_NAME,
        algorithm: 'SHA1',
        digits: 6,
        period: 30
      };

      logger.info('🔐 [2FA] TOTP enrollment started for:', currentUser.email);

      return { success: true, totpSecret: secretInfo, qrCodeDataUrl };
    } catch (error) {
      logger.error('❌ [2FA] Failed to start enrollment:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to generate TOTP secret')
      };
    }
  }

  /** Complete TOTP enrollment with verification code */
  async completeTotpEnrollment(
    verificationCode: string,
    displayName: string = 'Authenticator App'
  ): Promise<CompleteEnrollmentResult> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    if (!this.pendingTotpSecret) {
      return { success: false, error: 'No pending enrollment. Please start enrollment first.' };
    }

    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        this.pendingTotpSecret,
        verificationCode
      );

      const mfaUser = multiFactor(currentUser);
      await mfaUser.enroll(assertion, displayName);

      // Generate and store backup codes
      const backupCodes = generateBackupCodes();
      if (this.db) {
        await storeBackupCodes(this.db, currentUser.uid, backupCodes);
      }

      this.pendingTotpSecret = null;

      const enrolledFactors = mfaUser.enrolledFactors;
      const newFactor = enrolledFactors.find(f =>
        f.factorId === TotpMultiFactorGenerator.FACTOR_ID
      );

      logger.info('✅ [2FA] TOTP enrollment completed for:', currentUser.email);

      return {
        success: true,
        backupCodes,
        enrolledFactor: newFactor ? {
          uid: newFactor.uid,
          displayName: newFactor.displayName || displayName,
          factorId: newFactor.factorId,
          enrolledAt: new Date()
        } : undefined
      };
    } catch (error) {
      logger.error('❌ [2FA] Failed to complete enrollment:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to verify code')
      };
    }
  }

  // ===========================================================================
  // SIGN-IN WITH MFA (delegates to helpers)
  // ===========================================================================

  /** Get MFA resolver from error */
  getMfaResolver(error: unknown): MultiFactorResolver | null {
    return getMfaResolverHelper(error);
  }

  /** Verify TOTP code during sign-in */
  async verifyTotpForSignIn(
    resolver: MultiFactorResolver,
    totpCode: string,
    factorIndex: number = 0
  ): Promise<VerifyTwoFactorResult> {
    return verifyTotpForSignInHelper(resolver, totpCode, factorIndex);
  }

  /** Verify backup code during sign-in */
  async verifyBackupCodeForSignIn(
    userId: string,
    backupCode: string
  ): Promise<TwoFactorActionResult> {
    if (!this.db) {
      return { success: false, error: 'Service not initialized' };
    }
    return verifyBackupCode(this.db, userId, backupCode);
  }

  // ===========================================================================
  // UNENROLLMENT
  // ===========================================================================

  /** Disable/unenroll 2FA for a factor */
  async disableTwoFactor(
    factorUid: string,
    currentPassword?: string
  ): Promise<DisableTwoFactorResult> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    try {
      if (currentPassword && currentUser.email) {
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          currentPassword
        );
        await reauthenticateWithCredential(currentUser, credential);
      }

      const mfaUser = multiFactor(currentUser);

      if (factorUid === 'all') {
        for (const factor of mfaUser.enrolledFactors) {
          await mfaUser.unenroll(factor.uid);
        }
      } else {
        await mfaUser.unenroll(factorUid);
      }

      // Clear backup codes if no factors remain
      if (mfaUser.enrolledFactors.length === 0 && this.db) {
        const docRef = doc(this.db, FIRESTORE_COLLECTION, currentUser.uid);
        await updateDoc(docRef, { backupCodes: null });
      }

      logger.info('✅ [2FA] Factor unenrolled successfully');
      return { success: true };
    } catch (error) {
      logger.error('❌ [2FA] Failed to disable 2FA:', error);

      if (error instanceof Error && error.message.includes('user-token-expired')) {
        return { success: false, error: 'Please re-authenticate and try again' };
      }

      return {
        success: false,
        error: getErrorMessage(error, 'Failed to disable 2FA')
      };
    }
  }

  // ===========================================================================
  // BACKUP CODES MANAGEMENT (delegates to helpers)
  // ===========================================================================

  /** Regenerate backup codes (invalidates old ones) */
  async regenerateBackupCodes(): Promise<{ success: boolean; codes?: string[]; error?: string }> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    if (!this.db) {
      return { success: false, error: 'Service not initialized' };
    }

    return regenerateBackupCodesForUser(this.db, currentUser.uid);
  }

  /** Get remaining backup codes count */
  async getBackupCodesRemaining(userId: string): Promise<number> {
    if (!this.db) return 0;
    return getBackupCodesCount(this.db, userId);
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const twoFactorService = EnterpriseTwoFactorService.getInstance();
