/**
 * =============================================================================
 * AUTH ROUTES - CENTRALIZED AUTHENTICATION ROUTE DEFINITIONS
 * =============================================================================
 *
 * Enterprise Pattern: Single source of truth for authentication routes
 * Prevents hardcoded '/login' strings scattered across the codebase
 *
 * @module lib/routes/authRoutes
 * @enterprise ADR-022 - Centralized Route Management
 */

/**
 * Authentication route paths - immutable route definitions
 * Use these constants instead of hardcoded strings
 *
 * @example
 * import { AUTH_ROUTES } from '@/lib/routes';
 * router.push(AUTH_ROUTES.login);
 *
 * @example
 * <Link href={AUTH_ROUTES.login}>Login</Link>
 */
export const AUTH_ROUTES = {
  /** Login page - main authentication entry point */
  login: '/login',
  /** Home page - authenticated user landing */
  home: '/',
} as const;

/** Type for auth route keys */
export type AuthRouteKey = keyof typeof AUTH_ROUTES;

/** Type for auth route values */
export type AuthRoute = (typeof AUTH_ROUTES)[AuthRouteKey];
