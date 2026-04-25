/**
 * @fileoverview Shared helpers for sales-accounting email notifications (ADR-198)
 * @description HTML builders, formatters, and config used by both
 *              accounting-office and buyer notification modules.
 * @note Server-safe: formatEuro/formatNotificationDate kept local intentionally
 *       (cannot import @/lib/intl-utils → react-i18next → createContext)
 */

import 'server-only';

import { GREEK_VAT_RATES } from '@/subapps/accounting/services/config/vat-config';
import { BRAND, escapeHtml } from '@/services/email-templates';
import { resolveTenantNotificationEmail } from '@/services/org-structure/org-routing-resolver';
import type { ResolveResult } from '@/services/org-structure/org-routing-resolver';
import type { NotificationEventCode } from '@/config/notification-events';
import type { SalesAccountingEvent } from './types';

// ============================================================================
// VAT — derived from centralized vat-config (SSoT)
// ============================================================================

/** Standard Greek VAT rate, derived from GREEK_VAT_RATES (vat-config.ts SSoT) */
const STANDARD_VAT_RATE = GREEK_VAT_RATES.find(r => r.code === 'standard_24')!.rate;
/** Divisor for extracting net amount from gross: grossAmount / VAT_DIVISOR = netAmount */
export const VAT_DIVISOR = 1 + STANDARD_VAT_RATE / 100;

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Base URL της εφαρμογής */
export function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://nestor-app.vercel.app';
}

/**
 * Resolves the accounting email for a tenant notification event via OrgStructure (ADR-326 Phase 3).
 * Returns null when orgStructure is absent or no email resolves — caller skips email (G1, no env fallback).
 */
export async function resolveAccountingEmail(
  companyId: string,
  event: NotificationEventCode,
): Promise<ResolveResult | null> {
  return resolveTenantNotificationEmail(companyId, event);
}

// ============================================================================
// HTML BUILDERS
// ============================================================================

/** Single info row: label + value */
export function htmlInfoRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td width="45%" style="font-size:13px;color:${BRAND.grayLight};vertical-align:top;">${label}</td>
        <td style="font-size:13px;color:${BRAND.navyDark};font-weight:500;">${value}</td>
      </tr>
    </table>`;
}

/** Total / highlighted row */
export function htmlTotalRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;background-color:${BRAND.bgLight};border-radius:4px;">
      <tr>
        <td width="45%" style="padding:8px 12px;font-size:14px;color:${BRAND.navyDark};font-weight:600;">${label}</td>
        <td style="padding:8px 12px;font-size:14px;color:${BRAND.navy};font-weight:700;">${value}</td>
      </tr>
    </table>`;
}

/** Info card — navy header + rows */
export function htmlCard(title: string, rows: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${BRAND.border};border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background-color:${BRAND.navy};padding:10px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.white};letter-spacing:0.5px;">${title}</p>
        </td>
      </tr>
      <tr><td style="padding:16px;">${rows}</td></tr>
    </table>`;
}

/** Property hierarchy rows — shared across all notification types */
export function buildPropertyRows(event: SalesAccountingEvent): string {
  const floorText = event.unitFloor !== null && event.unitFloor !== undefined
    ? ` — ${event.unitFloor}ος όροφος` : '';
  return [
    htmlInfoRow('Μονάδα', `${escapeHtml(event.propertyName)}${floorText}`),
    event.buildingName ? htmlInfoRow('Κτίριο', escapeHtml(event.buildingName)) : '',
    event.projectName ? htmlInfoRow('Έργο', escapeHtml(event.projectName)) : '',
    event.permitTitle ? htmlInfoRow('Τίτλος Αδείας', escapeHtml(event.permitTitle)) : '',
    event.projectAddress ? htmlInfoRow('Διεύθυνση', escapeHtml(event.projectAddress)) : '',
    event.companyName ? htmlInfoRow('Κατασκευαστική', escapeHtml(event.companyName)) : '',
  ].filter(Boolean).join('');
}

/** CTA button — link to invoice/invoices list */
export function htmlButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="background-color:${BRAND.navy};border-radius:6px;padding:12px 24px;">
          <a href="${url}" style="color:${BRAND.white};text-decoration:none;font-size:14px;font-weight:600;">${label}</a>
        </td>
      </tr>
    </table>`;
}

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Server-safe currency formatter — kept local intentionally.
 * Cannot import @/lib/intl-utils (pulls react-i18next → createContext in server-only context).
 * Uses minimumFractionDigits: 2 (financial emails always show cents), unlike formatCurrency(0-2).
 * @see @/lib/intl-utils formatCurrency — client-side equivalent
 */
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('el', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}


function formatNotificationDate(date: Date): string {
  return date.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export { formatNotificationDate as formatDate };

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Τραπεζική κατάθεση',
  cash: 'Μετρητά',
  check: 'Επιταγή',
  credit_card: 'Πιστωτική κάρτα',
  debit_card: 'Χρεωστική κάρτα',
};

export function formatPaymentMethod(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface AccountingNotification {
  subject: string;
  html: string;
  text: string;
}
