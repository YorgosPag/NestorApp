/**
 * =============================================================================
 * Η ΑΠΟΔΟΣΗ ΤΩΝ EMAIL ΕΙΔΟΠΟΙΗΣΕΩΝ — κείμενο + HTML, με συνδέσμους (ADR-848)
 * =============================================================================
 *
 * **Καθαρές συναρτήσεις. Καμία Firestore, κανένα δίκτυο, κανένα ρολόι, κανένα env.**
 * Οι σύνδεσμοι έρχονται ως **ένεση** ({@link EmailLinks}): εδώ δεν ρωτιέται ποιο
 * είναι το domain ή ποιο το μυστικό — μόνο *«υπάρχει σύνδεσμος για αυτό;»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ — ΚΑΙ ΤΙ ΑΝΤΙΓΡΑΦΕΤΑΙ ΑΠΟ ΑΥΤΟΥΣ
 * ────────────────────────────────────────────────────────────────────────────
 * - **Σύνδεσμος ανά γραμμή** (GitHub · Figma): ο **τίτλος** κάθε ειδοποίησης είναι ο
 *   σύνδεσμος — περιγραφικό κείμενο, ποτέ «πάτα εδώ» (WebAIM: ο αναγνώστης οθόνης
 *   διαβάζει τους συνδέσμους **εκτός** πλαισίου).
 * - **Κουμπί που αντέχει το Outlook** (Litmus): `v:roundrect` μέσα σε σχόλιο `mso`
 *   για τη μηχανή του Word, απλό `<a>` για όλους τους άλλους. Ύψος **44px** (WCAG
 *   2.5.5), **ρητό** φόντο (αλλιώς το σκοτεινό θέμα κάποιων προγραμμάτων το σβήνει).
 * - **Πλήρη URL στο απλό κείμενο** (Postmark): ο αναγνώστης χωρίς HTML δεν έχει κουμπί.
 * - **Κανένα pixel, κανένα UTM**: το «διαβάστηκε» το γράφει το **κλικ** (`/n/{id}`),
 *   και οι μεγάλοι δεν βάζουν UTM σε ειδοποιήσεις.
 *
 * ⚠️ **Inline styles, ΣΚΟΠΙΜΑ**: τα προγράμματα email πετούν τα `<style>` και τις
 * κλάσεις. Ίδια εξαίρεση από τον κανόνα N.3 με το `base-email-template.ts`.
 *
 * ⚠️ **Χωρίς συνδέσμους ⇒ ΑΚΡΙΒΩΣ το σημερινό κείμενο.** Αν λείπει το
 * `NEXT_PUBLIC_APP_URL` ή το μυστικό, το email φεύγει όπως έφευγε πριν το ADR-848 —
 * η υποβάθμιση είναι **το παρελθόν**, όχι ένα τρίτο, άγνωστο σχήμα.
 *
 * @module server/notifications/notification-email-render
 * @see server/notifications/notification-email-envelope — ποιος δίνει τους συνδέσμους
 */

import type { HumanLanguage } from '@/i18n/languages';
import { emailTextsFor, type EmailWording } from '@/server/comms/email-texts';
// ⚠️ **Τοπικό αντίγραφο δεν επιτρέπεται** — το `escapeHtml` και τα χρώματα έρχονται από
// το SSoT των προτύπων email. Υπάρχουν ήδη **δύο** υλοποιήσεις escape στο repo
// (`email-templates` και `telegram/admin/format`)· μια τρίτη θα ήταν η γνωστή απόκλιση.
import { BRAND, escapeHtml } from '@/services/email-templates/base-email-template';

// =============================================================================
// ΣΥΜΒΟΛΑΙΟ
// =============================================================================

