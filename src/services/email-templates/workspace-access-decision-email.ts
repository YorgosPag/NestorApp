/**
 * @fileoverview **«ΑΠΑΝΤΗΘΗΚΕ ΤΟ ΑΙΤΗΜΑ ΣΑΣ»** — email προς τον αιτούντα, στη γλώσσα του (ADR-660 §6).
 * @module services/email-templates/workspace-access-decision-email
 *
 * 🏆 Slack · GitHub · Atlassian ενημερώνουν τον αιτούντα **και** για την έγκριση **και** για
 * την απόρριψη. Χωρίς αυτό, η οθόνη αναμονής θα έλεγε «θα ειδοποιηθείτε» (υπόσχεση που ήδη
 * δίνει — `auth.pendingApproval.body`) και **κανείς δεν θα την τηρούσε**.
 *
 * ⚠️ Η απόρριψη **δεν** ονομάζει τον διαχειριστή ούτε λόγο: το αίτημα απαντήθηκε από το
 * γραφείο, όχι από πρόσωπο — και ένας λόγος σε ελεύθερο κείμενο είναι πρόσκληση διαφωνίας
 * μέσω email αντί για επικοινωνία με το γραφείο.
 */

import 'server-only';

import { HUMAN_LANGUAGES, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { publicUrl } from '@/lib/http/public-origin';
import { AUTH_ROUTES, PRIVATE_SPACE_HOME } from '@/lib/routes';
import { brandedSubject } from '@/server/comms/email-texts';
import type { WorkspaceAccessDecision } from '@/types/workspace-access-request';

import { escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import { messagePlainText, renderMessageSection, wrapInAppFrame } from './app-message-email';
import { isCompleteWording, type AppMessageWording } from './app-message-wording';

/** ⚠️ `Record<HumanLanguage, …>` — τρίτη γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της. */
const DECISION_TEXTS: Readonly<Record<HumanLanguage, Readonly<Record<WorkspaceAccessDecision, AppMessageWording>>>> = {
  el: {
    approved: {
      subject: 'Εγκρίθηκε η πρόσβασή σας στο γραφείο',
      heading: 'Εγκρίθηκε η πρόσβασή σας',
      intro: (address) => `Το αίτημα πρόσβασης του λογαριασμού ${address} στον χώρο εργασίας του γραφείου εγκρίθηκε.`,
      cta: 'Άνοιγμα χώρου εργασίας',
      footnote: 'Αν δεν βλέπετε ακόμη τον χώρο, αποσυνδεθείτε και συνδεθείτε ξανά.',
    },
    denied: {
      subject: 'Το αίτημα πρόσβασης δεν εγκρίθηκε',
      heading: 'Το αίτημα πρόσβασης δεν εγκρίθηκε',
      intro: (address) => `Το αίτημα πρόσβασης του λογαριασμού ${address} στον χώρο εργασίας του γραφείου δεν εγκρίθηκε. `
        + 'Ο προσωπικός σας χώρος παραμένει διαθέσιμος.',
      cta: 'Στον χώρο μου',
      footnote: 'Αν πιστεύετε ότι πρόκειται για λάθος, επικοινωνήστε απευθείας με το γραφείο.',
    },
  },
  en: {
    approved: {
      subject: 'Your access to the office was approved',
      heading: 'Your access was approved',
      intro: (address) => `The access request of the account ${address} to the office workspace was approved.`,
      cta: 'Open workspace',
      footnote: 'If you do not see the workspace yet, sign out and sign in again.',
    },
    denied: {
      subject: 'Your access request was not approved',
      heading: 'Your access request was not approved',
      intro: (address) => `The access request of the account ${address} to the office workspace was not approved. `
        + 'Your personal space remains available.',
      cta: 'Go to my space',
      footnote: 'If you believe this is a mistake, contact the office directly.',
    },
  },
};

/** Πού οδηγεί το κουμπί: στον χώρο εργασίας (έγκριση) ή στον **δικό του** χώρο (απόρριψη). */
const DECISION_DESTINATION: Readonly<Record<WorkspaceAccessDecision, string>> = {
  approved: AUTH_ROUTES.home,
  denied: PRIVATE_SPACE_HOME,
};

/**
 * @returns `null` χωρίς δημόσια διεύθυνση — **κανένα** email με σύνδεσμο που δεν ξέρουμε πού οδηγεί.
 */
export function buildWorkspaceAccessDecisionEmail(input: {
  readonly decision: WorkspaceAccessDecision;
  readonly language: unknown;
  readonly address: string;
}): ConfirmationEmailResult | null {
  const link = publicUrl(DECISION_DESTINATION[input.decision]);
  if (link === null) return null;

  const language = resolveHumanLanguage(input.language);
  const wording = DECISION_TEXTS[language][input.decision];
  const addressHtml = `<strong>${escapeHtml(input.address)}</strong>`;
  return {
    subject: brandedSubject(language, wording.subject),
    html: wrapInAppFrame(renderMessageSection(wording, addressHtml, link, null), language),
    text: messagePlainText(wording, input.address, link, language),
  };
}

/** Άγκυρα που **εκτελείται** (N.17): κάθε γλώσσα, κάθε απόφαση, όλα τα λόγια. */
export function everyLanguageHasDecisionWording(): boolean {
  return HUMAN_LANGUAGES.every((language) =>
    (['approved', 'denied'] as const).every((decision) => isCompleteWording(DECISION_TEXTS[language]?.[decision])),
  );
}
