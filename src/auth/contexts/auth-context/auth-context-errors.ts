import type { FirebaseAuthUser, SessionIssue, SessionValidationResult, SessionValidationStatus, UserProfileDocument } from '@/auth/types/auth.types';
import type { AuthError } from 'firebase/auth';
import { safeRemoveItem, STORAGE_KEYS } from '@/lib/storage';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AuthContextErrors');

export function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as AuthError).code === 'string'
  );
}

export function getAuthErrorMessage(error: unknown): string {
  if (!isAuthError(error)) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Άγνωστο σφάλμα authentication.';
  }

  const errorMessages: Record<string, string> = {
    'auth/user-not-found': 'Δεν βρέθηκε χρήστης με αυτό το email.',
    'auth/wrong-password': 'Λάθος κωδικός πρόσβασης.',
    'auth/invalid-credential': 'Μη έγκυρα στοιχεία σύνδεσης.',
    'auth/invalid-email': 'Μη έγκυρο email.',
    'auth/user-disabled': 'Αυτός ο λογαριασμός έχει απενεργοποιηθεί.',
    'auth/email-already-in-use': 'Το email χρησιμοποιείται ήδη.',
    'auth/weak-password': 'Ο κωδικός είναι πολύ αδύναμος (τουλάχιστον 6 χαρακτήρες).',
    'auth/network-request-failed': 'Πρόβλημα δικτύου. Δοκιμάστε ξανά.',
    'auth/too-many-requests': 'Πολλές προσπάθειες. Δοκιμάστε αργότερα.',
    'auth/operation-not-allowed': 'Η λειτουργία δεν επιτρέπεται.',
    'auth/requires-recent-login': 'Απαιτείται πρόσφατη σύνδεση. Παρακαλώ συνδεθείτε ξανά.',
    'auth/popup-closed-by-user': 'Η σύνδεση ακυρώθηκε. Το παράθυρο έκλεισε.',
    'auth/popup-blocked': 'Το παράθυρο σύνδεσης αποκλείστηκε. Ενεργοποιήστε τα popups.',
    'auth/cancelled-popup-request': 'Η αίτηση σύνδεσης ακυρώθηκε.',
    'auth/account-exists-with-different-credential': 'Υπάρχει λογαριασμός με αυτό το email αλλά με διαφορετική μέθοδο σύνδεσης.',
    'auth/multi-factor-auth-required': 'Απαιτείται επαλήθευση δύο παραγόντων.',
    'auth/invalid-verification-code': 'Μη έγκυρος κωδικός επαλήθευσης',
  };

  return errorMessages[error.code] || error.message || 'Άγνωστο σφάλμα authentication.';
}

export function validateSession(firebaseUser: import('firebase/auth').User | null): SessionValidationResult {
  const issues: SessionIssue[] = [];
  const timestamp = new Date();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

  if (!firebaseUser) {
    return {
      isValid: true,
      status: 'NO_SESSION',
      issues: [],
      recommendation: 'CONTINUE',
    };
  }

  if (!firebaseUser.uid) {
    issues.push({
      code: 'INVALID_NO_UID',
      message: 'User object exists but has no UID - corrupted state',
      timestamp,
      userAgent,
      recoveryAttempted: false,
    });
    return { isValid: false, status: 'INVALID_NO_UID', issues, recommendation: 'LOGOUT' };
  }

  if (!firebaseUser.email) {
    const status: SessionValidationStatus = firebaseUser.isAnonymous ? 'INVALID_ANONYMOUS' : 'INVALID_NO_EMAIL';
    issues.push({
      code: status,
      message: firebaseUser.isAnonymous
        ? 'Anonymous authentication detected - not supported in this application'
        : 'Authenticated user has no email - session may be corrupted',
      timestamp,
      userAgent,
      recoveryAttempted: false,
    });
    return { isValid: false, status, issues, recommendation: 'LOGOUT' };
  }

  return {
    isValid: true,
    status: 'VALID',
    issues: [],
    recommendation: 'CONTINUE',
  };
}

export function clearCorruptedUserData(uid: string): void {
  logger.info('[AuthContext] Clearing corrupted user data for:', { uid });
  safeRemoveItem(`${STORAGE_KEYS.AUTH_GIVEN_NAME_PREFIX}${uid}`);
  safeRemoveItem(`${STORAGE_KEYS.AUTH_FAMILY_NAME_PREFIX}${uid}`);
  safeRemoveItem(`${STORAGE_KEYS.AUTH_PROFILE_COMPLETE_PREFIX}${uid}`);
  logger.info('[AuthContext] Corrupted data cleared');
}