/**
 * **Πού δείχνουν οι σύνδεσμοι** — ή `null` όταν δεν υπάρχει τρόπος να χτιστούν.
 *
 * 🔑 Τρεις ερωτήσεις, **τρεις** συναρτήσεις: ο μόνιμος σύνδεσμος της ειδοποίησης, η
 * σελίδα προτιμήσεων (για άνθρωπο) και ο στόχος του one-click (για το πρόγραμμα
 * email, RFC 8058). Οι δύο τελευταίες δείχνουν σε **διαφορετικά** σημεία επίτηδες:
 * η σελίδα **ρωτά**, το one-click **εκτελεί**.
 */
export interface EmailLinks {
  permalink(notificationId: string): string | null;
  preferences(recipientId: string): string | null;
  oneClickUnsubscribe(recipientId: string): string | null;
}

/** Κανένας σύνδεσμος — η συμπεριφορά πριν το ADR-848, και η προεπιλογή των tests. */
export const NO_LINKS: EmailLinks = {
  permalink: () => null,
  preferences: () => null,
  oneClickUnsubscribe: () => null,
};

/** Ό,τι χρειάζεται η απόδοση από ένα μήνυμα της ουράς. */
export interface RenderableMessage {
  readonly subject: string;
  readonly content: string;
  readonly notificationId?: string;
  readonly recipientId?: string;
}

const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// =============================================================================
// ΚΡΙΤΕΣ
// =============================================================================

/**
 * **Λέει αυτό το σώμα κάτι που δεν λέει ήδη το θέμα;** (ADR-777 §8.54)
 *
 * 🔴 Εδώ ρωτιόταν *«υπάρχει σώμα;»* — και η απάντηση ήταν **πάντα ναι**, επειδή ο
 * orchestrator έγραφε `content: body ?? title`. Ζωντανή μέτρηση 2026-09-05: σύνοψη
 * **5** ειδοποιήσεων, **10** γραμμές. Η ρίζα διορθώθηκε στον orchestrator· αυτός ο
 * κριτής είναι η **δεύτερη** άμυνα (N.7.2 #4), γιατί τα ήδη γραμμένα `pending`
 * έγγραφα κουβαλούν το αντίγραφο για πάντα.
 *
 * ⚠️ **ΕΝΑΣ κριτής, όλοι οι καταναλωτές** (κείμενο και HTML, σύνοψη και μεμονωμένο):
 * αλλιώς η επόμενη διόρθωση θα έφτανε στον ένα και το email θα έλεγε **άλλα πράγματα
 * σε κείμενο και σε HTML** — δηλαδή θα εξαρτιόταν από το πρόγραμμα του παραλήπτη.
 */
export function bodyAddsAnything(message: RenderableMessage): boolean {
  const body = message.content.trim();
  return body.length > 0 && body !== message.subject.trim();
}

/** Το σώμα ενός μεμονωμένου email **χωρίς** συνδέσμους — ο κανόνας πριν το ADR-848. */
export function soloPlainBody(message: RenderableMessage): string {
  return message.content.trim().length > 0 ? message.content : message.subject;
}

function permalinkOf(message: RenderableMessage, links: EmailLinks): string | null {
  return message.notificationId ? links.permalink(message.notificationId) : null;
}

/**
 * Ο **ένας** παραλήπτης μιας ομάδας μηνυμάτων — ή `null` αν δεν είναι ένας.
 *
 * ⚠️ Μια σύνοψη ομαδοποιείται κατά **διεύθυνση**· αν δύο λογαριασμοί μοιράζονταν
 * διεύθυνση, ένα token διαγραφής για τον **πρώτο** θα κατάργησε τα email του
 * **δεύτερου**. Χωρίς ομοφωνία δεν βγαίνει σύνδεσμος διαγραφής — ποτέ μαντεψιά.
 */
export function soleRecipientOf(members: readonly RenderableMessage[]): string | null {
  const first = members[0]?.recipientId;
  if (!first) return null;
  return members.every((member) => member.recipientId === first) ? first : null;
}

// =============================================================================
// ΚΟΙΝΑ ΚΟΜΜΑΤΙΑ HTML
// =============================================================================

