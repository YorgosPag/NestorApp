/**
 * @fileoverview **Τα μέρη του τιμολογίου στο PDF** — κεφαλίδα (εκδότης + στοιχεία παραστατικού) και πελάτης.
 * @module subapps/accounting/services/pdf/invoice-pdf-parties
 * @see ADR-ACC-018 §14 · ADR-ACC-003 §22.10
 *
 * ⚖️ ν. 4308/2014 άρθρο 9 §1 περ. ε: «την πλήρη επωνυμία και την πλήρη διεύθυνση του πωλητή και του πελάτη»
 * (Οδηγία 2006/112/ΕΚ άρθρο 226 §5). Η διεύθυνση του πελάτη βγαίνει από τη **μία** μορφή γραμμής διεύθυνσης
 * (`formatContactAddressLine`) — πόλη και Τ.Κ. **δεν χάνονται** όταν λείπει η οδός.
 *
 * 🔑 **Προϋπολογισμός στηλών, όχι σταθερά ύψη.** Ως 2026-11-10 η κεφαλίδα έγραφε τον εκδότη χωρίς όριο πλάτους
 * και τη δεξιά στήλη σε καρφωτά y — η «Δραστηριότητα» (y+22) έπεφτε πάνω στην «Ημ/νία Έκδοσης» (y+23) σε
 * **κάθε** τιμολόγιο. Τώρα: η δεξιά στήλη **μετριέται πρώτα**, η αριστερή παίρνει ό,τι περισσεύει και
 * αναδιπλώνεται· το πλαίσιο του πελάτη **μετριέται πριν σχεδιαστεί**.
 */

import type jsPDF from 'jspdf';
import { formatAccountingDate } from '../../utils/format';
import type { Invoice, InvoiceCustomer } from '../../types';
import { formatContactAddressLine } from '@/utils/address/address-line';
import { isGreekAddressCountry } from '@/utils/address/country-codes';
import { countryLabelIn } from '@/utils/address/country-label-text';
import { drawPdfLogo } from './pdf-logo';
import {
  COLORS, LAYOUT, LOGO, LABELS, INVOICE_TITLES,
  ensureSpace, drawHR, setColor, drawWrappedLines, type RGB,
} from './invoice-pdf-constants';

/** Απόσταση ανάμεσα στις δύο στήλες της κεφαλίδας (mm). */
const COLUMN_GAP = 6;
/** Βήμα γραμμής για κείμενο 8pt (mm). */
const LINE_STEP = 4;
/** Ελάχιστο πλάτος για τα στοιχεία του εκδότη — ακόμη και με τον φαρδύτερο τίτλο παραστατικού. */
const MIN_ISSUER_WIDTH = 60;
/** Το πλαίσιο του πελάτη: απόσταση πρώτης γραμμής από την κορυφή · ελάχιστο ύψος (το ύψος του πριν το 2026-11-10). */
const CUSTOMER_BOX = { firstBaseline: 5, bottomPadding: 4, minHeight: 22, rightColumnOffset: 100, inset: 3 } as const;

/** Μία γραμμή της δεξιάς στήλης: κείμενο, μέγεθος, χρώμα και πόσο κατεβαίνει από την προηγούμενη. */
interface RightLine {
  readonly text: string;
  readonly fontSize: number;
  readonly color: RGB;
  readonly advance: number;
}

function rightBlockLines(invoice: Invoice): RightLine[] {
  const title = INVOICE_TITLES[invoice.type];
  const lines: RightLine[] = [
    { text: title.el, fontSize: 12, color: COLORS.navy, advance: 5 },
    { text: title.en, fontSize: 8, color: COLORS.grayLight, advance: 5 },
    { text: `${invoice.series}-${invoice.number}`, fontSize: 10, color: COLORS.navy, advance: 7 },
    { text: `${LABELS.invoiceDate}: ${formatAccountingDate(invoice.issueDate)}`, fontSize: 8, color: COLORS.gray, advance: 6 },
  ];
  if (invoice.dueDate) {
    lines.push({ text: `${LABELS.dueDate}: ${formatAccountingDate(invoice.dueDate)}`, fontSize: 8, color: COLORS.gray, advance: 4 });
  }
  return lines;
}

