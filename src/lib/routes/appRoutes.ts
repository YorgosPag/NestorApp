/**
 * =============================================================================
 * APP ROUTES - CENTRALIZED APPLICATION ROUTE DEFINITIONS
 * =============================================================================
 *
 * Single source of truth for application-level routes
 *
 * @module lib/routes/appRoutes
 */

export const APP_ROUTES = {
  contacts: '/contacts',
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;
export type AppRoute = (typeof APP_ROUTES)[AppRouteKey];
