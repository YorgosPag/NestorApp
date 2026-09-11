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
  /**
   * Τα εισερχόμενα email του γραφείου (AI Inbox) — **εκτός** χώρου (`admin`, ADR-787
   * §5.3 γ). Προορισμός της ειδοποίησης νέου email (`email-inbound-service`).
   */
  aiInbox: '/admin/ai-inbox',
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;
export type AppRoute = (typeof APP_ROUTES)[AppRouteKey];