/** Το πλάτος της φαρδύτερης γραμμής της δεξιάς στήλης, στο μέγεθος της καθεμιάς. */
function widestLine(pdf: jsPDF, lines: readonly RightLine[]): number {
  return lines.reduce((widest, line) => {
    pdf.setFontSize(line.fontSize);
    return Math.max(widest, pdf.getTextWidth(line.text));
  }, 0);
}

/** Σχεδιάζει τη δεξιά στήλη· επιστρέφει το y της επόμενης γραμμής. */
function drawRightBlock(pdf: jsPDF, lines: readonly RightLine[], x: number, startY: number): number {
  let y = startY;
  for (const line of lines) {
    y += line.advance;
    pdf.setFontSize(line.fontSize);
    setColor(pdf, line.color);
    pdf.text(line.text, x, y, { align: 'right' });
  }
  return y + LINE_STEP;
}

function issuerDetailText(invoice: Invoice): string {
  const { issuer } = invoice;
  const contact = [
    issuer.phone ? `${LABELS.phone}: ${issuer.phone}` : null,
    issuer.mobile ? `${LABELS.mobile}: ${issuer.mobile}` : null,
    issuer.email ? `${LABELS.email}: ${issuer.email}` : null,
  ].filter((part): part is string => part !== null);
  return [
    `${LABELS.vatNumber}: ${issuer.vatNumber}`,
    `${LABELS.taxOffice}: ${issuer.taxOffice}`,
    `${issuer.address}, ${issuer.city} ${issuer.postalCode}`,
    `${LABELS.profession}: ${issuer.profession}`,
    ...(contact.length > 0 ? [contact.join('  |  ')] : []),
  ].join('\n');
}

/** Σχεδιάζει τον εκδότη μέσα στο πλάτος του· επιστρέφει το y της επόμενης γραμμής. */
function drawIssuerBlock(pdf: jsPDF, invoice: Invoice, x: number, startY: number, maxWidth: number): number {
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(11);
  const afterName = drawWrappedLines(pdf, invoice.issuer.name, startY + 5, { x, maxWidth, lineStep: 5 });
  pdf.setFontSize(8);
  setColor(pdf, COLORS.gray);
  return drawWrappedLines(pdf, issuerDetailText(invoice), afterName, { x, maxWidth, lineStep: LINE_STEP });
}

function drawLogo(pdf: jsPDF, logoBase64: string | null, y: number): number {
  if (!logoBase64) return LAYOUT.marginLeft;
  try {
    drawPdfLogo(pdf, logoBase64, { x: LAYOUT.marginLeft, y, width: LOGO.width, height: LOGO.height });
    return LAYOUT.marginLeft + LOGO.width + 4;
  } catch {
    return LAYOUT.marginLeft; // Το λογότυπο απέτυχε — συνεχίζουμε χωρίς αυτό.
  }
}

/**
 * §1: Κεφαλίδα — λογότυπο · εκδότης (αριστερά, αναδιπλωμένος) · τίτλος/αριθμός/ημερομηνίες (δεξιά).
 */
export function drawHeader(pdf: jsPDF, invoice: Invoice, logoBase64: string | null, startY: number): number {
  const rightEdge = LAYOUT.pageWidth - LAYOUT.marginRight;
  const issuerX = drawLogo(pdf, logoBase64, startY);
  const right = rightBlockLines(invoice);
  const issuerWidth = Math.max(MIN_ISSUER_WIDTH, rightEdge - widestLine(pdf, right) - COLUMN_GAP - issuerX);

  const issuerEnd = drawIssuerBlock(pdf, invoice, issuerX, startY, issuerWidth);
  const rightEnd = drawRightBlock(pdf, right, rightEdge, startY);

  const y = Math.max(issuerEnd, rightEnd, startY + 30) + 3;
  return drawHR(pdf, y);
}

