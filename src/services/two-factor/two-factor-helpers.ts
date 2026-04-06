/**
 * =============================================================================
 * TWO-FACTOR AUTHENTICATION — HELPERS
 * =============================================================================
 *
 * Extracted from EnterpriseTwoFactorService.ts (ADR-065 Phase 5)
 * Backup code management and MFA sign-in resolution helpers
 *
 * @module services/two-factor/two-factor-helpers
 * @enterprise ADR-025 - Two-Factor Authentication
 */

import {
  TotpMultiFactorGenerator,
  getMultiFactorResolver,
  MultiFactorResolver,
  MultiFactorError,
} from 'firebase/auth';
import { doc, setDoc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { UserCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  BackupCode,
  BackupCodesCollection,
  TwoFactorActionResult,
  VerifyTwoFactorResult,
} from './two-factor.types';

const logger = createModuleLogger('TwoFactorHelpers');

const BACKUP_CODES_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;
const FIRESTORE_COLLECTION = COLLECTIONS.USER_2FA_SETTINGS;

// =============================================================================
// BACKUP CODE GENERATION
// =============================================================================

/** Generate cryptographically secure random backup codes */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (0,O,1,I)

  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    let code = '';
    const array = new Uint8Array(BACKUP_CODE_LENGTH);
    crypto.getRandomValues(array);

    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += characters[array[j] % characters.length];
    }

    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/** Hash a backup code for secure storage */
export async function hashBackupCode(code: string): Promise<string> {
  const normalizedCode = code.replace(/-/g, '').toUpperCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// =============================================================================
// BACKUP CODE STORAGE
// =============================================================================

/** Store hashed backup codes in Firestore */
export async function storeBackupCodes(db: Firestore, userId: string, codes: string[]): Promise<void> {
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

  const docRef = doc(db, FIRESTORE_COLLECTION, userId);
  await setDoc(docRef, { backupCodes: backupCodesData }, { merge: true });

  logger.info('🔐 [2FA] Backup codes stored for user:', userId);
}

/** Verify backup code during sign-in (uses Firestore transaction) */
export async function verifyBackupCode(
  db: Firestore,
  userId: string,
  backupCode: string
): Promise<TwoFactorActionResult> {
  try {
    const hashedCode = await hashBackupCode(backupCode);
    const docRef = doc(db, FIRESTORE_COLLECTION, userId);

    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);

      if (!docSnap.exists()) {
        throw new Error('No backup codes found');
      }

      const data = docSnap.data();
      const backupCodesData = data.backupCodes;

      if (!backupCodesData?.codes) {
        throw new Error('No backup codes found');
      }

      const codes = backupCodesData.codes as BackupCode[];
      const codeIndex = codes.findIndex(c => c.code === hashedCode && !c.used);

      if (codeIndex === -1) {
        throw new Error('Invalid or already used backup code');
      }

      codes[codeIndex].used = true;
      codes[codeIndex].usedAt = new Date();

      transaction.update(docRef, {
        'backupCodes.codes': codes,
        'backupCodes.remainingCount': codes.filter(c => !c.used).length
      });
    });

    logger.info('✅ [2FA] Backup code verified and marked as used');
    return { success: true };
  } catch (error) {
    logger.error('❌ [2FA] Backup code verification failed:', error);
    return {
      success: false,
      error: getErrorMessage(error, 'Verification failed')
    };
  }
}

/** Regenerate backup codes (invalidates old ones) */
export async function regenerateBackupCodesForUser(
  db: Firestore,
  userId: string
): Promise<{ success: boolean; codes?: string[]; error?: string }> {
  try {
    const newCodes = generateBackupCodes();
    await storeBackupCodes(db, userId, newCodes);

    logger.info('✅ [2FA] Backup codes regenerated');
    return { success: true, codes: newCodes };
  } catch (error) {
    logger.error('❌ [2FA] Failed to regenerate backup codes:', error);
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to regenerate codes')
    };
  }
}

/** Get remaining backup codes count */
export async function getBackupCodesRemaining(db: Firestore, userId: string): Promise<number> {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return 0;

    const data = docSnap.data();
    return data.backupCodes?.remainingCount ?? 0;
  } catch {
    return 0;
  }
}

// =============================================================================
// MFA SIGN-IN HELPERS
// =============================================================================

/** Type guard for MultiFactorError */
export function isMultiFactorError(error: unknown): error is MultiFactorError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'auth/multi-factor-auth-required'
  );
}

/** Get MFA resolver from error */
export function getMfaResolver(error: unknown): MultiFactorResolver | null {
  if (!isMultiFactorError(error)) {
    return null;
  }

  try {
    return getMultiFactorResolver(auth, error);
  } catch {
    logger.error('❌ [2FA] Failed to get MFA resolver');
    return null;
  }
}

/** Verify TOTP code during sign-in */
export async function verifyTotpForSignIn(
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

    const userCredential: UserCredential = await resolver.resolveSignIn(assertion);

    logger.info('✅ [2FA] MFA sign-in verified successfully');

    return { result: 'success', userCredential };
  } catch (error) {
    logger.error('❌ [2FA] MFA verification failed:', error);

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
      error: getErrorMessage(error, 'Verification failed')
    };
  }
}
