/**
 * @fileoverview Email Templates — Barrel exports
 * @description Κεντρικοποιημένο email template system με εταιρική ταυτότητα Pagonis Energo
 */

export { wrapInBrandedTemplate, BRAND, escapeHtml, formatEuro, formatDateGreek, formatPaymentMethod } from './base-email-template';
export { buildReservationConfirmationEmail } from './reservation-confirmation';
export type { ReservationEmailData } from './reservation-confirmation';
