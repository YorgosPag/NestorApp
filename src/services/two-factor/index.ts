/**
 * 🔐 TWO-FACTOR AUTHENTICATION MODULE
 *
 * Centralized exports for 2FA/MFA functionality
 *
 * @module services/two-factor
 */

// Types
export type {
  TwoFactorMethod,
  TwoFactorStatus,
  VerificationResult,
  TotpSecretInfo,
  EnrolledTotpFactor,
  BackupCode,
  BackupCodesCollection,
  UserTwoFactorState,
  StartEnrollmentResult,
  CompleteEnrollmentResult,
  VerifyTwoFactorInput,
  VerifyTwoFactorResult,
  DisableTwoFactorInput,
  DisableTwoFactorResult,
  TwoFactorActionResult
} from './two-factor.types';

// Service
export {
  EnterpriseTwoFactorService,
  twoFactorService
} from './EnterpriseTwoFactorService';
