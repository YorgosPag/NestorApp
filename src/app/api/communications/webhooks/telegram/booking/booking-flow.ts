/**
 * =============================================================================
 * TELEGRAM BOOKING FLOW — Barrel Re-exports
 * =============================================================================
 *
 * Backward-compatible barrel that re-exports from specialized modules:
 * - booking-session.ts (session management + contact input)
 * - booking-codec.ts (callback encoding + unit resolver)
 * - booking-handlers.ts (date/time/confirm + save appointment)
 * - booking-admin-actions.ts (approve/reject/reschedule)
 *
 * @module api/communications/webhooks/telegram/booking/booking-flow
 */

// Session management
export {
  hasActiveBookingSession,
  handleBookingContactInput,
  handleBookingSharedContact,
} from './booking-session';

// Callback codec
export {
  isBookingCallback,
  encodeBookingCallback,
  decodeBookingCallback,
} from './booking-codec';

// Main booking handlers
export { handleBookingCallback } from './booking-handlers';
