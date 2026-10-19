/**
 * @fileoverview **«Ο ΦΑΚΕΛΟΣ ΤΟΥ ΣΠΙΤΙΟΥ ΣΑΣ»** — το email της πρόσκλησης αγοραστή (ADR-916 Φ-Β · Δ7).
 * @module services/email-templates/property-handover-invitation-email
 * @related `invitation-email-shared.ts` (ο ΚΟΙΝΟΣ σκελετός) · `engagement-invitation-email.ts` (το πρότυπο)
 *
 * @note Οι ελληνικές/αγγλικές συμβολοσειρές εδώ **ΔΕΝ** είναι παράβαση του N.11: τα server-side πρότυπα email
 *       φέρουν το κείμενό τους inline by design (δες `server/comms/email-texts.ts`). Η γλώσσα είναι **παράμετρος**.
 *
 * 🔑 **Δύο αφορμές, ένα σχήμα** (Spaciable · Housebuilder Pro): στην **κράτηση** «σας ετοιμάζουμε τον φάκελο», στην
 * **ολοκλήρωση** «ο φάκελος είναι έτοιμος». Η υπενθύμιση είναι το **ίδιο** μήνυμα με σήμανση στο θέμα.
 * 🔒 Ό,τι ταξιδεύει σε προωθημένο email: εταιρεία και σπίτι — **ποτέ** ονόματα, ποσά ή στοιχεία συμβαλλομένων (ADR-742).
 * ⛔ Χωρίς συνημμένα: ο φάκελος ζει πίσω από τον λογαριασμό του αγοραστή, όχι στα εισερχόμενα.
 */

import 'server-only';

