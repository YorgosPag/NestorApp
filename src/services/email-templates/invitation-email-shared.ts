/**
 * @fileoverview **Ο ΣΚΕΛΕΤΟΣ ΚΑΘΕ EMAIL ΠΡΟΣΚΛΗΣΗΣ** — διάταξη, σειρά και απλό κείμενο· τα **λόγια** τα δίνει το είδος.
 * @module services/email-templates/invitation-email-shared
 * @related ADR-853 §5 #4 (στοιχεία ΠΡΙΝ το κουμπί) · §7.5 (δέσμευση παραλήπτη) · §20 · ADR-884 §4.5 (Κ3α)
 *
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3.
 *
 * Εξήχθη από το `workspace-invitation-email.ts` (2026-09-26) με την άφιξη του **δεύτερου** είδους (φωτογράφος):
 * 🔑 **η σειρά είναι ασφάλεια, όχι αισθητική** — ο άνθρωπος διαβάζει **ποιος** τον καλεί και **για τι** πριν δει
 * κουμπί (anti-phishing), και η γραμμή «μόνο για αυτή τη διεύθυνση» λέγεται **πριν** προωθήσει. Δύο αντίγραφα
 * αυτής της σειράς θα απέκλιναν στην πρώτη διόρθωση. Πλαίσιο · κουμπί · χρώματα · υπογραφή έρχονται **αυτούσια**
 * από τα κοινά (`wrapInAppFrame` · `renderShareCta` · `BRAND`).
 */

import 'server-only';

import type { HumanLanguage } from '@/i18n/languages';
import { deadlineDaysLeft } from '@/lib/date-local';
import { brandedSubject } from '@/server/comms/email-texts';

import { BRAND, escapeHtml } from './base-email-template';
import { wrapInAppFrame } from './app-message-email';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import { renderShareCta } from './showcase-email-shared';

/** Τα λόγια που **κάθε** πρόσκληση λέει — το είδος τα δίνει στη γλώσσα του παραλήπτη. */
export interface InvitationEmailCoreWording {
  readonly cta: string;
  /**
   * 🔒 Η γραμμή που κάνει το προωθημένο email ακίνδυνο. **Η διατύπωση κρατά λέξεις, ο renderer κρατά σήμανση**:
   * ωμό `<strong>Ελληνικά</strong>` σε `.ts` το μπλοκάρει η πύλη N.11.
   */
  readonly boundToAddress: (onlyHtml: string) => string;
  /** Η **λέξη** που τονίζεται στο {@link boundToAddress}. */
  readonly onlyWord: string;
  /** «Δεν το περίμενα» — η έξοδος χωρίς ενοχή. */
  readonly footnote: string;
}

/**
 * Μια γραμμή **σε δύο μορφές**. 🔴 Το απλό κείμενο **δεν** παράγεται αφαιρώντας ετικέτες από το HTML: οι τιμές εκεί
 * είναι escaped, και ένα «Α & Β» θα έφτανε ως «Α &amp; Β». Κάθε μορφή χτίζεται από τις **ωμές** τιμές.
 */
export interface InvitationEmailLine {
  /** **Ήδη ασφαλές HTML** — κάθε τιμή έχει περάσει από `escapeHtml`. */
  readonly html: string;
  readonly text: string;
}

export interface InvitationEmailContent {
  readonly language: HumanLanguage;
  readonly subject: string;
  readonly heading: string;
  readonly intro: InvitationEmailLine;
  /** Οι γραμμές στοιχείων (ποιος · τι · ως πότε), με τη σειρά που θα διαβαστούν. */
  readonly details: readonly InvitationEmailLine[];
  readonly link: string;
  readonly core: InvitationEmailCoreWording;
}

/**
 * **Πόσες ημέρες μένουν** — ο κανόνας του SSoT (`deadlineDaysLeft`), δάπεδο 1, προς τα **πάνω**: σε προθεσμία δεν
 * υποσχόμαστε ποτέ λιγότερα από όσα δίνουμε. Το email είναι στιγμιότυπο εξ ορισμού (γράφεται μία φορά).
 */
export function invitationDaysRemaining(expiresAt: string, nowValue: string): number {
  return deadlineDaysLeft(expiresAt, Date.parse(nowValue)) ?? 1;
}

/** «Ετικέτα: **τιμή**» — και στις δύο μορφές, από τις ωμές τιμές. */
export function invitationDetailLine(label: string, value: string): InvitationEmailLine {
  return { html: `${escapeHtml(label)}: <strong>${escapeHtml(value)}</strong>`, text: `${label}: ${value}` };
}

const PARAGRAPH = `font-size:15px;color:${BRAND.gray};line-height:1.6;`;
const SMALL = `font-size:13px;color:${BRAND.grayLight};line-height:1.6;`;

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, '');

/** **Το email της πρόσκλησης** — HTML + απλό κείμενο στην **ίδια** σειρά. */
export function composeInvitationEmail(content: InvitationEmailContent): ConfirmationEmailResult {
  const { core } = content;
  const bound = core.boundToAddress(`<strong>${escapeHtml(core.onlyWord)}</strong>`);
  const contentHtml =
    `<div style="margin:0 0 24px;">`
    + `<h2 style="margin:0 0 12px;font-size:20px;color:${BRAND.navyDark};">${escapeHtml(content.heading)}</h2>`
    + `<p style="margin:0 0 12px;${PARAGRAPH}">${content.intro.html}</p>`
    + content.details.map((line, i, all) => `<p style="margin:0 0 ${i === all.length - 1 ? 8 : 4}px;${PARAGRAPH}">${line.html}</p>`).join('')
    + renderShareCta(content.link, core.cta)
    + `<p style="margin:16px 0 0;${SMALL}">${bound}</p>`
    + `<p style="margin:8px 0 0;${SMALL}">${escapeHtml(core.footnote)}</p>`
    + `</div>`;
  const text = [
    content.heading, '', content.intro.text, ...content.details.map((line) => line.text), '',
    `${core.cta}: ${content.link}`, '', stripTags(core.boundToAddress(core.onlyWord)), core.footnote,
  ].join('\n');
  return { subject: brandedSubject(content.subject), html: wrapInAppFrame(contentHtml, content.language), text };
}
