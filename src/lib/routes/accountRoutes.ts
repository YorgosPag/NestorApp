/**
 * =============================================================================
 * ACCOUNT ROUTES - CENTRALIZED ROUTE DEFINITIONS
 * =============================================================================
 *
 * Enterprise Pattern: Single source of truth for account-related routes
 * Routes ONLY - no navigation config (that belongs in the layout)
 *
 * @module lib/routes/accountRoutes
 * @enterprise ADR-024 - Account Hub Centralization
 */

/**
 * Account route paths - immutable route definitions
 * Use these constants instead of hardcoded strings
 *
 * @example
 * import { ACCOUNT_ROUTES } from '@/lib/routes';
 * router.push(ACCOUNT_ROUTES.profile);
 */
export const ACCOUNT_ROUTES = {
  /** Root account page (redirects to profile) */
  root: '/account',
  /** Personal information management */
  profile: '/account/profile',
  /** UI preferences (language, theme) */
  preferences: '/account/preferences',
  /** Notification settings */
  notifications: '/account/notifications',
  /** Security settings (password, 2FA) */
  security: '/account/security',
  /** Privacy controls */
  privacy: '/account/privacy',
} as const;

/** Type for account route keys */
export type AccountRouteKey = keyof typeof ACCOUNT_ROUTES;

/** Type for account route values */
export type AccountRoute = (typeof ACCOUNT_ROUTES)[AccountRouteKey];
