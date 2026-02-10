/**
 * =============================================================================
 * ENTERPRISE TWO-FACTOR AUTHENTICATION SERVICE
 * =============================================================================
 *
 * Production-grade 2FA/MFA service using Firebase TOTP MFA
 * Following Google/Microsoft/Okta enterprise security patterns
 *
 * Features:
 * - TOTP enrollment with QR code generation
 * - Backup codes management
 * - Multi-factor sign-in handling
 * - Factor unenrollment
 *
 * @module services/two-factor/EnterpriseTwoFactorService
 * @enterprise ADR-025 - Two-Factor Authentication
 */

import {
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
  MultiFactorResolver,
  MultiFactorError,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, Firestore, serverTimestamp } from 'firebase/firestore';
import QRCode from 'qrcode';
import { auth } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { API_ROUTES } from '@/config/domain-constants';
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

// =============================================================================
// CONSTANTS
// =============================================================================

const BACKUP_CODES_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;
const APP_NAME = 'Nestor Pagonis';
const FIRESTORE_COLLECTION = COLLECTIONS.USER_2FA_SETTINGS;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate cryptographically secure random backup codes
 */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (0,O,1,I)

  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    let code = '';
    const array = new Uint8Array(BACKUP_CODE_LENGTH);
    crypto.getRandomValues(array);

    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += characters[array[j] % characters.length];
    }

    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/**
 * Hash a backup code for secure storage
 */
