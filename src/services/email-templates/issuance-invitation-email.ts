/**
 * @fileoverview ADR-915 §28 — **τα μηνύματα της ανάθεσης έκδοσης**: έγκριση (υπεύθυνος) · ανάθεση (επαγγελματίας) ·
 *   ενημέρωση (συνιδιοκτήτης) · §30 απόδειξη απάντησης · §31 υπενθύμιση (το **ίδιο** μήνυμα, με δικό του θέμα). Ο **ίδιος** συνθέτης χτίζει την προεπισκόπηση και το μήνυμα που φεύγει (§28 Η-Β7).
 * @related issuance-invitation-email-texts.ts (τα λόγια) · invitation-email-shared.ts (ο σκελετός) ·
 *   server/issuance-invitations/issuance-invitation-send.ts (ο καλών)
 * @module services/email-templates/issuance-invitation-email
 *
 * 🔑 **Οι ονομασίες από τα κλειδιά της οθόνης**: έγγραφο (`DOCUMENT_KIND_LABEL_KEYS`) και προσόν (`qualificationText`) —
 *    ό,τι βλέπει το γραφείο, το διαβάζει και ο ιδιοκτήτης.
 * 🔒 **Ελαχιστοποίηση** (§28 Η-Β11): ονόματα μόνο — ποτέ email, τηλέφωνο ή ΑΦΜ τρίτων. Οι συνιδιοκτήτες **ονομάζονται**
 *    στον υπεύθυνο (ξέρει ποιος ενημερώθηκε), αλλά καμία διεύθυνση δεν ταξιδεύει (ποτέ cc).
 */

import 'server-only';

