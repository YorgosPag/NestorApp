/**
 * @fileoverview **«ΣΕ ΚΑΛΟΥΝ ΝΑ ΦΩΤΟΓΡΑΦΙΣΕΙΣ ΕΝΑ ΑΚΙΝΗΤΟ»** — το email της πρόσκλησης φωτογράφου (ADR-884 Φ0.5 · Κ3α).
 * @module services/email-templates/tour-capture-invitation-email
 * @related ADR-884 §4.5 · ADR-853 §20 · `invitation-email-shared.ts` (ο ΚΟΙΝΟΣ σκελετός) · `workspace-invitation-email.ts`
 *
 * @note Οι ελληνικές/αγγλικές συμβολοσειρές εδώ **ΔΕΝ** είναι παράβαση του N.11: τα server-side πρότυπα email
 *       φέρουν το κείμενό τους inline by design (δες `server/comms/email-texts.ts`). Η γλώσσα είναι **παράμετρος**.
 *
 * 🔑 **Τέσσερα πράγματα πριν το κουμπί** — *ποιος* καλεί, *για ποιο ακίνητο*, *για ποια δουλειά* (ο λόγος που έγραψε ο
 * υπεύθυνος) και *ως πότε* θα μπορεί να ανεβάζει. Ο φωτογράφος αποφασίζει **αφού** τα διαβάσει (anti-phishing), και
 * ξέρει ότι η άδεια **λήγει** — δεν είναι λογαριασμός στο γραφείο, είναι μία δουλειά (Φ0.5).
 */

import 'server-only';