/** Κουμπί που αντέχει το Outlook (VML) και το σκοτεινό θέμα (ρητό φόντο). */
function buttonHtml(url: string, label: string): string {
  const href = escapeHtml(url);
  const text = escapeHtml(label);
  return [
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 4px;"><tr><td>',
    `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="12%" stroke="f" fillcolor="${BRAND.navy}"><w:anchorlock/><center style="color:${BRAND.white};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${text}</center></v:roundrect><![endif]-->`,
    `<!--[if !mso]><!-- --><a href="${href}" style="background-color:${BRAND.navy};border-radius:6px;color:${BRAND.white};display:inline-block;font-family:${FONT};font-size:15px;font-weight:600;line-height:44px;padding:0 24px;text-decoration:none;">${text}</a><!--<![endif]-->`,
    '</td></tr></table>',
  ].join('');
}

/** Το υποσέλιδο: ποιος στέλνει, γιατί, και πού σταματά. */
function footerHtml(wording: EmailWording, manageUrl: string | null): string {
  const style = `margin:8px 0 0;color:${BRAND.grayLight};font-family:${FONT};font-size:12px;line-height:1.5;`;
  const parts = [`<p style="${style}">${escapeHtml(wording.digest.footer)}</p>`];
  if (manageUrl) {
    parts.push(
      `<p style="${style}">${escapeHtml(wording.links.whyReceived)} ` +
        `<a href="${escapeHtml(manageUrl)}" style="color:${BRAND.grayLight};text-decoration:underline;">${escapeHtml(wording.links.manage)}</a></p>`,
    );
  }
  return parts.join('');
}

/** Το έγγραφο: `lang`, `color-scheme`, κρυφό preheader, μία κάρτα, υποσέλιδο. */
function documentHtml(parts: {
  readonly language: HumanLanguage;
  readonly title: string;
  readonly preheader: string;
  readonly bodyHtml: string;
  readonly footer: string;
}): string {
  return [
    `<!DOCTYPE html><html lang="${parts.language}"><head><meta charset="utf-8">`,
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">',
    `<title>${escapeHtml(parts.title)}</title></head>`,
    `<body style="margin:0;padding:0;background-color:${BRAND.bgLight};">`,
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(parts.preheader)}</div>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 12px;">',
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:${BRAND.white};border:1px solid ${BRAND.border};border-radius:8px;">`,
    `<tr><td style="padding:24px;font-family:${FONT};font-size:15px;line-height:1.5;color:${BRAND.gray};">${parts.bodyHtml}</td></tr>`,
    `</table><table role="presentation" width="100%" style="max-width:560px;"><tr><td style="padding:0 8px;">${parts.footer}</td></tr></table>`,
    '</td></tr></table></body></html>',
  ].join('');
}

/** Το σώμα μιας ειδοποίησης — **μόνο** όταν λέει κάτι παραπάνω από τον τίτλο. */
function bodyParagraphHtml(message: RenderableMessage): string {
  return bodyAddsAnything(message)
    ? `<p style="margin:4px 0 0;color:${BRAND.grayLight};">${escapeHtml(message.content)}</p>`
    : '';
}

/** Οι γραμμές του υποσέλιδου στο απλό κείμενο. Χωρίς σύνδεσμο ⇒ ό,τι έγραφε πάντα. */
function footerTextLines(wording: EmailWording, manageUrl: string | null): string[] {
  const lines = ['—', wording.digest.footer];
  if (manageUrl) lines.push(wording.links.whyReceived, `${wording.links.manage}: ${manageUrl}`);
  return lines;
}

// =============================================================================
// Η ΣΥΝΟΨΗ
// =============================================================================

/** Μία γραμμή της σύνοψης: ο **τίτλος είναι ο σύνδεσμος**, όπου υπάρχει. */
function digestItemHtml(message: RenderableMessage, links: EmailLinks): string {
  const url = permalinkOf(message, links);
  const title = escapeHtml(message.subject);
  const heading = url
    ? `<a href="${escapeHtml(url)}" style="color:${BRAND.navy};font-weight:600;text-decoration:underline;">${title}</a>`
    : `<strong style="color:${BRAND.navyDark};">${title}</strong>`;
  return `<li style="margin:0 0 14px;">${heading}${bodyParagraphHtml(message)}</li>`;
}