// ============================================================================
// §2: ΠΕΛΑΤΗΣ
// ============================================================================

/** Η αριστερή στήλη: επωνυμία · πλήρης διεύθυνση · email. */
function customerLeftText(customer: InvoiceCustomer): string {
  const address = formatContactAddressLine({
    street: customer.address ?? undefined,
    city: customer.city ?? undefined,
    postalCode: customer.postalCode ?? undefined,
    country: customer.country,
  });
  return [customer.name, address, customer.email ? `${LABELS.email}: ${customer.email}` : '']
    .filter(Boolean)
    .join('\n');
}

/** Η χώρα, δίγλωσση όπως κάθε ετικέτα του εγγράφου· ελληνικός πελάτης ⇒ καμία γραμμή. */
function customerCountryText(country: string): string {
  if (isGreekAddressCountry(country)) return '';
  const el = countryLabelIn(country, 'el');
  const en = countryLabelIn(country, 'en');
  return `${LABELS.country}: ${el === en ? el : `${el} / ${en}`}`;
}

/** Η δεξιά στήλη: ΑΦΜ · ΔΟΥ · χώρα. */
function customerRightText(customer: InvoiceCustomer): string {
  return [
    customer.vatNumber ? `${LABELS.vatNumber}: ${customer.vatNumber}` : '',
    customer.taxOffice ? `${LABELS.taxOffice}: ${customer.taxOffice}` : '',
    customerCountryText(customer.country),
  ].filter(Boolean).join('\n');
}

/**
 * §2: Πελάτης — δύο στήλες, αναδιπλωμένες· το πλαίσιο **μετριέται πριν σχεδιαστεί**.
 */
export function drawCustomerSection(pdf: jsPDF, invoice: Invoice, startY: number): number {
  const left = { text: customerLeftText(invoice.customer), x: LAYOUT.marginLeft + CUSTOMER_BOX.inset };
  const right = { text: customerRightText(invoice.customer), x: LAYOUT.marginLeft + CUSTOMER_BOX.rightColumnOffset };
  const leftWidth = right.x - left.x - CUSTOMER_BOX.inset;
  const rightWidth = LAYOUT.marginLeft + LAYOUT.contentWidth - CUSTOMER_BOX.inset - right.x;

  pdf.setFontSize(8);
  const lineCount = Math.max(
    (pdf.splitTextToSize(left.text, leftWidth) as string[]).length,
    (pdf.splitTextToSize(right.text, rightWidth) as string[]).length,
  );
  const boxHeight = Math.max(
    CUSTOMER_BOX.minHeight,
    CUSTOMER_BOX.firstBaseline + (lineCount - 1) * LINE_STEP + CUSTOMER_BOX.bottomPadding,
  );

  const y = ensureSpace(pdf, startY, boxHeight + 10);
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(9);
  pdf.text(LABELS.customer, LAYOUT.marginLeft, y + 4);

  pdf.setDrawColor(COLORS.grayBorder[0], COLORS.grayBorder[1], COLORS.grayBorder[2]);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(LAYOUT.marginLeft, y + 6, LAYOUT.contentWidth, boxHeight, 1, 1);

  setColor(pdf, COLORS.gray);
  pdf.setFontSize(8);
  const firstBaseline = y + 6 + CUSTOMER_BOX.firstBaseline;
  drawWrappedLines(pdf, left.text, firstBaseline, { x: left.x, maxWidth: leftWidth, lineStep: LINE_STEP });
  drawWrappedLines(pdf, right.text, firstBaseline, { x: right.x, maxWidth: rightWidth, lineStep: LINE_STEP });

  return y + 6 + boxHeight + 4;
}
