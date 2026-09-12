/**
 * @fileoverview **ΤΟ ΣΧΗΜΑ ΕΝΟΣ ΜΗΝΥΜΑΤΟΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ** — τίτλος, κείμενο, κουμπί, υποσημείωση (ADR-851).
 * @module services/email-templates/app-message-email
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3.
 *
 * Κοινό σε **όσα email στέλνει η ίδια η πλατφόρμα** (όχι μια εταιρεία-μισθωτής): email
 * λογαριασμού (`auth-action-email.ts`) και απόφαση αιτήματος ένταξης (ADR-660 §6). Εξήχθη
 * **πριν** γραφτεί το δεύτερο — αλλιώς θα γεννιόταν δίδυμο του ίδιου πλαισίου (N.18).
 */

import 'server-only';

import { PRODUCT_NAME } from '@/constants/product-identity';
import type { HumanLanguage } from '@/i18n/languages';
import { publicUrl } from '@/lib/http/public-origin';

import type { AppMessageWording } from './app-message-wording';
import { BRAND, NESTOR_APP_LOGO_PATH, escapeHtml, wrapInBrandedTemplate } from './base-email-template';
import { renderShareCta } from './showcase-email-shared';

/** Ένα τμήμα μηνύματος σε **μία** γλώσσα. `lang` δηλώνεται μόνο όταν διαφέρει από του εγγράφου. */
export function renderMessageSection(
  wording: AppMessageWording,
  addressHtml: string,
  link: string,
  lang: HumanLanguage | null,
): string {
  const langAttr = lang === null ? '' : ` lang="${lang}"`;
  return `<div${langAttr} style="margin:0 0 24px;">
    <h2 style="margin:0 0 12px;font-size:20px;color:${BRAND.navyDark};">${escapeHtml(wording.heading)}</h2>
    <p style="margin:0 0 8px;font-size:15px;color:${BRAND.gray};line-height:1.6;">${wording.intro(addressHtml)}</p>
    ${renderShareCta(link, wording.cta)}
    <p style="margin:16px 0 0;font-size:13px;color:${BRAND.grayLight};line-height:1.6;">${escapeHtml(wording.footnote)}</p>
  </div>`;
}

/** Το πλαίσιο της **εφαρμογής** — ίδιο με κάθε email μας, με το λογότυπο της εφαρμογής. */
export function wrapInAppFrame(contentHtml: string, language: HumanLanguage): string {
  return wrapInBrandedTemplate({
    contentHtml,
    // ADR-857 — το όνομα του **προϊόντος**, από τη ρίζα. Ήταν πεδίο `brand` ανά γλώσσα, δηλαδή
    // δομή που επέτρεπε απόκλιση· και είχε ήδη αποκλίνει (`ΝΕΣΤΩΡ` / `Nestor` / `Nestor App`).
    companyName: PRODUCT_NAME,
    companyLogoUrl: publicUrl(NESTOR_APP_LOGO_PATH) ?? undefined,
    lang: language,
  });
}

/**
 * Το απλό κείμενο ενός μηνύματος — ίδια σειρά με το HTML.
 *
 * ⚠️ **ADR-857 — η παράμετρος `language` ΑΦΑΙΡΕΘΗΚΕ**: το μόνο που τη χρειαζόταν ήταν η
 * υπογραφή, και το όνομα του προϊόντος **δεν εξαρτάται από γλώσσα**. Μια παράμετρος που δεν
 * χρησιμοποιείται **υπόσχεται** εξάρτηση που δεν υπάρχει — τα λόγια έρχονται ήδη έτοιμα,
 * στη γλώσσα του παραλήπτη, μέσα στο `wording`.
 */
export function messagePlainText(wording: AppMessageWording, address: string, link: string): string {
  return [
    wording.heading,
    '',
    wording.intro(address),
    '',
    `${wording.cta}: ${link}`,
    '',
    wording.footnote,
    '',
    PRODUCT_NAME,
  ].join('\n');
}
