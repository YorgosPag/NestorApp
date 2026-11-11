/**
 * @fileoverview **Το email «ο εκδότης απάντησε»** στο «Γράψτε μας» της σελίδας παραστατικού (ADR-939).
 * @module services/email-templates/invoice-portal-reply-email
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3.
 *
 * Τα κείμενα έρχονται από το **ίδιο** locale με τη σελίδα (`accounting-public-payment`), μέσω του
 * `createBundleTranslate`: το email λέει ό,τι θα δει ο πελάτης στη σελίδα, στη γλώσσα του email του παραστατικού.
 *
 * 🔑 **Ο σύνδεσμος ΔΕΝ μπαίνει στο email.** Είναι διαπιστευτήριο (W3C capability URL) και ο διακομιστής κρατά μόνο
 * το hash του. Ο πελάτης τον έχει ήδη στο email του παραστατικού· εδώ μαθαίνει την απάντηση και πού θα συνεχίσει.
 */

import 'server-only';

import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import elPayment from '@/i18n/locales/el/accounting-public-payment.json';
import enPayment from '@/i18n/locales/en/accounting-public-payment.json';
import type { InvoiceEmailLanguage } from '@/subapps/accounting/services/email/invoice-email-template';

import { BRAND, escapeHtml } from './base-email-template';

const NS = 'accounting-public-payment';

const TEXTS: Readonly<Record<InvoiceEmailLanguage, BundleTranslate>> = {
  el: createBundleTranslate({ [NS]: elPayment }, NS, 'el'),
  en: createBundleTranslate({ [NS]: enPayment }, NS, 'en'),
};

export interface InvoicePortalReplyFacts {
  readonly language: InvoiceEmailLanguage;
  /** Η επωνυμία του εκδότη, από το στιγμιότυπο του παραστατικού. */
  readonly issuerName: string;
  /** Σειρά-αριθμός του παραστατικού (π.χ. «Α-10»). */
  readonly reference: string;
  readonly replyText: string;
}

export interface InvoicePortalReplyEmail {
  readonly subject: string;
  readonly textBody: string;
  /** Το περιεχόμενο **μέσα** στο πλαίσιο (`wrapInBrandedTemplate`), όπως το email του παραστατικού. */
  readonly contentHtml: string;
}

/** Το κείμενο της απάντησης σε HTML: διαφυγή χαρακτήρων και αλλαγές γραμμής όπως τις έγραψε ο εκδότης. */
function replyHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

export function buildInvoicePortalReplyEmail(facts: InvoicePortalReplyFacts): InvoicePortalReplyEmail {
  const t = TEXTS[facts.language];
  const params = { issuer: facts.issuerName, reference: facts.reference };
  const intro = t('replyEmail.intro', params);
  const next = t('replyEmail.continue');
  return {
    subject: t('replyEmail.subject', params),
    textBody: `${intro}\n\n${facts.replyText}\n\n${next}`,
    contentHtml: `
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.gray};">${escapeHtml(intro)}</p>
      <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:4px solid ${BRAND.navy};font-size:15px;color:${BRAND.gray};">
        ${replyHtml(facts.replyText)}
      </blockquote>
      <p style="margin:0;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(next)}</p>
    `.trim(),
  };
}
