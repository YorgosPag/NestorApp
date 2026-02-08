/**
 * =============================================================================
 * TWO-FACTOR AUTHENTICATION TYPES
 * =============================================================================
 *
 * Enterprise TypeScript interfaces for 2FA/MFA functionality
 * Following Google/Microsoft/Okta security patterns
 *
 * @module services/two-factor/types
 * @enterprise ADR-025 - Two-Factor Authentication
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

/**
 * Supported 2FA methods
 */
export type TwoFactorMethod = 'totp' | 'sms' | 'email' | 'backup_code';

/**
 * 2FA enrollment status
 */
export type TwoFactorStatus = 'not_enrolled' | 'pending' | 'enrolled' | 'disabled';

/**
 * 2FA verification result
 */
export type VerificationResult = 'success' | 'invalid_code' | 'expired' | 'rate_limited' | 'error';

// =============================================================================
// TOTP INTERFACES
// =============================================================================

/**
 * TOTP secret information for enrollment
 */
export interface TotpSecretInfo {
  /** Base32 encoded secret key */
  secretKey: string;
  /** QR code URI for authenticator apps */
  qrCodeUri: string;
  /** Account name (usually email) */
  accountName: string;
  /** Issuer name (app name) */
  issuer: string;
  /** Algorithm used (SHA1, SHA256, SHA512) */
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  /** Number of digits in OTP */
  digits: 6 | 8;
  /** Time period in seconds */
  period: number;
}

/**
 * Enrolled TOTP factor information
 */
export interface EnrolledTotpFactor {
  /** Factor ID from Firebase */
  uid: string;
  /** Display name for this factor */
  displayName: string;
  /** Factor ID type */
  factorId: string;
  /** Enrollment timestamp */
  enrolledAt: Date;
}

// =============================================================================
// BACKUP CODES INTERFACES
// =============================================================================

/**
 * Backup code structure
 */
export interface BackupCode {
  /** The backup code (8 characters) */
  code: string;
  /** Whether this code has been used */
  used: boolean;
  /** When the code was used (if applicable) */
  usedAt?: Date;
  /** Index position (1-10) */
  index: number;
}

/**
 * Backup codes collection
 */
export interface BackupCodesCollection {
  /** Array of backup codes */
  codes: BackupCode[];
  /** When the codes were generated */
  generatedAt: Date;
  /** User ID these codes belong to */
  userId: string;
  /** Number of remaining unused codes */
  remainingCount: number;
}

// =============================================================================
// USER 2FA STATE
// =============================================================================

/**
 * User's 2FA configuration state
 */
export interface UserTwoFactorState {
  /** User ID */
  userId: string;
  /** Current enrollment status */
  status: TwoFactorStatus;
  /** Enabled 2FA methods */
  enabledMethods: TwoFactorMethod[];
  /** Primary 2FA method */
  primaryMethod?: TwoFactorMethod;
  /** Enrolled TOTP factors */
  totpFactors: EnrolledTotpFactor[];
  /** Has backup codes */
  hasBackupCodes: boolean;
  /** Remaining backup codes count */
  backupCodesRemaining: number;
  /** Last 2FA verification timestamp */
  lastVerifiedAt?: Date;
  /** 2FA enrollment timestamp */
  enrolledAt?: Date;
  /** 2FA updated timestamp */
  updatedAt?: Date;
}

// =============================================================================
// ENROLLMENT INTERFACES
// =============================================================================

/**
 * Input for starting 2FA enrollment
 */
export interface StartEnrollmentInput {
  /** User ID */
  userId: string;
  /** Method to enroll */
  method: TwoFactorMethod;
  /** Display name for the factor */
  displayName?: string;
}

/**
 * Result of starting enrollment
 */
export interface StartEnrollmentResult {
  /** Whether enrollment started successfully */
  success: boolean;
  /** TOTP secret info (if TOTP method) */
  totpSecret?: TotpSecretInfo;
  /** QR code data URL (base64 PNG) */
  qrCodeDataUrl?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Input for completing 2FA enrollment
 */
export interface CompleteEnrollmentInput {
  /** User ID */
  userId: string;
  /** Verification code from authenticator */
  verificationCode: string;
  /** Display name for the factor */
  displayName?: string;
}

/**
 * Result of completing enrollment
 */
export interface CompleteEnrollmentResult {
  /** Whether enrollment completed successfully */
  success: boolean;
  /** Generated backup codes */
  backupCodes?: string[];
  /** Enrolled factor info */
  enrolledFactor?: EnrolledTotpFactor;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// VERIFICATION INTERFACES
// =============================================================================

/**
 * Input for 2FA verification
 */
export interface VerifyTwoFactorInput {
  /** Verification code (TOTP or backup code) */
  code: string;
  /** Factor UID to verify against */
  factorUid?: string;
  /** Whether this is a backup code */
  isBackupCode?: boolean;
}

/**
 * Result of 2FA verification
 */
export interface VerifyTwoFactorResult {
  /** Verification result */
  result: VerificationResult;
  /** User credential (if successful) */
  userCredential?: unknown; // Firebase UserCredential type
  /** Error message if failed */
  error?: string;
  /** Remaining attempts (if rate limited) */
  remainingAttempts?: number;
}

// =============================================================================
// UNENROLLMENT INTERFACES
// =============================================================================

/**
 * Input for disabling 2FA
 */
export interface DisableTwoFactorInput {
  /** User ID */
  userId: string;
  /** Factor UID to disable (or 'all' for all factors) */
  factorUid: string | 'all';
  /** Current password for re-authentication */
  currentPassword?: string;
}

/**
 * Result of disabling 2FA
 */
export interface DisableTwoFactorResult {
  /** Whether 2FA was disabled successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// SERVICE RESULT INTERFACES
// =============================================================================

/**
 * Generic service action result
 */
export interface TwoFactorActionResult {
  /** Whether the action succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Additional data */
  data?: Record<string, unknown>;
}