import { DOCUMENT_KIND_LABEL_KEYS, qualificationText, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import { resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import elConveyance from '@/i18n/locales/el/conveyance.json';
import elRegistry from '@/i18n/locales/el/document-registry.json';
import elRequest from '@/i18n/locales/el/document-request.json';
import elLegality from '@/i18n/locales/el/legality.json';
import elMarket from '@/i18n/locales/el/property-market.json';
import enConveyance from '@/i18n/locales/en/conveyance.json';
import enRegistry from '@/i18n/locales/en/document-registry.json';
import enRequest from '@/i18n/locales/en/document-request.json';
import enLegality from '@/i18n/locales/en/legality.json';
import enMarket from '@/i18n/locales/en/property-market.json';
import type { IssuanceCredential, LinkVerification } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceLinkAnswer } from '@/lib/document-validity/issuance-request';
import { formatOperatorDate, formatOperatorDateTime } from '@/lib/operator-time-format';

import { escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import { composeInvitationEmail, composeNoticeEmail, invitationDetailLine, type InvitationEmailLine } from './invitation-email-shared';
import { ISSUANCE_EMAIL_TEXTS, type IssuanceEmailWording } from './issuance-invitation-email-texts';

/** Οι ονομασίες, ανά γλώσσα, από τα **ίδια** locale της οθόνης. */
const LABELS: Readonly<Record<HumanLanguage, BundleTranslate>> = {
  el: createBundleTranslate({ [REGISTRY_NS]: elRegistry, conveyance: elConveyance, legality: elLegality, 'property-market': elMarket, 'document-request': elRequest }, REGISTRY_NS, 'el'),
  en: createBundleTranslate({ [REGISTRY_NS]: enRegistry, conveyance: enConveyance, legality: enLegality, 'property-market': enMarket, 'document-request': enRequest }, REGISTRY_NS, 'en'),
};

/** §31 — το κουμπί άρνησης της σελίδας-συνδέσμου, από το **ίδιο** locale: η υπενθύμιση λέει ό,τι θα δει ο άνθρωπος. */
const DECLINE_BUTTON_KEYS = {
  approval: 'document-request:owner.reject',
  professional: 'document-request:professional.decline',
} as const;

/** Ό,τι λέει **κάθε** μήνυμα της ανάθεσης — διαβασμένο από τον διακομιστή, ποτέ από το αίτημα. */
export interface IssuanceEmailFacts {
  readonly officeName: string | null;
  readonly propertyLabel: string | null;
  readonly documentKind: DocumentKind;
  readonly professionalName: string | null;
  readonly credential: IssuanceCredential;
  /** Η σημείωση του γραφείου από το πρόχειρο — κείμενο ανθρώπου, πάντα escaped. */
  readonly note: string | null;
}

/** §31 — το μήνυμα είναι **υπενθύμιση** του αιτήματος που έφυγε στις `firstSentAt`· `null` = το ίδιο το αίτημα. */
export type IssuanceEmailReminder = { readonly firstSentAt: string } | null;

export type IssuanceEmailInput =
  /** `accessCode` (§29): ο σύνδεσμος ζητά και κωδικό — το email λέει **πώς** τον παίρνει, ποτέ τον ίδιο. */
  | { readonly kind: 'approval'; readonly language: unknown; readonly facts: IssuanceEmailFacts; readonly coOwnerNames: readonly string[]; readonly expiresAt: string; readonly link: string; readonly accessCode: boolean; readonly reminder: IssuanceEmailReminder }
  | { readonly kind: 'professional'; readonly language: unknown; readonly facts: IssuanceEmailFacts; readonly expiresAt: string; readonly link: string; readonly accessCode: boolean; readonly reminder: IssuanceEmailReminder }
  | { readonly kind: 'co-owner'; readonly language: unknown; readonly facts: IssuanceEmailFacts; readonly leadName: string | null }
  /** §30 — η απόδειξη απάντησης: τι, πότε, πώς αποδείχθηκε· `comment` = το σχόλιο του ίδιου (κείμενο ανθρώπου, escaped). */
  | {
    readonly kind: 'receipt'; readonly language: unknown; readonly facts: IssuanceEmailFacts; readonly answer: IssuanceLinkAnswer;
    readonly answeredAt: string; readonly verifiedBy: LinkVerification; readonly comment: string | null;
  };

interface Named {
  readonly language: HumanLanguage;
  readonly w: IssuanceEmailWording;
  readonly office: string;
  readonly property: string;
  readonly document: string;
  readonly professional: string;
}

function namedOf(input: IssuanceEmailInput): Named {
  const language = resolveHumanLanguage(input.language);
  const w = ISSUANCE_EMAIL_TEXTS[language];
  const { facts } = input;
  return {
    language,
    w,
    office: facts.officeName?.trim() || w.unnamedOffice,
    property: facts.propertyLabel?.trim() || w.unnamedProperty,
    document: LABELS[language](DOCUMENT_KIND_LABEL_KEYS[facts.documentKind]),
    professional: facts.professionalName?.trim() || w.unnamedPerson,
  };
}

/** Ωμό κείμενο ή ασφαλές HTML από την **ίδια** φράση: οι τιμές τονίζονται, κάθε τιμή περνά από `escapeHtml`. */
function lineOf(phrase: (...values: string[]) => string, values: readonly string[]): InvitationEmailLine {
  return { html: phrase(...values.map((value) => `<strong>${escapeHtml(value)}</strong>`)), text: phrase(...values) };
}

function noteLine(named: Named, note: string | null): InvitationEmailLine[] {
  return note === null ? [] : [invitationDetailLine(named.w.noteLabel, note)];
}

/** §29 — η γραμμή «πώς παίρνω τον κωδικό», τελευταία πριν το κουμπί. §31: στην υπενθύμιση «αυτόν που σας είπε το γραφείο». */
function accessCodeLines(named: Named, accessCode: boolean, reminder: IssuanceEmailReminder): InvitationEmailLine[] {
  if (!accessCode) return [];
  return [invitationDetailLine(named.w.accessCode.label, reminder === null ? named.w.accessCode.howTo : named.w.reminder.accessCodeHowTo)];
}

type LinkEmailKind = keyof typeof DECLINE_BUTTON_KEYS;

/** §31 — πρώτη γραμμή της υπενθύμισης: πότε στάλθηκε το αίτημα. */
function reminderLead(named: Named, reminder: IssuanceEmailReminder): InvitationEmailLine[] {
  return reminder === null ? [] : [invitationDetailLine(named.w.reminder.sentLabel, formatOperatorDate(reminder.firstSentAt, named.language))];
}

/** §31 — τελευταία γραμμή της υπενθύμισης: πώς σταματούν (με την ετικέτα του κουμπιού της σελίδας). */
function reminderStop(named: Named, kind: LinkEmailKind, reminder: IssuanceEmailReminder): InvitationEmailLine[] {
  if (reminder === null) return [];
  const button = LABELS[named.language](DECLINE_BUTTON_KEYS[kind]);
  return [invitationDetailLine(named.w.reminder.stopLabel, named.w.reminder.stop(button))];
}

/** §31 — θέμα και επικεφαλίδα: η υπενθύμιση **λέει** ότι είναι υπενθύμιση, από το θέμα κιόλας. */
function framingOf(named: Named, kind: LinkEmailKind, subject: string, heading: string, reminder: IssuanceEmailReminder): { readonly subject: string; readonly heading: string } {
  return reminder === null ? { subject, heading } : { subject: named.w.reminder.subject(subject), heading: named.w.reminder.heading[kind] };
}

/** Η γραμμή προώθησης του σκελετού — με κωδικό, «όποιος τον έχει απαντά» θα ήταν ψέμα. */
function coreOf<T extends { readonly boundToAddress: (onlyHtml: string) => string }>(named: Named, wording: T, accessCode: boolean): T {
  return accessCode ? { ...wording, boundToAddress: named.w.accessCode.boundToAddress } : wording;
}

function approvalDetails(named: Named, input: Extract<IssuanceEmailInput, { kind: 'approval' }>): InvitationEmailLine[] {
  const { w, language } = named;
  const { credential } = input.facts;
  const qualification = qualificationText(LABELS[language], credential.qualification);
  const credentialText = credential.registryNumber === null ? qualification : w.approval.registryNumber(qualification, credential.registryNumber);
  return [
    ...reminderLead(named, input.reminder),
    invitationDetailLine(w.approval.professionalLabel, named.professional),
    invitationDetailLine(w.approval.credentialLabel, credentialText),
    ...noteLine(named, input.facts.note),
    ...(input.coOwnerNames.length === 0 ? [] : [invitationDetailLine(w.approval.coOwnersLabel, input.coOwnerNames.join(', '))]),
    invitationDetailLine(w.approval.expiresLabel, formatOperatorDate(input.expiresAt, language)),
    ...accessCodeLines(named, input.accessCode, input.reminder),
    ...reminderStop(named, 'approval', input.reminder),
  ];
}

/** §30 — η απόδειξη: χωρίς κουμπί και χωρίς σύνδεσμο (τίποτα να «πατηθεί» από όποιον κι αν τη διαβάσει). */
function receiptEmail(named: Named, input: Extract<IssuanceEmailInput, { kind: 'receipt' }>): ConfirmationEmailResult {
  const { w, language, office, property, document, professional } = named;
  return composeNoticeEmail({
    language, subject: w.receipt.subject(document, property), heading: w.receipt.heading,
    intro: lineOf(w.receipt.intro[input.answer], [document, property, professional]),
    details: [
      invitationDetailLine(w.receipt.recordedAtLabel, formatOperatorDateTime(input.answeredAt, language)),
      invitationDetailLine(w.receipt.verifiedLabel, input.verifiedBy === 'access-code' ? w.receipt.verifiedByCode : w.receipt.verifiedByLink),
      ...(input.comment === null ? [] : [invitationDetailLine(w.receipt.commentLabel, input.comment)]),
      invitationDetailLine(w.receipt.notYouLabel, w.receipt.notYou(office)),
    ],
    footnote: w.receipt.footnote,
  });
}

/** **Το μήνυμα, στη γλώσσα του παραλήπτη.** Ο σύνδεσμος έρχεται έτοιμος (απόλυτος) από τον καλούντα. */
export function buildIssuanceEmail(input: IssuanceEmailInput): ConfirmationEmailResult {
  const named = namedOf(input);
  const { w, language, office, property, document, professional } = named;
  if (input.kind === 'receipt') return receiptEmail(named, input);
  if (input.kind === 'co-owner') {
    const lead = input.leadName?.trim() || w.unnamedPerson;
    return composeNoticeEmail({
      language, subject: w.coOwner.subject(document, property), heading: w.coOwner.heading,
      intro: lineOf(w.coOwner.intro, [office, professional, document, property, lead]),
      details: noteLine(named, input.facts.note), footnote: w.coOwner.footnote,
    });
  }
  if (input.kind === 'approval') {
    return composeInvitationEmail({
      language, ...framingOf(named, 'approval', w.approval.subject(document, property), w.approval.heading, input.reminder),
      intro: lineOf(w.approval.intro, [office, professional, document, property]),
      details: approvalDetails(named, input), link: input.link, core: coreOf(named, w.approval, input.accessCode),
    });
  }
  return composeInvitationEmail({
    language, ...framingOf(named, 'professional', w.professional.subject(document, property), w.professional.heading, input.reminder),
    intro: lineOf(w.professional.intro, [office, document, property]),
    details: [
      ...reminderLead(named, input.reminder),
      ...noteLine(named, input.facts.note),
      invitationDetailLine(w.professional.expiresLabel, formatOperatorDate(input.expiresAt, language)),
      ...accessCodeLines(named, input.accessCode, input.reminder),
      ...reminderStop(named, 'professional', input.reminder),
    ],
    link: input.link, core: coreOf(named, w.professional, input.accessCode),
  });
}
