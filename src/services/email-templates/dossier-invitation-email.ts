/**
 * @fileoverview **«ΣΑΣ ΔΙΝΟΥΝ ΠΡΟΣΒΑΣΗ ΣΤΟΝ ΦΑΚΕΛΟ ΕΝΟΣ ΑΚΙΝΗΤΟΥ»** — το email της πρόσκλησης φακέλου ιδιώτη (ADR-916 Φ-Ε1).
 * @module services/email-templates/dossier-invitation-email
 * @related ADR-853 §20 (η ΜΙΑ μηχανή) · `invitation-email-shared.ts` (ο ΚΟΙΝΟΣ σκελετός) · `engagement-invitation-email.ts`
 *          (ο αδελφός της μεταβίβασης)
 *
 * @note Οι ελληνικές/αγγλικές συμβολοσειρές εδώ **ΔΕΝ** είναι παράβαση του N.11: τα server-side πρότυπα email
 *       φέρουν το κείμενό τους inline by design (δες `server/comms/email-texts.ts`). Η γλώσσα είναι **παράμετρος**.
 *
 * 🔑 Ό,τι λέει: ποιος ρόλος → ποιος φάκελος → **ποιες καρτέλες** (το εύρος, ποτέ ονόματα αρχείων) → για πόσες ημέρες
 *    → σκοπός (ΓΚΠΔ) → κουμπί → ασφάλεια → «δεν το αναλαμβάνω».
 * ⛔ Κανένα όνομα, τηλέφωνο ή email του κατόχου, κανένα συνημμένο: ένα προωθημένο email δεν αποκαλύπτει σε τρίτον τίποτα.
 * ⚖️ Η διατύπωση του **σκοπού** (`purpose`) είναι **προς νομικό έλεγχο πριν την παραγωγή** — όπως το `purposeNotice`
 *    του ADR-942 Φ2.
 */

import 'server-only';

