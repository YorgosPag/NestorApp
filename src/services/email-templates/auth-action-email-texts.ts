/**
 * @fileoverview **ΤΑ ΛΟΓΙΑ ΤΩΝ EMAIL ΛΟΓΑΡΙΑΣΜΟΥ — ΑΝΑ ΓΛΩΣΣΑ** (ADR-851).
 * @module services/email-templates/auth-action-email-texts
 *
 * Επαναφορά κωδικού · επιβεβαίωση email · ειδοποίηση αλλαγής email — **ένα** λεξιλόγιο,
 * **δύο** καταναλωτές:
 *
 * 1. Τα **δικά μας** email (`auth-action-email.ts` → `buildAuthActionEmail`), **μία**
 *    γλώσσα, η γλώσσα του παραλήπτη — πρότυπο Google / GitHub / Figma.
 * 2. Τα πρότυπα της **Firebase** (`buildFirebaseAuthTemplate`), **όλες** οι γλώσσες σε
 *    ένα μήνυμα με placeholders (`%LINK%` · `%EMAIL%` · `%NEW_EMAIL%`): η Firebase δέχεται
 *    **ένα** προσαρμοσμένο πρότυπο ανά τύπο, χωρίς εκδοχή ανά γλώσσα (Identity Toolkit
 *    Admin v2 `EmailTemplate` — δεν έχει πεδίο locale).
 *
 * 🔑 **Γιατί ΕΝΑ λεξιλόγιο και όχι δύο**: μέχρι 2026-09-11 το πρότυπο «αλλαγή email» της
 * κονσόλας είχε θέμα **«Επαναφορά κωδικού πρόσβασης»** πάνω σε αγγλικό σώμα — δύο
 * κείμενα για το ίδιο γεγονός, γραμμένα σε δύο μέρη, που απέκλιναν χωρίς να το δει κανείς.
 *
 * ⚠️ Όπως το `server/comms/email-texts.ts`: **καθαρά δεδομένα**, κανένα i18next —
 * η γλώσσα είναι **παράμετρος**, όχι καθολική κατάσταση (δες την κεφαλίδα εκείνου).
 */

import { HUMAN_LANGUAGES, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';

import { isCompleteWording, type AppMessageWording } from './app-message-wording';

/** Τα γεγονότα λογαριασμού που γράφουν email. */
export const AUTH_ACTION_EMAIL_KINDS = ['resetPassword', 'verifyEmail', 'changeEmail'] as const;
export type AuthActionEmailKind = (typeof AUTH_ACTION_EMAIL_KINDS)[number];

/** Τα λόγια ενός email λογαριασμού — το **κοινό** σχήμα μηνύματος της εφαρμογής. */
export type AuthActionWording = AppMessageWording;

/**
 * ⚠️ **`Record<HumanLanguage, …>`, ΠΟΤΕ `Partial`** — μια τρίτη γλώσσα δεν μεταγλωττίζεται
 * χωρίς τα λόγια της (ίδιος φρουρός με το `EMAIL_TEXTS`).
 */
const AUTH_ACTION_TEXTS: Readonly<Record<HumanLanguage, Readonly<Record<AuthActionEmailKind, AuthActionWording>>>> = {
  el: {
    resetPassword: {
      subject: 'Ορισμός νέου κωδικού πρόσβασης',
      heading: 'Ορισμός νέου κωδικού πρόσβασης',
      intro: (address) => `Λάβαμε αίτημα ορισμού νέου κωδικού πρόσβασης για τον λογαριασμό ${address}.`,
      cta: 'Ορισμός νέου κωδικού',
      footnote: 'Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το μήνυμα — ο κωδικός σας δεν αλλάζει.',
    },
    verifyEmail: {
      subject: 'Επιβεβαίωση διεύθυνσης email',
      heading: 'Επιβεβαιώστε τη διεύθυνση email σας',
      intro: (address) => `Επιβεβαιώστε ότι η διεύθυνση ${address} ανήκει σε εσάς.`,
      cta: 'Επιβεβαίωση email',
      footnote: 'Αν δεν δημιουργήσατε εσείς λογαριασμό, αγνοήστε αυτό το μήνυμα.',
    },
    changeEmail: {
      subject: 'Η διεύθυνση email του λογαριασμού σας άλλαξε',
      heading: 'Η διεύθυνση email του λογαριασμού σας άλλαξε',
      intro: (address) => `Η διεύθυνση σύνδεσης του λογαριασμού σας άλλαξε σε ${address}.`,
      cta: 'Αναίρεση της αλλαγής',
      footnote: 'Αν δεν το ζητήσατε εσείς, πατήστε αμέσως το κουμπί: η παλιά διεύθυνση επανέρχεται '
        + 'και μπορείτε να ορίσετε νέο κωδικό πρόσβασης.',
    },
  },
  en: {
    resetPassword: {
      subject: 'Set a new password',
      heading: 'Set a new password',
      intro: (address) => `We received a request to set a new password for the account ${address}.`,
      cta: 'Set new password',
      footnote: 'If you did not request this, ignore this email — your password stays the same.',
    },
    verifyEmail: {
      subject: 'Verify your email address',
      heading: 'Verify your email address',
      intro: (address) => `Confirm that the address ${address} belongs to you.`,
      cta: 'Verify email',
      footnote: 'If you did not create an account, ignore this email.',
    },
    changeEmail: {
      subject: 'Your account email address was changed',
      heading: 'Your account email address was changed',
      intro: (address) => `The sign-in address of your account was changed to ${address}.`,
      cta: 'Undo this change',
      footnote: 'If you did not request this, press the button right away: your previous address is '
        + 'restored and you can set a new password.',
    },
  },
};

/** Τα λόγια για αυτόν τον παραλήπτη — άγνωστη γλώσσα ⇒ η προεπιλογή, ποτέ `undefined`. */
export function authActionWordingFor(language: unknown, kind: AuthActionEmailKind): AuthActionWording {
  return AUTH_ACTION_TEXTS[resolveHumanLanguage(language)][kind];
}

/**
 * **Έχει κάθε γλώσσα όλα τα λόγια;** — για άγκυρα που **εκτελείται** (N.17: ο
 * μεταγλωττιστής δεν είναι φρουρός στη ροή του πράκτορα).
 */
export function everyLanguageHasAuthActionWording(): boolean {
  return HUMAN_LANGUAGES.every((language) =>
    AUTH_ACTION_EMAIL_KINDS.every((kind) => isCompleteWording(AUTH_ACTION_TEXTS[language]?.[kind])),
  );
}
