/**
 * @fileoverview **ΤΑ EMAIL ΛΟΓΑΡΙΑΣΜΟΥ** — δικά μας ανά γλώσσα, και τα πρότυπα της Firebase (ADR-851).
 * @module services/email-templates/auth-action-email
 *
 * 🔑 **ΕΝΑ σχήμα, δύο έξοδοι** (`app-message-email.ts`):
 * - το **δικό μας** μήνυμα σε **μία** γλώσσα, με πραγματική διεύθυνση και σύνδεσμο·
 * - το πρότυπο της **Firebase** με **όλες** τις γλώσσες και placeholders, γιατί η Firebase
 *   δεν έχει εκδοχή προτύπου ανά γλώσσα.
 * Άρα ο άνθρωπος βλέπει **την ίδια** ταυτότητα, είτε το email το έστειλε ο διακομιστής μας
 * είτε η Firebase — και μια αλλαγή λόγων γίνεται **μία** φορά (`auth-action-email-texts.ts`).
 */

import 'server-only';

import { DEFAULT_LANGUAGE, HUMAN_LANGUAGES, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { brandedSubject } from '@/server/comms/email-texts';

import { BRAND, escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import { messagePlainText, renderMessageSection, wrapInAppFrame } from './app-message-email';
import { authActionWordingFor, type AuthActionEmailKind } from './auth-action-email-texts';

/** Τα placeholders της Firebase — τα ονόματα της κονσόλας, αυτολεξεί. */
export const FIREBASE_TEMPLATE_PLACEHOLDERS = {
  link: '%LINK%',
  email: '%EMAIL%',
  newEmail: '%NEW_EMAIL%',
} as const;

/**
 * **Ποια διεύθυνση ονομάζει κάθε μήνυμα.** Η ειδοποίηση αλλαγής πηγαίνει στην **παλιά**
 * διεύθυνση και ονομάζει τη **νέα** — αλλιώς ο άνθρωπος δεν μαθαίνει ποιος πήρε τον λογαριασμό.
 */
const FIREBASE_ADDRESS_PLACEHOLDER: Readonly<Record<AuthActionEmailKind, string>> = {
  resetPassword: FIREBASE_TEMPLATE_PLACEHOLDERS.email,
  verifyEmail: FIREBASE_TEMPLATE_PLACEHOLDERS.email,
  changeEmail: FIREBASE_TEMPLATE_PLACEHOLDERS.newEmail,
};

export interface AuthActionEmailInput {
  readonly kind: AuthActionEmailKind;
  /** Η γλώσσα του παραλήπτη — από **δεδομένα**, άρα `unknown` (άγνωστη ⇒ προεπιλογή). */
  readonly language: unknown;
  /** Η διεύθυνση που ονομάζει το μήνυμα. */
  readonly address: string;
  /** Ο σύνδεσμος πράξης — από το `publicUrl()`, ποτέ από την κονσόλα. */
  readonly link: string;
}

/** **Το δικό μας email**, στη γλώσσα του παραλήπτη. */
export function buildAuthActionEmail(input: AuthActionEmailInput): ConfirmationEmailResult {
  const language = resolveHumanLanguage(input.language);
  const wording = authActionWordingFor(language, input.kind);
  const addressHtml = `<strong>${escapeHtml(input.address)}</strong>`;

  return {
    subject: brandedSubject(language, wording.subject),
    html: wrapInAppFrame(renderMessageSection(wording, addressHtml, input.link, null), language),
    text: messagePlainText(wording, input.address, input.link, language),
  };
}

/** Ένα πρότυπο της Firebase: θέμα + σώμα HTML με τα placeholders της. */
export interface FirebaseAuthTemplate {
  readonly subject: string;
  readonly body: string;
}

/** Η προεπιλεγμένη γλώσσα **πρώτη** — είναι αυτή που διαβάζει πρώτα ο παραλήπτης. */
function languagesDefaultFirst(): readonly HumanLanguage[] {
  return [DEFAULT_LANGUAGE, ...HUMAN_LANGUAGES.filter((language) => language !== DEFAULT_LANGUAGE)];
}

/**
 * **Το πρότυπο της Firebase** — όλες οι γλώσσες, η προεπιλεγμένη πρώτη.
 *
 * ⚠️ Χρειάζεται **μόνο** για ό,τι στέλνει η ίδια η Firebase — σήμερα η ειδοποίηση αλλαγής
 * email (ADR-851 §3). Η Google **αρνείται** να το δεχτεί μέσω API: ο άνθρωπος το επικολλά
 * στην κονσόλα (`npm run firebase-auth:config:check -- --export-templates=<dir>`), και ο
 * ημερήσιος έλεγχος απόκλισης φυλάει ότι έμεινε ίδιο.
 */
export function buildFirebaseAuthTemplate(kind: AuthActionEmailKind): FirebaseAuthTemplate {
  const addressHtml = `<strong>${FIREBASE_ADDRESS_PLACEHOLDER[kind]}</strong>`;
  const languages = languagesDefaultFirst();

  const sections = languages
    .map((language) => renderMessageSection(
      authActionWordingFor(language, kind),
      addressHtml,
      FIREBASE_TEMPLATE_PLACEHOLDERS.link,
      language === DEFAULT_LANGUAGE ? null : language,
    ))
    .join(`<hr style="border:none;border-top:1px solid ${BRAND.border};margin:8px 0 24px;" />`);

  const subject = languages.map((language) => authActionWordingFor(language, kind).subject).join(' / ');
  return {
    subject: brandedSubject(DEFAULT_LANGUAGE, subject),
    body: wrapInAppFrame(sections, DEFAULT_LANGUAGE),
  };
}