import { HUMAN_LANGUAGES, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { publicUrl } from '@/lib/http/public-origin';
import { formatOperatorDate } from '@/lib/operator-time-format';
import { tourCaptureInvitationHref } from '@/lib/spatial-tour/tour-routes';

import { escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import {
  composeInvitationEmail,
  invitationDaysRemaining,
  invitationDetailLine,
  type InvitationEmailCoreWording,
} from './invitation-email-shared';

interface TourCaptureInvitationWording extends InvitationEmailCoreWording {
  /** ⚠️ Παίρνει τον προσκαλούντα: τα εισερχόμενα διαβάζονται **χωρίς** να ανοιχτεί το μήνυμα. */
  readonly subject: (host: string) => string;
  readonly heading: string;
  /** Τα ορίσματα είναι είτε ωμό κείμενο είτε **ήδη ασφαλές HTML** — ο renderer αποφασίζει. */
  readonly intro: (host: string, property: string) => string;
  readonly reasonLabel: string;
  readonly uploadUntilLabel: string;
  /** Η ισχύς του **συνδέσμου** — ⚠️ ενικός/πληθυντικός ρητά. */
  readonly linkExpiry: (days: number) => string;
  /** Αγγελία ιδιώτη ⇒ δεν υπάρχει γραφείο να ονομαστεί. */
  readonly unnamedHost: string;
  readonly unnamedProperty: string;
}

/** ⚠️ `Record<HumanLanguage, …>`, ποτέ `Partial` — νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της. */
const TEXTS: Readonly<Record<HumanLanguage, TourCaptureInvitationWording>> = {
  el: {
    subject: (host) => `Πρόσκληση για λήψη 360° από ${host}`,
    heading: 'Σας καλούν να φωτογραφίσετε ένα ακίνητο',
    intro: (host, property) => `${host} σας καλεί να ανεβάσετε πανοράματα 360° για το ακίνητο ${property}.`,
    reasonLabel: 'Για',
    uploadUntilLabel: 'Μπορείτε να ανεβάζετε έως',
    linkExpiry: (days) =>
      days === 1 ? 'Ο σύνδεσμος ισχύει για 1 ακόμη ημέρα.' : `Ο σύνδεσμος ισχύει για ${days} ημέρες.`,
    cta: 'Δείτε την πρόσκληση',
    onlyWord: 'μόνο',
    boundToAddress: (onlyHtml) =>
      `Ο σύνδεσμος λειτουργεί ${onlyHtml} για αυτή τη διεύθυνση email — αν τον προωθήσετε, δεν θα δουλέψει για κανέναν άλλον.`,
    footnote:
      'Αν δεν περιμένατε αυτή την πρόσκληση, αγνοήστε το μήνυμα: η αποδοχή σας δίνει μόνο δυνατότητα ανεβάσματος '
      + 'σε αυτό το ακίνητο, για περιορισμένο χρόνο — καμία πρόσβαση σε τίποτα άλλο.',
    unnamedHost: 'Ο ιδιοκτήτης',
    unnamedProperty: 'της αγγελίας',
  },
  en: {
    subject: (host) => `${host} invited you to capture a 360° tour`,
    heading: 'You have been invited to photograph a property',
    intro: (host, property) => `${host} invites you to upload 360° panoramas for the property ${property}.`,
    reasonLabel: 'For',
    uploadUntilLabel: 'You can upload until',
    linkExpiry: (days) => (days === 1 ? 'This link is valid for 1 more day.' : `This link is valid for ${days} days.`),
    cta: 'View the invitation',
    onlyWord: 'only',
    boundToAddress: (onlyHtml) =>
      `The link works ${onlyHtml} for this email address — forwarding it will not work for anyone else.`,
    footnote:
      'If you were not expecting this invitation, ignore this message: accepting only lets you upload to this '
      + 'property, for a limited time — no access to anything else.',
    unnamedHost: 'The owner',
    unnamedProperty: 'in the listing',
  },
};

export interface TourCaptureInvitationEmailInput {
  /** Η γλώσσα του παραλήπτη — από **δεδομένα**, άρα `unknown` (άγνωστη ⇒ προεπιλογή). */
  readonly language: unknown;
  /** Το γραφείο που καλεί — `null` για αγγελία ιδιώτη. */
  readonly hostName: string | null;
  readonly propertyLabel: string | null;
  readonly reason: string;
  readonly grantExpiresAt: string;
  /** Η λήξη του **συνδέσμου**. */
  readonly expiresAt: string;
  /** Το **ωμό** token — μόνο στην επιστροφή της έκδοσης και **εδώ**. */
  readonly token: string;
  readonly nowISOValue: string;
}

/** **Το email, στη γλώσσα του παραλήπτη.** `null` ⇒ χωρίς δημόσια διεύθυνση — ποτέ σύνδεσμος που δεν οδηγεί πουθενά. */
export function buildTourCaptureInvitationEmail(input: TourCaptureInvitationEmailInput): ConfirmationEmailResult | null {
  const link = publicUrl(tourCaptureInvitationHref(input.token));
  if (link === null) return null;

  const language = resolveHumanLanguage(input.language);
  const wording = TEXTS[language];
  const host = input.hostName?.trim() || wording.unnamedHost;
  const property = input.propertyLabel?.trim() || wording.unnamedProperty;
  const linkExpiry = wording.linkExpiry(invitationDaysRemaining(input.expiresAt, input.nowISOValue));

  return composeInvitationEmail({
    language,
    subject: wording.subject(host),
    heading: wording.heading,
    intro: {
      html: wording.intro(`<strong>${escapeHtml(host)}</strong>`, `<strong>${escapeHtml(property)}</strong>`),
      text: wording.intro(host, property),
    },
    details: [
      invitationDetailLine(wording.reasonLabel, input.reason),
      invitationDetailLine(wording.uploadUntilLabel, formatOperatorDate(input.grantExpiresAt, language)),
      { html: escapeHtml(linkExpiry), text: linkExpiry },
    ],
    link,
    core: wording,
  });
}

/** **Έχει κάθε γλώσσα ΟΛΑ τα λόγια της;** — άγκυρα που **εκτελείται**, και ελέγχει και τις συναρτήσεις. */
export function everyLanguageHasTourCaptureInvitationWording(): boolean {
  return HUMAN_LANGUAGES.every((language) => {
    const w = TEXTS[language];
    if (!w) return false;
    const texts = [
      w.subject('χ'), w.heading, w.intro('χ', 'ψ'), w.reasonLabel, w.uploadUntilLabel, w.linkExpiry(1), w.linkExpiry(7),
      w.cta, w.onlyWord, w.boundToAddress(w.onlyWord), w.footnote, w.unnamedHost, w.unnamedProperty,
    ];
    return texts.every((text) => typeof text === 'string' && text.length > 0);
  });
}
