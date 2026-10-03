/**
 * @fileoverview **«ΣΑΣ ΑΝΑΘΕΤΟΥΝ ΜΙΑ ΥΠΟΘΕΣΗ ΜΕΤΑΒΙΒΑΣΗΣ»** — το email της πρόσκλησης επαγγελματία χωρίς λογαριασμό.
 * @module services/email-templates/engagement-invitation-email
 * @related ADR-901 Φ3 · §5.6 · Ε-4 · Ε-5 · ADR-853 §20 · `invitation-email-shared.ts` (ο ΚΟΙΝΟΣ σκελετός)
 *
 * @note Οι ελληνικές/αγγλικές συμβολοσειρές εδώ **ΔΕΝ** είναι παράβαση του N.11: τα server-side πρότυπα email
 *       φέρουν το κείμενό τους inline by design (δες `server/comms/email-texts.ts`). Η γλώσσα είναι **παράμετρος**.
 *
 * 🔑 **Η σειρά του §5.6, στον κοινό σκελετό**: ποιος σας ορίζει και για τι → ποιο ακίνητο → τι θα βρείτε
 * (**μετρήσεις**, ποτέ έγγραφα) → τι σας ζητείται → κουμπί → «χωρίς λογαριασμό;» → ασφάλεια (λήξη · μόνο για αυτή
 * τη διεύθυνση) → «δεν αναλαμβάνω» χωρίς ενοχή.
 * ⛔ **Χωρίς συνημμένα** (§3 σύγκλιση · Α5) και **χωρίς στοιχεία μερών** (τηλέφωνα/email/ονόματα): ένα προωθημένο
 *    email δεν λέει σε τρίτον ποιος αγοράζει ποιο σπίτι (ADR-742) — τα μέρη φαίνονται μέσα στην υπόθεση.
 */

import 'server-only';

