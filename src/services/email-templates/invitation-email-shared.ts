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

/** Ετικέτα που κλείνει ήδη με δική της στίξη (ερώτηση · άνω τελεία · τελεία · αποσιωπητικά) — δεν θέλει «:». */
const LABEL_ENDS_PUNCTUATED = /[.:;?!;…]$/u;

/**
 * «Ετικέτα: **τιμή**» — και στις δύο μορφές, από τις ωμές τιμές. **Μία στίξη στο σύνορο**: ετικέτα που λήγει ήδη σε
 * στίξη (π.χ. «Δεν ήσασταν εσείς;») δεν παίρνει και «:» — αλλιώς ο παραλήπτης διάβαζε «;:» (ADR-915 §45.11).
 */
export function invitationDetailLine(label: string, value: string): InvitationEmailLine {
  const separator = LABEL_ENDS_PUNCTUATED.test(label.trimEnd()) ? ' ' : ': ';
  const head = label.trimEnd();
  return { html: `${escapeHtml(head)}${separator}<strong>${escapeHtml(value)}</strong>`, text: `${head}${separator}${value}` };
}

/** Θέσεις τιμών μέσα στη φράση — χαρακτήρες ιδιωτικής χρήσης Unicode, που κανένα κείμενο χρήστη δεν περιέχει. */
const SLOT_OPEN = '';
const SLOT_CLOSE = '';
const SLOT = new RegExp(`${SLOT_OPEN}(\\d+)${SLOT_CLOSE}(\\.?)`, 'g');

/** Τιμή της φράσης: σκέτο κείμενο ⇒ **τονισμένη**· `{ plain }` ⇒ χωρίς έμφαση (π.χ. ο ρόλος μέσα στην πρόταση). */
export type InvitationPhraseValue = string | { readonly plain: string };

const textOf = (value: InvitationPhraseValue | undefined): string => (value === undefined ? '' : typeof value === 'string' ? value : value.plain);

function fillSlots(template: string, values: readonly InvitationPhraseValue[], render: (value: InvitationPhraseValue) => string): string {
  return template.replace(SLOT, (_match, index: string, dot: string) => {
    const value = values[Number(index)];
    return (value === undefined ? '' : render(value)) + (dot !== '' && textOf(value).endsWith('.') ? '' : dot);
  });
}

/**
 * Μια φράση με **τονισμένες** τιμές, στις δύο μορφές. **Μία τελεία στο τέλος πρότασης**: τιμή που ήδη λήγει σε «.»
 * (π.χ. «Διαμέρισμα 95 τ.μ.») απορροφά την τελεία της φράσης — αλλιώς ο παραλήπτης διάβαζε «95 τ.μ..» (ADR-915 §45).
 * Η φράση καλείται **μία** φορά με θέσεις, ώστε η απόφαση να κρίνεται στο σημείο συνάντησης τιμής-φράσης και μόνο εκεί
 * (ποτέ αντικατάσταση «..» στο αποτέλεσμα: θα έτρωγε αποσιωπητικά που έγραψε ο άνθρωπος).
 */
export function emphasizedInvitationLine(
  phrase: (...values: string[]) => string,
  values: readonly InvitationPhraseValue[],
): InvitationEmailLine {
  const template = phrase(...values.map((_value, index) => `${SLOT_OPEN}${index}${SLOT_CLOSE}`));
  return {
    html: fillSlots(template, values, (value) => (typeof value === 'string' ? `<strong>${escapeHtml(value)}</strong>` : escapeHtml(value.plain))),
    text: fillSlots(template, values, textOf),
  };
}

const PARAGRAPH = `font-size:15px;color:${BRAND.gray};line-height:1.6;`;
const SMALL = `font-size:13px;color:${BRAND.grayLight};line-height:1.6;`;

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, '');

/** **Το email της πρόσκλησης** — HTML + απλό κείμενο στην **ίδια** σειρά. */
/** Επικεφαλίδα · εισαγωγή · στοιχεία — η κοινή αρχή **κάθε** μηνύματος αυτού του σκελετού, στη σειρά ασφαλείας. */
function leadHtml(content: Pick<InvitationEmailContent, 'heading' | 'intro' | 'details'>): string {
  return `<h2 style="margin:0 0 12px;font-size:20px;color:${BRAND.navyDark};">${escapeHtml(content.heading)}</h2>`
    + `<p style="margin:0 0 12px;${PARAGRAPH}">${content.intro.html}</p>`
    + content.details.map((line, i, all) => `<p style="margin:0 0 ${i === all.length - 1 ? 8 : 4}px;${PARAGRAPH}">${line.html}</p>`).join('');
}

function leadText(content: Pick<InvitationEmailContent, 'heading' | 'intro' | 'details'>): string[] {
  return [content.heading, '', content.intro.text, ...content.details.map((line) => line.text), ''];
}

export function composeInvitationEmail(content: InvitationEmailContent): ConfirmationEmailResult {
  const { core } = content;
  const bound = core.boundToAddress(`<strong>${escapeHtml(core.onlyWord)}</strong>`);
  const contentHtml =
    `<div style="margin:0 0 24px;">`
    + leadHtml(content)
    + renderShareCta(content.link, core.cta)
    + `<p style="margin:16px 0 0;${SMALL}">${bound}</p>`
    + `<p style="margin:8px 0 0;${SMALL}">${escapeHtml(core.footnote)}</p>`
    + `</div>`;
  const text = [
    ...leadText(content), `${core.cta}: ${content.link}`, '', stripTags(core.boundToAddress(core.onlyWord)), core.footnote,
  ].join('\n');
  return { subject: brandedSubject(content.subject), html: wrapInAppFrame(contentHtml, content.language), text };
}

/**
 * **Ενημέρωση χωρίς πράξη** (ADR-915 §28 Η-Β8) — ίδιος σκελετός και σειρά, **χωρίς** κουμπί και χωρίς σύνδεσμο: ο
 * παραλήπτης μαθαίνει, δεν αποφασίζει. Η υποσημείωση λέει **γιατί** το λαμβάνει (διαφάνεια, GDPR άρθρο 14).
 */
export function composeNoticeEmail(content: Omit<InvitationEmailContent, 'link' | 'core'> & { readonly footnote: string }): ConfirmationEmailResult {
  const contentHtml = `<div style="margin:0 0 24px;">${leadHtml(content)}<p style="margin:16px 0 0;${SMALL}">${escapeHtml(content.footnote)}</p></div>`;
  const text = [...leadText(content), content.footnote].join('\n');
  return { subject: brandedSubject(content.subject), html: wrapInAppFrame(contentHtml, content.language), text };
}