async function hashBackupCode(code: string): Promise<string> {
  const normalizedCode = code.replace(/-/g, '').toUpperCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Type guard for MultiFactorError
 */
function isMultiFactorError(error: unknown): error is MultiFactorError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'auth/multi-factor-auth-required'
  );
}

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
    console.log('🔐 EnterpriseTwoFactorService created');
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

      const response = await fetch(API_ROUTES.AUTH_MFA_ENROLL_COMPLETE, {
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
      return { success: false, error: error instanceof Error ? error.message : 'Failed to sync MFA' };
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EnterpriseTwoFactorService {
    if (!EnterpriseTwoFactorService.instance) {
      EnterpriseTwoFactorService.instance = new EnterpriseTwoFactorService();
    }
    return EnterpriseTwoFactorService.instance;
  }

  /**
   * Initialize service with Firestore instance
   */
  initialize(firestore: Firestore): void {
    if (this.isInitialized) return;

    this.db = firestore;
    this.isInitialized = true;
    console.log('🔐 EnterpriseTwoFactorService initialized');
  }

  // ===========================================================================
  // USER 2FA STATE
  // ===========================================================================

  /**
   * Get user's 2FA state
   */
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
        console.warn('⚠️ [2FA] Failed to get backup codes info:', error);
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

  /**
   * Start TOTP enrollment - generates secret and QR code
   */
  async startTotpEnrollment(displayName?: string): Promise<StartEnrollmentResult> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    if (!currentUser.email) {
      return { success: false, error: 'User must have verified email for 2FA' };
    }

    try {
      // Get multi-factor session
      const mfaUser = multiFactor(currentUser);
      const session = await mfaUser.getSession();

      // Generate TOTP secret
      const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);

      // Store for later verification
      this.pendingTotpSecret = totpSecret;

      // Generate QR code URI
      const qrCodeUri = totpSecret.generateQrCodeUrl(
        currentUser.email,
        APP_NAME
      );

      // Generate QR code as data URL
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

      console.log('🔐 [2FA] TOTP enrollment started for:', currentUser.email);

      return {
        success: true,
        totpSecret: secretInfo,
        qrCodeDataUrl
      };
    } catch (error) {
      console.error('❌ [2FA] Failed to start enrollment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate TOTP secret'
      };
    }
  }

  /**
   * Complete TOTP enrollment with verification code
   */
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
      // Create assertion with verification code
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        this.pendingTotpSecret,
        verificationCode
      );

      // Enroll the factor
      const mfaUser = multiFactor(currentUser);
      await mfaUser.enroll(assertion, displayName);

      // Generate backup codes
      const backupCodes = generateBackupCodes();

      // Store backup codes in Firestore (hashed)
      if (this.db) {
        await this.storeBackupCodes(currentUser.uid, backupCodes);
      }

      // Clear pending secret
      this.pendingTotpSecret = null;

      // Get enrolled factor info
      const enrolledFactors = mfaUser.enrolledFactors;
      const newFactor = enrolledFactors.find(f =>
        f.factorId === TotpMultiFactorGenerator.FACTOR_ID
      );

      console.log('✅ [2FA] TOTP enrollment completed for:', currentUser.email);

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
      console.error('❌ [2FA] Failed to complete enrollment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify code'
      };
    }
  }

  /**
   * Store hashed backup codes in Firestore
   */
  private async storeBackupCodes(userId: string, codes: string[]): Promise<void> {
    if (!this.db) return;

    const hashedCodes: BackupCode[] = await Promise.all(
      codes.map(async (code, index) => ({
        code: await hashBackupCode(code),
        used: false,
        index: index + 1
      }))
    );

    const backupCodesData: Omit<BackupCodesCollection, 'generatedAt'> & { generatedAt: ReturnType<typeof serverTimestamp> } = {
      codes: hashedCodes,
      generatedAt: serverTimestamp(),
      userId,
      remainingCount: codes.length
    };

    const docRef = doc(this.db, FIRESTORE_COLLECTION, userId);
    await setDoc(docRef, { backupCodes: backupCodesData }, { merge: true });

    console.log('🔐 [2FA] Backup codes stored for user:', userId);
  }

  // ===========================================================================
  // SIGN-IN WITH MFA
  // ===========================================================================

  /**
   * Get MFA resolver from error
   */
  getMfaResolver(error: unknown): MultiFactorResolver | null {
    if (!isMultiFactorError(error)) {
      return null;
    }

    try {
      return getMultiFactorResolver(auth, error);
    } catch {
      console.error('❌ [2FA] Failed to get MFA resolver');
      return null;
    }
  }

  /**
   * Verify TOTP code during sign-in
   */
  async verifyTotpForSignIn(
    resolver: MultiFactorResolver,
    totpCode: string,
    factorIndex: number = 0
  ): Promise<VerifyTwoFactorResult> {
    try {
      const selectedHint = resolver.hints[factorIndex];

      if (!selectedHint || selectedHint.factorId !== TotpMultiFactorGenerator.FACTOR_ID) {
        return { result: 'error', error: 'Invalid factor selected' };
      }

      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        selectedHint.uid,
        totpCode
      );

      const userCredential = await resolver.resolveSignIn(assertion);

      console.log('✅ [2FA] MFA sign-in verified successfully');

      return {
        result: 'success',
        userCredential
      };
    } catch (error) {
      console.error('❌ [2FA] MFA verification failed:', error);

      if (error instanceof Error) {
        if (error.message.includes('invalid') || error.message.includes('incorrect')) {
          return { result: 'invalid_code', error: 'Invalid verification code' };
        }
        if (error.message.includes('expired')) {
          return { result: 'expired', error: 'Code has expired' };
        }
      }

      return {
        result: 'error',
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  /**
   * Verify backup code during sign-in
   */
  async verifyBackupCodeForSignIn(
    userId: string,
    backupCode: string
  ): Promise<TwoFactorActionResult> {
    if (!this.db) {
      return { success: false, error: 'Service not initialized' };
    }

    try {
      const hashedCode = await hashBackupCode(backupCode);
      const docRef = doc(this.db, FIRESTORE_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return { success: false, error: 'No backup codes found' };
      }

      const data = docSnap.data();
      const backupCodesData = data.backupCodes;

      if (!backupCodesData?.codes) {
        return { success: false, error: 'No backup codes found' };
      }

      const codes = backupCodesData.codes as BackupCode[];
      const codeIndex = codes.findIndex(c => c.code === hashedCode && !c.used);

      if (codeIndex === -1) {
        return { success: false, error: 'Invalid or already used backup code' };
      }

      // Mark code as used
      codes[codeIndex].used = true;
      codes[codeIndex].usedAt = new Date();

      await updateDoc(docRef, {
        'backupCodes.codes': codes,
        'backupCodes.remainingCount': codes.filter(c => !c.used).length
      });

      console.log('✅ [2FA] Backup code verified and marked as used');

      return { success: true };
    } catch (error) {
      console.error('❌ [2FA] Backup code verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  // ===========================================================================
  // UNENROLLMENT
  // ===========================================================================

  /**
   * Disable/unenroll 2FA for a factor
   */
  async disableTwoFactor(
    factorUid: string,
    currentPassword?: string
  ): Promise<DisableTwoFactorResult> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    try {
      // May need to reauthenticate
      if (currentPassword && currentUser.email) {
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          currentPassword
        );
        await reauthenticateWithCredential(currentUser, credential);
      }

      const mfaUser = multiFactor(currentUser);

      if (factorUid === 'all') {
        // Unenroll all factors
        for (const factor of mfaUser.enrolledFactors) {
          await mfaUser.unenroll(factor.uid);
        }
      } else {
        // Unenroll specific factor
        await mfaUser.unenroll(factorUid);
      }

      // Clear backup codes if no factors remain
      if (mfaUser.enrolledFactors.length === 0 && this.db) {
        const docRef = doc(this.db, FIRESTORE_COLLECTION, currentUser.uid);
        await updateDoc(docRef, { backupCodes: null });
      }

      console.log('✅ [2FA] Factor unenrolled successfully');

      return { success: true };
    } catch (error) {
      console.error('❌ [2FA] Failed to disable 2FA:', error);

      if (error instanceof Error && error.message.includes('user-token-expired')) {
        return { success: false, error: 'Please re-authenticate and try again' };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable 2FA'
      };
    }
  }

  // ===========================================================================
  // BACKUP CODES MANAGEMENT
  // ===========================================================================

  /**
   * Regenerate backup codes (invalidates old ones)
   */
  async regenerateBackupCodes(): Promise<{ success: boolean; codes?: string[]; error?: string }> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    if (!this.db) {
      return { success: false, error: 'Service not initialized' };
    }

    try {
      const newCodes = generateBackupCodes();
      await this.storeBackupCodes(currentUser.uid, newCodes);

      console.log('✅ [2FA] Backup codes regenerated');

      return { success: true, codes: newCodes };
    } catch (error) {
      console.error('❌ [2FA] Failed to regenerate backup codes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate codes'
      };
    }
  }

  /**
   * Get remaining backup codes count
   */
  async getBackupCodesRemaining(userId: string): Promise<number> {
    if (!this.db) return 0;

    try {
      const docRef = doc(this.db, FIRESTORE_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return 0;

      const data = docSnap.data();
      return data.backupCodes?.remainingCount ?? 0;
    } catch {
      return 0;
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const twoFactorService = EnterpriseTwoFactorService.getInstance();

