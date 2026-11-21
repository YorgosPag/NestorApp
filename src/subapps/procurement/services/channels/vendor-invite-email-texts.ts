/**
 * @fileoverview **ΤΑ ΛΟΓΙΑ ΤΟΥ EMAIL ΠΡΟΣΚΛΗΣΗΣ ΠΡΟΜΗΘΕΥΤΗ — ΑΝΑ ΓΛΩΣΣΑ** (ADR-327 §7.2 · ADR-876 §5).
 * @module subapps/procurement/services/channels/vendor-invite-email-texts
 *
 * 🔴 **Γιατί υπάρχει (N.11 · N.0.2)**: το `email-channel.ts` συνέθετε θέμα και σώμα με **ωμά**
 * ελληνικά/αγγλικά μέσα σε τριαδικούς τελεστές (`isEl ? '…' : '…'`) — εννέα ζεύγη, και μια τρίτη
 * γλώσσα θα έπεφτε σιωπηλά στα αγγλικά. Εδώ: **καθαρά δεδομένα**, όπως το
 * `email-templates/auth-action-email-texts.ts` — η γλώσσα είναι **παράμετρος**, όχι καθολική κατάσταση.
 *
 * ⚠️ **`Record<HumanLanguage, …>`, ΠΟΤΕ `Partial`** — νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της.
 */

import { resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';

export interface VendorInviteEmailTexts {
  /** `projectName` = όνομα **έργου** (ή `null`) — ποτέ ο τίτλος του RFQ στη θέση του (ADR-327 §7.5, Ε2). */
  readonly subject: (rfqTitle: string, projectName: string | null) => string;
  /** `null` ⇒ ουδέτερος επίσημος χαιρετισμός — ποτέ email, ποτέ «Unknown» (Ε3). */
  readonly greeting: (vendorName: string | null) => string;
  /** Τα `*Markup` είναι ΗΔΗ escaped + τυλιγμένα από τον καλώντα — τα λόγια δεν κρατούν σήμανση. */
  readonly introHtml: (rfqTitleMarkup: string, projectMarkup: string | null) => string;
  /** Η ίδια πρόταση σε απλό κείμενο (text/plain) — ίδια διατύπωση με το HTML. */
  readonly introText: (rfqTitle: string, projectName: string | null) => string;
  readonly cta: string;
  /** Προθεσμία υποβολής προσφορών του RFQ — μόνο όταν υπάρχει. */
  readonly dueLabel: string;
  readonly expiresLabel: string;
  /** Επικεφαλίδα του προσωπικού σημειώματος του αγοραστή (Ε1). */
  readonly noteHeading: string;
  readonly warning: string;
  /** ADR-876 §5 — ο σύνδεσμος που λήγει δεν είναι αδιέξοδο: ανοίγει και ζητά νέο. */
  readonly renewHint: string;
  readonly declineQuestion: string;
  readonly declineCta: string;
  readonly textLink: string;
}

const VENDOR_INVITE_EMAIL_TEXTS: Readonly<Record<HumanLanguage, VendorInviteEmailTexts>> = {
  el: {
    subject: (rfqTitle, projectName) => `Αίτημα προσφοράς: ${rfqTitle}${projectName ? ` — ${projectName}` : ''}`,
    greeting: (vendorName) => (vendorName ? `Γεια σας ${vendorName},` : 'Αξιότιμοι κύριοι/κυρίες,'),
    introHtml: (rfqTitleMarkup, projectMarkup) =>
      `Σας έχει σταλεί αίτημα προσφοράς «${rfqTitleMarkup}»${projectMarkup ? ` για το έργο ${projectMarkup}` : ''}.`,
    introText: (rfqTitle, projectName) =>
      `Σας έχει σταλεί αίτημα προσφοράς «${rfqTitle}»${projectName ? ` για το έργο ${projectName}` : ''}.`,
    cta: 'Υποβολή Προσφοράς',
    dueLabel: 'Προθεσμία υποβολής προσφορών',
    expiresLabel: 'Ο σύνδεσμος λήγει στις',
    noteHeading: 'Μήνυμα από τον αποστολέα',
    warning: '⚠️ Αυτός ο σύνδεσμος είναι προσωπικός. Μην τον προωθήσετε σε τρίτους.',
    renewHint: 'Αν ο σύνδεσμος λήξει ενώ η πρόσκληση είναι ακόμη ανοιχτή, ανοίξτε τον και ζητήστε νέο — θα έρθει σε αυτή τη διεύθυνση.',
    declineQuestion: 'Δεν μπορείτε να συμμετάσχετε;',
    declineCta: 'Δηλώστε άρνηση εδώ',
    textLink: 'Σύνδεσμος',
  },
  en: {
    subject: (rfqTitle, projectName) => `Quote request: ${rfqTitle}${projectName ? ` — ${projectName}` : ''}`,
    greeting: (vendorName) => (vendorName ? `Hello ${vendorName},` : 'Dear Sir or Madam,'),
    introHtml: (rfqTitleMarkup, projectMarkup) =>
      `You have been sent the quote request “${rfqTitleMarkup}”${projectMarkup ? ` for the project ${projectMarkup}` : ''}.`,
    introText: (rfqTitle, projectName) =>
      `You have been sent the quote request “${rfqTitle}”${projectName ? ` for the project ${projectName}` : ''}.`,
    cta: 'Submit Quote',
    dueLabel: 'Quotes due by',
    expiresLabel: 'Link expires on',
    noteHeading: 'Message from the sender',
    warning: '⚠️ This link is personal. Do not forward it to anyone else.',
    renewHint: 'If the link expires while the invitation is still open, open it and request a new one — it will be sent to this address.',
    declineQuestion: 'Cannot participate?',
    declineCta: 'Decline here',
    textLink: 'Link',
  },
};

export function vendorInviteEmailTexts(locale: string): VendorInviteEmailTexts {
  return VENDOR_INVITE_EMAIL_TEXTS[resolveHumanLanguage(locale)];
}
