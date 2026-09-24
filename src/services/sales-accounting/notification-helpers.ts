/**
 * @fileoverview Shared helpers for sales-accounting email notifications (ADR-198)
 * @description HTML builders, formatters, and config used by both
 *              accounting-office and buyer notification modules.
 * @note Server-safe: ποσό = `lib/number/greek-decimal` · ημερομηνία = `lib/operator-time-format`
 *       (ζώνη του φορέα — ο διακομιστής τρέχει σε UTC, ADR-877 §6). Ποτέ `@/lib/intl-utils`
 *       (react-i18next → createContext).
 */

import 'server-only';

import { publicUrl } from '@/lib/http/public-origin';
import { formatEuro } from '@/lib/number/greek-decimal';
import { formatOperatorDate } from '@/lib/operator-time-format';
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

/**
 * **Ο σύνδεσμος του τιμολογίου στο λογιστήριο** — ή `null` όταν δεν ξέρουμε ποιοι είμαστε.
 *
 * 🔴 **ΔΥΟ ΑΣΤΟΧΙΕΣ ΜΑΖΙ, ΚΑΙ ΟΙ ΔΥΟ ΜΕΤΡΗΜΕΝΕΣ** *(ADR-853 §19 Θ6)*:
 * 1. Εδώ ζούσε `getAppBaseUrl()` με εφεδρεία το **νεκρό** `nestor-app.vercel.app`
 *    *(πάγωμα Vercel, 2026-05-09)*. Χωρίς τη μεταβλητή, το λογιστήριο έπαιρνε email με
 *    σύνδεσμο σε domain που **δεν ελέγχουμε** — και η αποστολή ανέφερε **επιτυχία**.
 * 2. Η συνένωση `` `${appUrl}/accounting/invoices?view=…` `` ήταν γραμμένη **τρεις
 *    φορές, πανομοιότυπα** στο `accounting-office-notify.ts` — ο κλασικός αδελφός
 *    κλώνος του N.18, αόρατος σε κάθε αναζήτηση ονόματος.
 *
 * ⛔ **Το `null` ΕΙΝΑΙ Η ΥΠΗΡΕΣΙΑ**: ο καλών παραλείπει το κουμπί και τη γραμμή
 * «Προβολή». Email χωρίς σύνδεσμο λέει ακόμη τι συνέβη· email με **νεκρό** σύνδεσμο
 * κάνει τον λογιστή να νομίζει ότι κοίταξε.
 */
