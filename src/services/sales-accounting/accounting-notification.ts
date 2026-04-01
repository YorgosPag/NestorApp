/**
 * @fileoverview Sales-Accounting Email Notification — Barrel (ADR-198)
 * @description Re-exports all notification functions for backward compatibility.
 *
 * Split into:
 *   - notification-helpers.ts — HTML builders, formatters, config
 *   - accounting-office-notify.ts — Accounting department notifications
 *   - buyer-notify.ts — Buyer confirmation emails
 */

export { notifyAccountingOffice } from './accounting-office-notify';
export { notifyBuyerReservation, notifyBuyerCancellation, notifyBuyerSale } from './buyer-notify';
