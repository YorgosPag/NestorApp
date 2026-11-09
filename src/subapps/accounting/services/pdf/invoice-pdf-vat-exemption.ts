/**
 * @fileoverview **Η παραπομπή απαλλαγής ΦΠΑ στο τιμολόγιο** (ADR-ACC-003 §22 · ADR-ACC-018).
 * @module subapps/accounting/services/pdf/invoice-pdf-vat-exemption
 *
 * ⚖️ ν. 4308/2014 άρθρο 9: όταν δεν χρεώνεται ΦΠΑ, το τιμολόγιο **παραπέμπει στη διάταξη** που προβλέπει την
 * απαλλαγή. Μία γραμμή ανά αιτία, με τις γραμμές του τιμολογίου που καλύπτει:
 *   «Γραμμές 2, 3: Χωρίς ΦΠΑ - άρθρο 44 του Κώδικα ΦΠΑ (ν. 5144/2024)»
 *
 * 🔑 Το κείμενο βγαίνει από την **ΙΔΙΑ** συνάρτηση με τη φόρμα (`vatExemptionCitation`) και το **ΙΔΙΟ** locale
 * (`accounting-vat-exemptions`), μέσω `createBundleTranslate` στη γλώσσα του **εγγράφου** — το PDF φτιάχνεται
 * και στον διακομιστή (αποστολή email), όπου δεν υπάρχει i18next.
 * 🔑 Γραμμή 0% **χωρίς** αιτία δεν παράγει παραπομπή (δεν υπάρχει τι να γραφτεί)· ο έλεγχος πριν τη διαβίβαση
 * (`VAT_EXEMPTION_MISSING`) και το μήνυμα της φόρμας την εμποδίζουν να γίνει οριστική.
 */

import type jsPDF from 'jspdf';
import elVatExemptions from '@/i18n/locales/el/accounting-vat-exemptions.json';
import enVatExemptions from '@/i18n/locales/en/accounting-vat-exemptions.json';
import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import type { HumanLanguage } from '@/i18n/languages';
import type { Invoice, InvoiceLineItem } from '../../types';
import {
  VAT_EXEMPTION_NAMESPACE,
  isVatExemptionCode,
  vatExemptionCitation,
  type VatExemptionCode,
} from '../config/vat-exemption-reasons';
import { requiresVatExemption } from '../mydata/mydata-codes';
import { COLORS, INVOICE_DOCUMENT_LANGUAGE, LAYOUT, ensureSpace, setColor } from './invoice-pdf-constants';

const TRANSLATORS: Readonly<Record<HumanLanguage, BundleTranslate>> = {
  el: createBundleTranslate({ [VAT_EXEMPTION_NAMESPACE]: elVatExemptions }, VAT_EXEMPTION_NAMESPACE, 'el'),
  en: createBundleTranslate({ [VAT_EXEMPTION_NAMESPACE]: enVatExemptions }, VAT_EXEMPTION_NAMESPACE, 'en'),
};

/** Μία αιτία και οι γραμμές του τιμολογίου που καλύπτει (με τη σειρά πρώτης εμφάνισης). */
export interface VatExemptionLineGroup {
  readonly code: VatExemptionCode;
  readonly lineNumbers: readonly number[];
}

/** Ομαδοποίηση γραμμών «Άνευ ΦΠΑ» με έγκυρη αιτία, ανά αιτία. Καθαρή συνάρτηση. */
export function groupVatExemptionLines(lines: readonly InvoiceLineItem[]): VatExemptionLineGroup[] {
  const byCode = new Map<VatExemptionCode, number[]>();
  for (const line of lines) {
    const code = line.vatExemptionCategory;
    if (!requiresVatExemption(line.vatRate) || !isVatExemptionCode(code)) continue;
    const numbers = byCode.get(code) ?? [];
    numbers.push(line.lineNumber);
    byCode.set(code, numbers);
  }
  return [...byCode].map(([code, lineNumbers]) => ({ code, lineNumbers }));
}

/** Τα κείμενα της ενότητας (επικεφαλίδα + μία γραμμή ανά αιτία) — `null` όταν δεν υπάρχει απαλλαγή. */
export function vatExemptionNoteTexts(
  invoice: Pick<Invoice, 'lineItems' | 'issueDate'>,
  language: HumanLanguage = INVOICE_DOCUMENT_LANGUAGE,
): { heading: string; lines: string[] } | null {
  const groups = groupVatExemptionLines(invoice.lineItems);
  if (groups.length === 0) return null;
  const t = TRANSLATORS[language];
  const lines = groups.map(({ code, lineNumbers }) => {
    const { provision, law } = vatExemptionCitation(t, code, invoice.issueDate);
    return t('pdf.line', { lines: lineNumbers.length, numbers: lineNumbers.join(', '), provision, law });
  });
  return { heading: t('pdf.heading'), lines };
}

/** Σχεδιάζει την ενότητα κάτω από τα σύνολα· χωρίς απαλλαγή δεν σχεδιάζει τίποτα. */
export function drawVatExemptionSection(pdf: jsPDF, invoice: Invoice, startY: number): number {
  const texts = vatExemptionNoteTexts(invoice);
  if (texts === null) return startY;

  const wrapped: string[] = texts.lines.flatMap((text) => pdf.splitTextToSize(text, LAYOUT.contentWidth - 5));
  const y = ensureSpace(pdf, startY, 9 + wrapped.length * 3.5);

  setColor(pdf, COLORS.navy);
  pdf.setFontSize(8);
  pdf.text(texts.heading, LAYOUT.marginLeft, y + 4);

  setColor(pdf, COLORS.gray);
  pdf.setFontSize(7.5);
  pdf.text(wrapped, LAYOUT.marginLeft + 2, y + 9);

  return y + 9 + wrapped.length * 3.5;
}