import type { DossierShareDays } from '@/config/engagement-policy';
import type { PropertyDossierFileTab } from '@/config/upload-entry-points/entries-property-dossier';
import { HUMAN_LANGUAGES, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { caseInvitationHref } from '@/lib/conveyance/conveyance-routes';
import { publicUrl } from '@/lib/http/public-origin';
import { formatOperatorDate } from '@/lib/operator-time-format';
import { dossierTabWord, type DossierTabWord, type FloorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
import type { DossierEngagementRole } from '@/types/engagement';

import { escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import {
  composeInvitationEmail,
  emphasizedInvitationLine,
  invitationDetailLine,
  type InvitationEmailCoreWording,
  type InvitationEmailLine,
} from './invitation-email-shared';

interface DossierInvitationWording extends InvitationEmailCoreWording {
  readonly subject: (role: string, dossier: string) => string;
  readonly heading: string;
  /** Τα ορίσματα είναι είτε ωμό κείμενο είτε **ήδη ασφαλές HTML** — ο renderer αποφασίζει. */
  readonly intro: (role: string, dossier: string) => string;
  readonly roles: Readonly<Record<DossierEngagementRole, string>>;
  /** Ανά **λέξη** καρτέλας (`dossierTabWord`): η κάτοψη σε οικόπεδο λέγεται «Τοπογραφικό», όπως στη σελίδα του κατόχου. */
  readonly tabs: Readonly<Record<DossierTabWord, string>>;
  readonly tabsLabel: string;
  readonly durationLabel: string;
  readonly duration: (days: DossierShareDays) => string;
  readonly purposeLabel: string;
  readonly purpose: string;
  readonly noAccount: string;
  readonly expiresLabel: string;
  readonly unnamedDossier: string;
}

/** ⚠️ `Record<HumanLanguage, …>`, ποτέ `Partial` — νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της. */
const TEXTS: Readonly<Record<HumanLanguage, DossierInvitationWording>> = {
  el: {
    subject: (role, dossier) => `Πρόσβαση ως ${role} — ${dossier}`,
    heading: 'Σας δίνουν πρόσβαση στον φάκελο ενός ακινήτου',
    intro: (role, dossier) => `Ο κάτοχος του φακέλου ${dossier} σας καλεί ως ${role}.`,
    roles: { owner_lawyer: 'δικηγόρο του ιδιοκτήτη', notary: 'συμβολαιογράφο' },
    tabs: { floorplan: 'Κάτοψη', topographic: 'Τοπογραφικό', documents: 'Έγγραφα', photos: 'Φωτογραφίες', videos: 'Βίντεο' },
    tabsLabel: 'Τι θα δείτε',
    durationLabel: 'Διάρκεια πρόσβασης',
    duration: (days) => `${days} ημέρες από την αποδοχή — ο κάτοχος μπορεί να την ανακαλέσει οποτεδήποτε.`,
    purposeLabel: 'Σκοπός',
    purpose: 'Νομικός έλεγχος του ακινήτου για λογαριασμό του κατόχου. Κάθε άνοιγμα και λήψη καταγράφεται και το βλέπει ο κάτοχος.',
    noAccount:
      'Δεν έχετε λογαριασμό; Η εγγραφή με αυτό το email παίρνει περίπου 2 λεπτά· θα σας ζητηθεί ο αριθμός μητρώου σας.',
    expiresLabel: 'Ο σύνδεσμος λήγει στις',
    cta: 'Αποδοχή και πρόσβαση στον φάκελο',
    onlyWord: 'μόνο',
    boundToAddress: (onlyHtml) =>
      `Ο σύνδεσμος λειτουργεί ${onlyHtml} για αυτή τη διεύθυνση email — μην τον προωθήσετε· για άλλον δεν θα δουλέψει.`,
    footnote:
      'Δεν το αναλαμβάνετε; Ανοίξτε τον σύνδεσμο και πατήστε «Δεν αναλαμβάνω». '
      + 'Η αποδοχή δίνει πρόσβαση μόνο στα παραπάνω αρχεία αυτού του φακέλου, τίποτε άλλο.',
    unnamedDossier: 'του ακινήτου',
  },
  en: {
    subject: (role, dossier) => `Access as ${role} — ${dossier}`,
    heading: 'You are being given access to a property file',
    intro: (role, dossier) => `The owner of the property file ${dossier} invites you as ${role}.`,
    roles: { owner_lawyer: "the owner's lawyer", notary: 'the notary' },
    tabs: { floorplan: 'Floor plan', topographic: 'Site survey', documents: 'Documents', photos: 'Photos', videos: 'Videos' },
    tabsLabel: 'What you will see',
    durationLabel: 'Access period',
    duration: (days) => `${days} days from acceptance — the owner can revoke it at any time.`,
    purposeLabel: 'Purpose',
    purpose: "Legal review of the property on the owner's behalf. Every view and download is logged and visible to the owner.",
    noAccount:
      'No account? Signing up with this email takes about 2 minutes; you will be asked for your registry number.',
    expiresLabel: 'The link expires on',
    cta: 'Accept and open the file',
    onlyWord: 'only',
    boundToAddress: (onlyHtml) =>
      `The link works ${onlyHtml} for this email address — do not forward it; it will not work for anyone else.`,
    footnote:
      'Not taking it on? Open the link and press “I decline”. '
      + 'Accepting gives access only to the files above in this property file, nothing else.',
    unnamedDossier: 'of the property',
  },
};

export interface DossierInvitationEmailInput {
  /** Η γλώσσα του παραλήπτη — από **δεδομένα**, άρα `unknown` (άγνωστη ⇒ προεπιλογή). */
  readonly language: unknown;
  readonly role: DossierEngagementRole;
  /** `null` ⇒ ο φάκελος δεν διαβάστηκε — λέξη αντί για όνομα, ποτέ κενό. */
  readonly dossierLabel: string | null;
  readonly tabs: readonly PropertyDossierFileTab[];
  /** Η απάντηση του κριτή `floorplanTabKind` για **αυτόν** τον φάκελο — η πρόσκληση δεν μαντεύει το είδος. */
  readonly floorplanKind: FloorplanTabKind;
  readonly shareDays: DossierShareDays;
  /** Η λήξη του **συνδέσμου**. */
  readonly expiresAt: string;
  /** Το **ωμό** token — μόνο στην επιστροφή της έκδοσης και **εδώ**. */
  readonly token: string;
}

function detailsOf(input: DossierInvitationEmailInput, w: DossierInvitationWording, language: HumanLanguage): InvitationEmailLine[] {
  return [
    invitationDetailLine(w.tabsLabel, input.tabs.map((tab) => w.tabs[dossierTabWord(tab, input.floorplanKind)]).join(' · ')),
    invitationDetailLine(w.durationLabel, w.duration(input.shareDays)),
    invitationDetailLine(w.purposeLabel, w.purpose),
    invitationDetailLine(w.expiresLabel, formatOperatorDate(input.expiresAt, language)),
    { html: escapeHtml(w.noAccount), text: w.noAccount },
  ];
}

/** **Το email, στη γλώσσα του παραλήπτη.** `null` ⇒ χωρίς δημόσια διεύθυνση — ποτέ σύνδεσμος που δεν οδηγεί πουθενά. */
export function buildDossierInvitationEmail(input: DossierInvitationEmailInput): ConfirmationEmailResult | null {
  const link = publicUrl(caseInvitationHref(input.token));
  if (link === null) return null;
  const language = resolveHumanLanguage(input.language);
  const w = TEXTS[language];
  const dossier = input.dossierLabel?.trim() || w.unnamedDossier;
  const role = w.roles[input.role];
  return composeInvitationEmail({
    language,
    subject: w.subject(role, dossier),
    heading: w.heading,
    intro: emphasizedInvitationLine(w.intro, [{ plain: role }, dossier]),
    details: detailsOf(input, w, language),
    link,
    core: w,
  });
}

/** **Έχει κάθε γλώσσα ΟΛΑ τα λόγια της;** — άγκυρα που **εκτελείται**, και ελέγχει και τις συναρτήσεις. */
export function everyLanguageHasDossierInvitationWording(): boolean {
  return HUMAN_LANGUAGES.every((language) => {
    const w = TEXTS[language];
    if (!w) return false;
    const texts = [
      w.subject('χ', 'ψ'), w.heading, w.intro('χ', 'ψ'), ...Object.values(w.roles), ...Object.values(w.tabs),
      w.tabsLabel, w.durationLabel, w.duration(30), w.purposeLabel, w.purpose, w.noAccount, w.expiresLabel,
      w.cta, w.onlyWord, w.boundToAddress(w.onlyWord), w.footnote, w.unnamedDossier,
    ];
    return texts.every((text) => typeof text === 'string' && text.length > 0);
  });
}