export function accountingInvoiceUrl(invoiceId?: string): string | null {
  const query = invoiceId ? `?view=${encodeURIComponent(invoiceId)}` : '';
  return publicUrl(`/accounting/invoices${query}`);
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
// Ο ΣΚΕΛΕΤΟΣ ΤΗΣ ΕΙΔΟΠΟΙΗΣΗΣ — **ΕΝΑΣ**, ΟΧΙ ΤΕΣΣΕΡΙΣ (N.0.2 · CHECK 3.28)
// ============================================================================
//
// 🔴 **Το εύρημα (2026-09-22)**: οι τέσσερις κατασκευαστές του `accounting-office-notify`
// έγραφαν **τον ίδιο** σκελετό — τίτλος, γραμμή «Ημερομηνία | παραστατικό», κάρτα ακινήτου,
// κάρτα αγοραστή, και το ίδιο προοίμιο στην εκδοχή κειμένου. Το jscpd τα μέτρησε: **4 κλώνοι**
// μέσα σε **ένα** αρχείο.
//
// ⚠️ **Εδώ, όχι σε νέο αρχείο**: αυτό το module είναι ήδη το SSoT των δομικών στοιχείων του
// ίδιου email (`htmlCard` · `htmlInfoRow` · `buildPropertyRows`). Πέμπτο αρχείο για τη σύνθεσή
// τους θα χώριζε το «τούβλο» από τον «τοίχο» χωρίς λόγο.

/** Το παραστατικό στην κεφαλίδα — `null` όταν η ειδοποίηση δεν αφορά κανένα (π.χ. κράτηση). */
export interface NotificationDocumentRef {
  /** «Τιμολόγιο» · «Πιστωτικό» — **τι** είναι το παραστατικό. */
  readonly label: string;
  /** «A-1234» ή «—». */
  readonly value: string;
}

function metaLine(doc: NotificationDocumentRef | null, separator: string, value: string): string {
  const date = `Ημερομηνία: ${formatOperatorDate(new Date(), 'el')}`;
  return doc === null ? date : `${date}${separator}${doc.label}: ${value}`;
}

/**
 * Η κεφαλίδα της ειδοποίησης σε HTML.
 *
 * ⚠️ Το `titleHtml` περνά **αυτούσιο**: ο καλών ξέρει αν ο τίτλος του περιέχει δεδομένα
 * χρήστη και τα έχει ήδη περάσει από `escapeHtml` (π.χ. η αιτιολογία του πιστωτικού).
 */
export function htmlNotificationHeader(titleHtml: string, doc: NotificationDocumentRef | null): string {
  const meta = metaLine(doc, ' &nbsp;|&nbsp; ', `<strong>${doc?.value ?? ''}</strong>`);
  return `
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.navyDark};">
      <strong>${titleHtml}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.gray};">
      ${meta}
    </p>
  `;
}

/** Οι δύο κάρτες που έχει **κάθε** ειδοποίηση: το ακίνητο και ο αγοραστής. */
export function htmlPartyCards(event: SalesAccountingEvent): string {
  return [
    htmlCard('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ', buildPropertyRows(event)),
    htmlCard('ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ', htmlInfoRow('Αγοραστής', escapeHtml(event.buyerName ?? 'Μη καταχωρημένος'))),
  ].join('\n');
}

/**
 * Το προοίμιο της εκδοχής **κειμένου** — τίτλος, παραστατικό, και ποιος/τι αφορά.
 *
 * ⚠️ **Το «Έργο» μπαίνει παντού όπου υπάρχει**, και αυτό είναι **αλλαγή** για το πιστωτικό:
 * εκεί το κείμενο το παρέλειπε ενώ η **δική του** κάρτα HTML το έδειχνε ήδη (`buildPropertyRows`).
 * Ήταν ασυμφωνία του παραστατικού με τον εαυτό του, όχι απόφαση.
 */
export function textNotificationHeader(
  title: string,
  doc: NotificationDocumentRef | null,
  event: SalesAccountingEvent,
): readonly string[] {
  return [
    title,
    metaLine(doc, '  |  ', doc?.value ?? ''),
    ``,
    `Μονάδα: ${event.propertyName}`,
    ...(event.companyName ? [`Εταιρεία: ${event.companyName}`] : []),
    ...(event.projectName ? [`Έργο: ${event.projectName}`] : []),
    `Αγοραστής: ${event.buyerName ?? 'Μη καταχωρημένος'}`,
  ];
}

/** Τα ποσά μιας προκαταβολής, όπως τα βλέπει το λογιστήριο. */
export interface DepositAmounts {
  readonly net: number;
  readonly vat: number;
  readonly total: number;
  readonly paymentMethod: string;
}

/**
 * Η οικονομική κάρτα της **προκαταβολής** — την έγραφαν πανομοιότυπα το τιμολόγιο
 * προκαταβολής και η ειδοποίηση κράτησης, που **είναι** το ίδιο ποσό ειδωμένο δύο φορές.
 *
 * ⚠️ Η πώληση και το πιστωτικό έχουν **δικές τους** γραμμές (υπόλοιπο · επιστροφή) και
 * επίτηδες **δεν** περνούν από εδώ: κοινή κάρτα για διαφορετικά ποσά θα γινόταν κάρτα με
 * σημαίες.
 */
export function htmlDepositCard(amounts: DepositAmounts): string {
  return htmlCard('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ', [
    htmlInfoRow('Καθαρό ποσό', formatEuro(amounts.net)),
    htmlInfoRow('ΦΠΑ 24%', formatEuro(amounts.vat)),
    htmlTotalRow('Σύνολο (με ΦΠΑ)', formatEuro(amounts.total)),
    htmlInfoRow('Τρόπος πληρωμής', formatPaymentMethod(amounts.paymentMethod)),
  ].join(''));
}

/**
 * Το κουμπί προς το παραστατικό — **τίποτα** όταν δεν έχουμε δημόσια διεύθυνση.
 * @see accountingInvoiceUrl — γιατί η απουσία είναι `null` και όχι σχετικός σύνδεσμος
 */
export function htmlInvoiceLink(label: string, url: string | null): string {
  return url === null ? '' : htmlButton(label, url);
}

/** Η ίδια απουσία στην εκδοχή κειμένου — γραμμή που **δεν μπαίνει**, ποτέ κενή γραμμή. */
export function textInvoiceLink(url: string | null): readonly string[] {
  return url === null ? [] : [`Προβολή: ${url}`];
}

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Server-safe currency formatter — το ΚΑΘΑΡΟ SSoT `lib/number/greek-decimal` (όχι `intl-utils`, που τραβά
 * react-i18next). Πάντα 2 δεκαδικά (τα οικονομικά email δείχνουν λεπτά). ADR-877 §6: ήταν ο 5ος δίδυμος.
 */
export { formatEuro };

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
