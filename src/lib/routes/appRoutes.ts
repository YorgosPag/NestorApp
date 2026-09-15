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
  /**
   * **Το προφίλ της εταιρείας** — το **μοναδικό** σημείο όπου γράφονται αριθμός ΓΕΜΗ και επωνυμία (ADR-439).
   * Εκεί στέλνουν η δήλωση μεσιτείας και τα «Στοιχεία ΓΕΜΗ» της βιτρίνας (ADR-841 §7 Α23.9 Φέτα Β) — ήταν
   * γραμμένο με το χέρι σε δύο σημεία (N.0.2). Χωρίς πρόθεμα χώρου: το βάζει ο `Link` του συνόρου (CHECK 3.61).
   */
  accountingSetup: '/accounting/setup',
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;
export type AppRoute = (typeof APP_ROUTES)[AppRouteKey];
