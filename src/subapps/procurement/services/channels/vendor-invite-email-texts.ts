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
  readonly subject: (rfqTitle: string, projectLine: string) => string;
  readonly greeting: (vendorName: string) => string;
  /** Το `rfqTitleMarkup` είναι ΗΔΗ escaped + τυλιγμένο από τον καλώντα — τα λόγια δεν κρατούν σήμανση. */
  readonly introHtml: (rfqTitleMarkup: string) => string;
  readonly cta: string;
  readonly expiresLabel: string;
  readonly warning: string;
  /** ADR-876 §5 — ο σύνδεσμος που λήγει δεν είναι αδιέξοδο: ανοίγει και ζητά νέο. */
  readonly renewHint: string;
  readonly declineQuestion: string;
  readonly declineCta: string;
  readonly textRequest: string;
  readonly textLink: string;
  readonly textExpires: string;
}

const VENDOR_INVITE_EMAIL_TEXTS: Readonly<Record<HumanLanguage, VendorInviteEmailTexts>> = {
  el: {
    subject: (rfqTitle, projectLine) => `Πρόσκληση Προσφοράς: ${rfqTitle}${projectLine}`,
    greeting: (vendorName) => `Γεια σας ${vendorName},`,
    introHtml: (rfqTitleMarkup) => `Σας έχει σταλεί αίτημα προσφοράς για το έργο ${rfqTitleMarkup}.`,
    cta: 'Υποβολή Προσφοράς',
    expiresLabel: 'Ο σύνδεσμος λήγει στις',
    warning: '⚠️ Αυτός ο σύνδεσμος είναι προσωπικός. Μην τον προωθήσετε σε τρίτους.',
    renewHint: 'Αν ο σύνδεσμος λήξει ενώ η πρόσκληση είναι ακόμη ανοιχτή, ανοίξτε τον και ζητήστε νέο — θα έρθει σε αυτή τη διεύθυνση.',
    declineQuestion: 'Δεν μπορείτε να συμμετάσχετε;',
    declineCta: 'Δηλώστε άρνηση εδώ',
    textRequest: 'Αίτημα προσφοράς:',
    textLink: 'Σύνδεσμος:',
    textExpires: 'Λήγει:',
  },
  en: {
    subject: (rfqTitle, projectLine) => `Quote Request: ${rfqTitle}${projectLine}`,
    greeting: (vendorName) => `Hello ${vendorName},`,
    introHtml: (rfqTitleMarkup) => `You have been invited to submit a quote for project ${rfqTitleMarkup}.`,
    cta: 'Submit Quote',
    expiresLabel: 'Link expires on',
    warning: '⚠️ This link is personal. Do not forward it to anyone else.',
    renewHint: 'If the link expires while the invitation is still open, open it and request a new one — it will be sent to this address.',
    declineQuestion: 'Cannot participate?',
    declineCta: 'Decline here',
    textRequest: 'Quote request:',
    textLink: 'Link:',
    textExpires: 'Expires:',
  },
};

export function vendorInviteEmailTexts(locale: string): VendorInviteEmailTexts {
  return VENDOR_INVITE_EMAIL_TEXTS[resolveHumanLanguage(locale)];
}