import { HUMAN_LANGUAGES, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { publicUrl } from '@/lib/http/public-origin';
import { handoverInvitationHref } from '@/lib/property-handover/handover-routes';
import { formatOperatorDate } from '@/lib/operator-time-format';
import type { PropertyHandoverInvitationOccasion } from '@/types/property-handover';

import { escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import {
  composeInvitationEmail,
  invitationDetailLine,
  type InvitationEmailCoreWording,
  type InvitationEmailLine,
} from './invitation-email-shared';

interface HandoverInvitationWording extends InvitationEmailCoreWording {
  /** ⚠️ Το θέμα λέει **το σπίτι**: ο αγοραστής πρέπει να αναγνωρίσει το μήνυμα χωρίς να το ανοίξει (anti-phishing). */
  readonly subject: Readonly<Record<PropertyHandoverInvitationOccasion, (property: string) => string>>;
  readonly reminderPrefix: string;
  readonly heading: Readonly<Record<PropertyHandoverInvitationOccasion, string>>;
  /** Τα ορίσματα είναι είτε ωμό κείμενο είτε **ήδη ασφαλές HTML** — ο renderer αποφασίζει. */
  readonly intro: Readonly<Record<PropertyHandoverInvitationOccasion, (issuer: string, property: string) => string>>;
  readonly findLabel: string;
  readonly find: string;
  readonly costLabel: string;
  readonly cost: string;
  readonly noAccount: string;
  readonly expiresLabel: string;
  readonly unnamedIssuer: string;
  readonly unnamedProperty: string;
}

/** ⚠️ `Record<HumanLanguage, …>`, ποτέ `Partial` — νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της. */
const TEXTS: Readonly<Record<HumanLanguage, HandoverInvitationWording>> = {
  el: {
    subject: {
      reservation: (property) => `Ο φάκελος του σπιτιού σας — ${property}`,
      completion: (property) => `Ο φάκελος του σπιτιού σας είναι έτοιμος — ${property}`,
    },
    reminderPrefix: 'Υπενθύμιση: ',
    heading: { reservation: 'Ο φάκελος του νέου σας σπιτιού', completion: 'Ο φάκελος του σπιτιού σας είναι έτοιμος' },
    intro: {
      reservation: (issuer, property) =>
        `${issuer} σας ετοιμάζει τον ψηφιακό φάκελο του ακινήτου ${property}. Τον λαμβάνετε με την ολοκλήρωση της αγοράς.`,
      completion: (issuer, property) =>
        `${issuer} ολοκλήρωσε την παράδοση του ακινήτου ${property}. Ο φάκελός του είναι πλέον δικός σας.`,
    },
    findLabel: 'Τι θα βρείτε',
    find: 'Σχέδια, φωτογραφίες, πιστοποιητικά (π.χ. ΠΕΑ) και τα έγγραφα του σπιτιού — αντίγραφο δικό σας, που μένει μαζί σας για πάντα.',
    costLabel: 'Κόστος',
    cost: 'Κανένα. Χρειάζεστε μόνο λογαριασμό με αυτή τη διεύθυνση email.',
    noAccount: 'Δεν έχετε λογαριασμό; Η εγγραφή με αυτό το email παίρνει περίπου ένα λεπτό.',
    expiresLabel: 'Ο σύνδεσμος λήγει στις',
    cta: 'Αποδοχή του φακέλου',
    onlyWord: 'μόνο',
    boundToAddress: (onlyHtml) =>
      `Ο σύνδεσμος λειτουργεί ${onlyHtml} για αυτή τη διεύθυνση email — μην τον προωθήσετε· για άλλον δεν θα δουλέψει.`,
    footnote:
      'Δεν σας αφορά; Ανοίξτε τον σύνδεσμο και πατήστε «Δεν το θέλω» — η εταιρεία θα ενημερωθεί. '
      + 'Η αποδοχή δίνει πρόσβαση μόνο στον φάκελο του δικού σας σπιτιού.',
    unnamedIssuer: 'Η εταιρεία που σας πούλησε το ακίνητο',
    unnamedProperty: 'σας',
  },
  en: {
    subject: {
      reservation: (property) => `Your home's file — ${property}`,
      completion: (property) => `Your home's file is ready — ${property}`,
    },
    reminderPrefix: 'Reminder: ',
    heading: { reservation: 'The file of your new home', completion: "Your home's file is ready" },
    intro: {
      reservation: (issuer, property) =>
        `${issuer} is preparing the digital file of the property ${property}. You receive it when your purchase completes.`,
      completion: (issuer, property) =>
        `${issuer} has completed the handover of the property ${property}. Its file is now yours.`,
    },
    findLabel: 'What you will find',
    find: "Drawings, photos, certificates (e.g. the energy certificate) and the home's documents — your own copy, kept with you for good.",
    costLabel: 'Cost',
    cost: 'None. You only need an account with this email address.',
    noAccount: 'No account? Signing up with this email takes about a minute.',
    expiresLabel: 'The link expires on',
    cta: 'Accept the file',
    onlyWord: 'only',
    boundToAddress: (onlyHtml) =>
      `The link works ${onlyHtml} for this email address — do not forward it; it will not work for anyone else.`,
    footnote:
      'Not for you? Open the link and press “I don’t want it” — the company will be told. '
      + 'Accepting gives access only to the file of your own home.',
    unnamedIssuer: 'The company that sold you the property',
    unnamedProperty: 'you purchased',
  },
};

export interface PropertyHandoverInvitationEmailInput {
  /** Η γλώσσα του παραλήπτη — από **δεδομένα**, άρα `unknown` (άγνωστη ⇒ προεπιλογή). */
  readonly language: unknown;
  readonly issuerName: string | null;
  readonly propertyLabel: string | null;
  readonly occasion: PropertyHandoverInvitationOccasion;
  readonly reminder: boolean;
  /** Η λήξη του **συνδέσμου**. */
  readonly expiresAt: string;
  /** Το **ωμό** token — μόνο στην έκδοση/επανέκδοση και **εδώ**. */
  readonly token: string;
}

function detailsOf(input: PropertyHandoverInvitationEmailInput, w: HandoverInvitationWording, language: HumanLanguage): InvitationEmailLine[] {
  return [
    invitationDetailLine(w.findLabel, w.find),
    invitationDetailLine(w.costLabel, w.cost),
    invitationDetailLine(w.expiresLabel, formatOperatorDate(input.expiresAt, language)),
    { html: escapeHtml(w.noAccount), text: w.noAccount },
  ];
}

/** **Το email, στη γλώσσα του παραλήπτη.** `null` ⇒ χωρίς δημόσια διεύθυνση — ποτέ σύνδεσμος που δεν οδηγεί πουθενά. */
export function buildPropertyHandoverInvitationEmail(input: PropertyHandoverInvitationEmailInput): ConfirmationEmailResult | null {
  const link = publicUrl(handoverInvitationHref(input.token));
  if (link === null) return null;

  const language = resolveHumanLanguage(input.language);
  const w = TEXTS[language];
  const issuer = input.issuerName?.trim() || w.unnamedIssuer;
  const property = input.propertyLabel?.trim() || w.unnamedProperty;
  const subject = w.subject[input.occasion](property);

  return composeInvitationEmail({
    language,
    subject: input.reminder ? `${w.reminderPrefix}${subject}` : subject,
    heading: w.heading[input.occasion],
    intro: {
      html: w.intro[input.occasion](`<strong>${escapeHtml(issuer)}</strong>`, `<strong>${escapeHtml(property)}</strong>`),
      text: w.intro[input.occasion](issuer, property),
    },
    details: detailsOf(input, w, language),
    link,
    core: w,
  });
}

/** **Έχει κάθε γλώσσα ΟΛΑ τα λόγια της;** — άγκυρα που **εκτελείται**, και ελέγχει και τις συναρτήσεις. */
export function everyLanguageHasHandoverInvitationWording(): boolean {
  return HUMAN_LANGUAGES.every((language) => {
    const w = TEXTS[language];
    if (!w) return false;
    const texts = [
      ...Object.values(w.subject).map((subject) => subject('χ')), w.reminderPrefix, ...Object.values(w.heading),
      ...Object.values(w.intro).map((intro) => intro('χ', 'ψ')), w.findLabel, w.find, w.costLabel, w.cost, w.noAccount,
      w.expiresLabel, w.cta, w.onlyWord, w.boundToAddress(w.onlyWord), w.footnote, w.unnamedIssuer, w.unnamedProperty,
    ];
    return texts.every((text) => typeof text === 'string' && text.length > 0);
  });
}
