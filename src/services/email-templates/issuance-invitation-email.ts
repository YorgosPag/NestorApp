/**
 * @fileoverview ADR-915 §28 — **τα μηνύματα της ανάθεσης έκδοσης**: έγκριση (υπεύθυνος) · ανάθεση (επαγγελματίας) ·
 *   ενημέρωση (συνιδιοκτήτης). Ο **ίδιος** συνθέτης χτίζει την προεπισκόπηση και το μήνυμα που φεύγει (§28 Η-Β7).
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
import elLegality from '@/i18n/locales/el/legality.json';
import elMarket from '@/i18n/locales/el/property-market.json';
import enConveyance from '@/i18n/locales/en/conveyance.json';
import enRegistry from '@/i18n/locales/en/document-registry.json';
import enLegality from '@/i18n/locales/en/legality.json';
import enMarket from '@/i18n/locales/en/property-market.json';
import type { IssuanceCredential } from '@/lib/document-validity/issuance-assignment';
import { formatOperatorDate } from '@/lib/operator-time-format';

import { escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import { composeInvitationEmail, composeNoticeEmail, invitationDetailLine, type InvitationEmailLine } from './invitation-email-shared';
import { ISSUANCE_EMAIL_TEXTS, type IssuanceEmailWording } from './issuance-invitation-email-texts';

/** Οι ονομασίες, ανά γλώσσα, από τα **ίδια** locale της οθόνης. */
const LABELS: Readonly<Record<HumanLanguage, BundleTranslate>> = {
  el: createBundleTranslate({ [REGISTRY_NS]: elRegistry, conveyance: elConveyance, legality: elLegality, 'property-market': elMarket }, REGISTRY_NS, 'el'),
  en: createBundleTranslate({ [REGISTRY_NS]: enRegistry, conveyance: enConveyance, legality: enLegality, 'property-market': enMarket }, REGISTRY_NS, 'en'),
};

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

export type IssuanceEmailInput =
  | { readonly kind: 'approval'; readonly language: unknown; readonly facts: IssuanceEmailFacts; readonly coOwnerNames: readonly string[]; readonly expiresAt: string; readonly link: string }
  | { readonly kind: 'professional'; readonly language: unknown; readonly facts: IssuanceEmailFacts; readonly expiresAt: string; readonly link: string }
  | { readonly kind: 'co-owner'; readonly language: unknown; readonly facts: IssuanceEmailFacts; readonly leadName: string | null };

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

function approvalDetails(named: Named, input: Extract<IssuanceEmailInput, { kind: 'approval' }>): InvitationEmailLine[] {
  const { w, language } = named;
  const { credential } = input.facts;
  const qualification = qualificationText(LABELS[language], credential.qualification);
  const credentialText = credential.registryNumber === null ? qualification : w.approval.registryNumber(qualification, credential.registryNumber);
  return [
    invitationDetailLine(w.approval.professionalLabel, named.professional),
    invitationDetailLine(w.approval.credentialLabel, credentialText),
    ...noteLine(named, input.facts.note),
    ...(input.coOwnerNames.length === 0 ? [] : [invitationDetailLine(w.approval.coOwnersLabel, input.coOwnerNames.join(', '))]),
    invitationDetailLine(w.approval.expiresLabel, formatOperatorDate(input.expiresAt, language)),
  ];
}

/** **Το μήνυμα, στη γλώσσα του παραλήπτη.** Ο σύνδεσμος έρχεται έτοιμος (απόλυτος) από τον καλούντα. */
export function buildIssuanceEmail(input: IssuanceEmailInput): ConfirmationEmailResult {
  const named = namedOf(input);
  const { w, language, office, property, document, professional } = named;
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
      language, subject: w.approval.subject(document, property), heading: w.approval.heading,
      intro: lineOf(w.approval.intro, [office, professional, document, property]),
      details: approvalDetails(named, input), link: input.link, core: w.approval,
    });
  }
  return composeInvitationEmail({
    language, subject: w.professional.subject(document, property), heading: w.professional.heading,
    intro: lineOf(w.professional.intro, [office, document, property]),
    details: [...noteLine(named, input.facts.note), invitationDetailLine(w.professional.expiresLabel, formatOperatorDate(input.expiresAt, language))],
    link: input.link, core: w.professional,
  });
}
