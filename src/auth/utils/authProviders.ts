/**
 * =============================================================================
 * AUTH PROVIDERS UTILITY - PROVIDER DETECTION HELPERS
 * =============================================================================
 *
 * Enterprise Pattern: Typed provider detection utilities
 * Uses providerData from Firebase for reliable detection
 *
 * @module auth/utils/authProviders
 * @enterprise ADR-024 - Security Standards
 */

import type { User as FirebaseUser } from 'firebase/auth';

/**
 * Supported authentication provider IDs
 */
export type AuthProviderId =
  | 'password'
  | 'google.com'
  | 'facebook.com'
  | 'twitter.com'
  | 'github.com'
  | 'apple.com'
  | 'microsoft.com'
  | 'yahoo.com';

/**
 * Provider detection result
 */
export interface AuthProviderInfo {
  /** All provider IDs for this user */
  providerIds: string[];
  /** User signed up with email/password */
  isPasswordUser: boolean;
  /** User signed in with OAuth (Google, Facebook, etc.) */
  isOAuthUser: boolean;
  /** User signed in with Google specifically */
  isGoogleUser: boolean;
  /** User has multiple auth methods linked */
  hasMultipleProviders: boolean;
}

/**
 * Get provider information from Firebase user
 *
 * @param firebaseUser - The Firebase User object (from auth.currentUser)
 * @returns Provider detection info with typed properties
 *
 * @example
 * ```tsx
 * import { getAuthProviderInfo } from '@/auth/utils/authProviders';
 *
 * const providerInfo = getAuthProviderInfo(firebaseUser);
 * if (providerInfo.isPasswordUser) {
 *   // Show password reset option
 * }
 * ```
 */
export function getAuthProviderInfo(firebaseUser: FirebaseUser | null): AuthProviderInfo {
  if (!firebaseUser) {
    return {
      providerIds: [],
      isPasswordUser: false,
      isOAuthUser: false,
      isGoogleUser: false,
      hasMultipleProviders: false,
    };
  }

  const providerIds = firebaseUser.providerData?.map((p) => p.providerId) ?? [];

  return {
    providerIds,
    isPasswordUser: providerIds.includes('password'),
    isOAuthUser: providerIds.some((id) => id !== 'password'),
    isGoogleUser: providerIds.includes('google.com'),
    hasMultipleProviders: providerIds.length > 1,
  };
}

/**
 * Check if user can change password
 * Only password provider users can change their password directly
 *
 * @param firebaseUser - The Firebase User object
 * @returns true if user can change password
 */
export function canChangePassword(firebaseUser: FirebaseUser | null): boolean {
  const info = getAuthProviderInfo(firebaseUser);
  return info.isPasswordUser;
}

/**
 * **Πώς αλλάζει το email αυτού του λογαριασμού;** — τρεις δρόμοι, κλειστό σύνολο.
 *
 * | Δρόμος | Ποιος | Τι γίνεται |
 * |---|---|---|
 * | `password` | έχει κωδικό | επαν-πιστοποίηση → σύνδεσμος στη **νέα** διεύθυνση |
 * | `provider-managed` | **μόνο** εξωτερικός πάροχος (Google) | το email το διαχειρίζεται ο πάροχος — **πρώτα κωδικός** |
 * | `needs-password` | **κανένας** πάροχος (πολίτης ADR-844) | **πρώτα κωδικός** |
 *
 * 🏆 **Πρότυπο Figma** *(Help: «Manage email address or password»)*: *«When you sign up
 * via Google SSO, your email address … will be managed by Google»* — και ο δρόμος για
 * να αλλάζει από την εφαρμογή είναι **ορισμός κωδικού**.
 *
 * 🔴 **Γιατί ΟΧΙ αλλαγή σε λογαριασμό μόνο-Google, ούτε «απλώς να δοκιμάσουμε»**:
 * καταγεγραμμένο σφάλμα της Firebase (`firebase-android-sdk#4505`) — το
 * `verifyBeforeUpdateEmail` σε τέτοιο λογαριασμό προσθέτει **δεύτερο** πάροχο
 * `google.com` με την παλιά διεύθυνση, χωρίς τρόπο αποσύνδεσης.
 *
 * ⚠️ **Δεν υπάρχει επαν-πιστοποίηση χωρίς πάροχο**: ο πολίτης που γεννήθηκε από πρώτη
 * επαφή μπήκε με custom token, και η Firebase ζητά *πρόσφατη σύνδεση* για αλλαγή email.
 */
export type EmailChangeRoute = 'password' | 'provider-managed' | 'needs-password';

export function emailChangeRouteOf(providerIds: readonly string[]): EmailChangeRoute {
  if (providerIds.includes('password')) return 'password';
  return providerIds.length > 0 ? 'provider-managed' : 'needs-password';
}

/**
 * Check if user signed in with specific provider
 *
 * @param firebaseUser - The Firebase User object
 * @param providerId - The provider ID to check
 * @returns true if user signed in with this provider
 */
export function hasProvider(
  firebaseUser: FirebaseUser | null,
  providerId: AuthProviderId
): boolean {
  if (!firebaseUser) return false;
  const providerIds = firebaseUser.providerData?.map((p) => p.providerId) ?? [];
  return providerIds.includes(providerId);
}