import { HUMAN_LANGUAGES, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { caseInvitationHref } from '@/lib/conveyance/conveyance-routes';
import { publicUrl } from '@/lib/http/public-origin';
import { formatOperatorDate } from '@/lib/operator-time-format';
import type { EngagementInvitationChecklist } from '@/types/engagement-invitation';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

import { escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import {
  composeInvitationEmail,
  invitationDetailLine,
  type InvitationEmailCoreWording,
  type InvitationEmailLine,
} from './invitation-email-shared';

interface EngagementInvitationWording extends InvitationEmailCoreWording {
  /** ⚠️ Το θέμα λέει **ρόλο και ακίνητο**: τα εισερχόμενα ενός δικηγόρου διαβάζονται χωρίς να ανοιχτούν. */
  readonly subject: (role: string, property: string) => string;
  readonly heading: string;
  /** Τα ορίσματα είναι είτε ωμό κείμενο είτε **ήδη ασφαλές HTML** — ο renderer αποφασίζει. */
  readonly intro: (host: string, role: string, property: string) => string;
  readonly roles: Readonly<Record<LegalProfessionalRole, string>>;
  readonly asked: Readonly<Record<LegalProfessionalRole, string>>;
  readonly askedLabel: string;
  readonly findLabel: string;
  readonly find: (checklist: EngagementInvitationChecklist) => string;
  readonly noAccount: string;
  readonly expiresLabel: string;
  readonly unnamedHost: string;
  readonly unnamedProperty: string;
}

/** ⚠️ `Record<HumanLanguage, …>`, ποτέ `Partial` — νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της. */
const TEXTS: Readonly<Record<HumanLanguage, EngagementInvitationWording>> = {
  el: {
    subject: (role, property) => `Ανάθεση: ${role} — ${property}`,
    heading: 'Σας αναθέτουν μια υπόθεση μεταβίβασης',
    intro: (host, role, property) => `${host} σας ορίζει ${role} στη μεταβίβαση του ακινήτου ${property}.`,
    roles: { seller_lawyer: 'δικηγόρο πωλητή', buyer_lawyer: 'δικηγόρο αγοραστή', notary: 'συμβολαιογράφο' },
    asked: {
      seller_lawyer: 'Έλεγχος τίτλων και δικαιολογητικών της πλευράς του πωλητή.',
      buyer_lawyer: 'Νομικός έλεγχος του ακινήτου για λογαριασμό του αγοραστή.',
      notary: 'Σύνταξη του συμβολαίου με βάση τα δικαιολογητικά της υπόθεσης.',
    },
    askedLabel: 'Τι σας ζητείται',
    findLabel: 'Τι θα βρείτε',
    find: ({ applicable, complete, missing }) =>
      `${applicable} δικαιολογητικά για τον ρόλο σας — ${complete} έτοιμα, ${missing} εκκρεμούν.`,
    noAccount:
      'Δεν έχετε λογαριασμό; Η εγγραφή με αυτό το email παίρνει περίπου 2 λεπτά· θα σας ζητηθεί ο αριθμός μητρώου σας.',
    expiresLabel: 'Ο σύνδεσμος λήγει στις',
    cta: 'Αποδοχή και πρόσβαση στην υπόθεση',
    onlyWord: 'μόνο',
    boundToAddress: (onlyHtml) =>
      `Ο σύνδεσμος λειτουργεί ${onlyHtml} για αυτή τη διεύθυνση email — μην τον προωθήσετε· για άλλον δεν θα δουλέψει.`,
    footnote:
      'Δεν αναλαμβάνετε; Ανοίξτε τον σύνδεσμο και πατήστε «Δεν αναλαμβάνω» — ο προσκαλών θα ενημερωθεί. '
      + 'Η αποδοχή δίνει πρόσβαση μόνο σε αυτή την υπόθεση, όχι στο γραφείο που σας καλεί.',
    unnamedHost: 'Ο οικοδεσπότης της υπόθεσης',
    unnamedProperty: 'της υπόθεσης',
  },
  en: {
    subject: (role, property) => `Appointment: ${role} — ${property}`,
    heading: 'You are being appointed to a conveyance case',
    intro: (host, role, property) => `${host} appoints you as ${role} for the conveyance of the property ${property}.`,
    roles: { seller_lawyer: "the seller's lawyer", buyer_lawyer: "the buyer's lawyer", notary: 'the notary' },
    asked: {
      seller_lawyer: "Review of the title and the seller's documents.",
      buyer_lawyer: 'Legal due diligence on the property on behalf of the buyer.',
      notary: "Drafting the deed based on the case's documents.",
    },
    askedLabel: 'What is asked of you',
    findLabel: 'What you will find',
    find: ({ applicable, complete, missing }) =>
      `${applicable} documents for your role — ${complete} ready, ${missing} pending.`,
    noAccount:
      'No account? Signing up with this email takes about 2 minutes; you will be asked for your registry number.',
    expiresLabel: 'The link expires on',
    cta: 'Accept and open the case',
    onlyWord: 'only',
    boundToAddress: (onlyHtml) =>
      `The link works ${onlyHtml} for this email address — do not forward it; it will not work for anyone else.`,
    footnote:
      'Not taking it on? Open the link and press “I decline” — the person who invited you will be told. '
      + 'Accepting gives access to this case only, not to the inviting office.',
    unnamedHost: 'The case host',
    unnamedProperty: 'in the case',
  },
};

export interface EngagementInvitationEmailInput {
  /** Η γλώσσα του παραλήπτη — από **δεδομένα**, άρα `unknown` (άγνωστη ⇒ προεπιλογή). */
  readonly language: unknown;
  readonly role: LegalProfessionalRole;
  readonly hostName: string | null;
  readonly propertyLabel: string | null;
  /** `null` ⇒ ο κατάλογος δεν διαβάστηκε — η γραμμή **παραλείπεται**, ποτέ ψεύτικο «0». */
  readonly checklist: EngagementInvitationChecklist | null;
  /** Η λήξη του **συνδέσμου**. */
  readonly expiresAt: string;
  /** Το **ωμό** token — μόνο στην επιστροφή της έκδοσης και **εδώ**. */
  readonly token: string;
}

function detailsOf(input: EngagementInvitationEmailInput, w: EngagementInvitationWording, language: HumanLanguage): InvitationEmailLine[] {
  const lines: InvitationEmailLine[] = [invitationDetailLine(w.askedLabel, w.asked[input.role])];
  if (input.checklist !== null) lines.push(invitationDetailLine(w.findLabel, w.find(input.checklist)));
  lines.push(invitationDetailLine(w.expiresLabel, formatOperatorDate(input.expiresAt, language)));
  lines.push({ html: escapeHtml(w.noAccount), text: w.noAccount });
  return lines;
}

/** **Το email, στη γλώσσα του παραλήπτη.** `null` ⇒ χωρίς δημόσια διεύθυνση — ποτέ σύνδεσμος που δεν οδηγεί πουθενά. */
export function buildEngagementInvitationEmail(input: EngagementInvitationEmailInput): ConfirmationEmailResult | null {
  const link = publicUrl(caseInvitationHref(input.token));
  if (link === null) return null;

  const language = resolveHumanLanguage(input.language);
  const w = TEXTS[language];
  const host = input.hostName?.trim() || w.unnamedHost;
  const property = input.propertyLabel?.trim() || w.unnamedProperty;
  const role = w.roles[input.role];

  return composeInvitationEmail({
    language,
    subject: w.subject(role, property),
    heading: w.heading,
    intro: {
      html: w.intro(`<strong>${escapeHtml(host)}</strong>`, escapeHtml(role), `<strong>${escapeHtml(property)}</strong>`),
      text: w.intro(host, role, property),
    },
    details: detailsOf(input, w, language),
    link,
    core: w,
  });
}

/** **Έχει κάθε γλώσσα ΟΛΑ τα λόγια της;** — άγκυρα που **εκτελείται**, και ελέγχει και τις συναρτήσεις. */
export function everyLanguageHasEngagementInvitationWording(): boolean {
  const sample: EngagementInvitationChecklist = { applicable: 3, complete: 1, missing: 2 };
  return HUMAN_LANGUAGES.every((language) => {
    const w = TEXTS[language];
    if (!w) return false;
    const texts = [
      w.subject('χ', 'ψ'), w.heading, w.intro('χ', 'ψ', 'ω'), ...Object.values(w.roles), ...Object.values(w.asked),
      w.askedLabel, w.findLabel, w.find(sample), w.noAccount, w.expiresLabel, w.cta, w.onlyWord,
      w.boundToAddress(w.onlyWord), w.footnote, w.unnamedHost, w.unnamedProperty,
    ];
    return texts.every((text) => typeof text === 'string' && text.length > 0);
  });
}