/** Το σώμα της σύνοψης σε **απλό κείμενο** — ο αναγνώστης χωρίς HTML, με πλήρη URL. */
export function renderDigestText(
  members: readonly RenderableMessage[],
  language: HumanLanguage,
  links: EmailLinks = NO_LINKS,
): string {
  const wording = emailTextsFor(language);
  const lines: string[] = [wording.digest.intro(members.length), ''];

  members.forEach((member, index) => {
    lines.push(`${index + 1}. ${member.subject}`);
    if (bodyAddsAnything(member)) lines.push(`   ${member.content}`);
    const url = permalinkOf(member, links);
    if (url) lines.push(`   ${url}`);
    lines.push('');
  });

  const recipient = soleRecipientOf(members);
  lines.push(...footerTextLines(wording, recipient ? links.preferences(recipient) : null));
  return lines.join('\n');
}

/**
 * Το σώμα της σύνοψης σε HTML.
 *
 * ⚠️ **Κάθε τιμή περνά από `escapeHtml`** — τα θέματα περιέχουν ονόματα ακινήτων και
 * ανθρώπων, δηλαδή κείμενο που γράφει χρήστης. Ένα `<` θα έσπαγε το μήνυμα· ένα
 * `<script>` θα ήταν χειρότερο.
 */
export function renderDigestHtml(
  members: readonly RenderableMessage[],
  language: HumanLanguage,
  subject: string,
  links: EmailLinks = NO_LINKS,
): string {
  const wording = emailTextsFor(language);
  const intro = wording.digest.intro(members.length);
  const items = members.map((member) => digestItemHtml(member, links)).join('');
  const recipient = soleRecipientOf(members);

  return documentHtml({
    language,
    title: subject,
    preheader: intro,
    bodyHtml: `<p style="margin:0 0 16px;">${escapeHtml(intro)}</p><ol style="margin:0;padding-left:20px;">${items}</ol>`,
    footer: footerHtml(wording, recipient ? links.preferences(recipient) : null),
  });
}

// =============================================================================
// ΤΟ ΜΕΜΟΝΩΜΕΝΟ EMAIL
// =============================================================================

/** Το μεμονωμένο email σε απλό κείμενο. Χωρίς συνδέσμους ⇒ **ακριβώς** το σημερινό. */
export function renderSoloText(
  message: RenderableMessage,
  language: HumanLanguage,
  links: EmailLinks = NO_LINKS,
): string {
  const url = permalinkOf(message, links);
  const manageUrl = message.recipientId ? links.preferences(message.recipientId) : null;
  if (!url && !manageUrl) return soloPlainBody(message);

  const wording = emailTextsFor(language);
  const lines = [soloPlainBody(message)];
  if (url) lines.push('', `${wording.links.openPlain}: ${url}`);
  lines.push('', ...footerTextLines(wording, manageUrl));
  return lines.join('\n');
}

/** Το μεμονωμένο email σε HTML: τίτλος, σώμα, **ένα** κουμπί προς τον προορισμό. */
export function renderSoloHtml(
  message: RenderableMessage,
  language: HumanLanguage,
  subject: string,
  links: EmailLinks = NO_LINKS,
): string {
  const wording = emailTextsFor(language);
  const url = permalinkOf(message, links);
  const heading = `<h1 style="margin:0 0 8px;font-size:18px;line-height:1.35;color:${BRAND.navyDark};">${escapeHtml(message.subject)}</h1>`;

  return documentHtml({
    language,
    title: subject,
    preheader: bodyAddsAnything(message) ? message.content : message.subject,
    bodyHtml: `${heading}${bodyParagraphHtml(message)}${url ? buttonHtml(url, wording.links.open) : ''}`,
    footer: footerHtml(wording, message.recipientId ? links.preferences(message.recipientId) : null),
  });
}
