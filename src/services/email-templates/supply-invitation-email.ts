/**
 * @fileoverview **«ΣΑΣ ΣΥΝΔΕΕΙ Ο ΠΡΟΜΗΘΕΥΤΗΣ ΣΑΣ»** — το email της πρόσκλησης σχέσης προμήθειας.
 * @module services/email-templates/supply-invitation-email
 * @related ADR-923 §5.12 Σ2 · ADR-853 §20 · `invitation-email-shared.ts` (ο ΚΟΙΝΟΣ σκελετός)
 *
 * @note Οι ελληνικές/αγγλικές συμβολοσειρές εδώ **ΔΕΝ** είναι παράβαση του N.11: τα server-side πρότυπα email φέρουν το
 *       κείμενό τους inline by design (δες `server/comms/email-texts.ts`). Η γλώσσα είναι **παράμετρος**.
 *
 * 🔑 **Το εύρος λέγεται ρητά:** η αποδοχή ανοίγει τον κατάλογο του προμηθευτή στο γραφείο του παραλήπτη, δεν δίνει
 *    πρόσβαση στον χώρο του, και ο προμηθευτής δεν μαθαίνει τίποτα άλλο για εκείνον.
 */

import 'server-only';

import { PRODUCT_NAME } from '@/constants/product-identity';
import { HUMAN_LANGUAGES, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { supplyInvitationHref } from '@/subapps/catalog/catalog-routes';
import { publicUrl } from '@/lib/http/public-origin';
import { formatOperatorDate } from '@/lib/operator-time-format';

import { escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import { composeInvitationEmail, invitationDetailLine, type InvitationEmailCoreWording } from './invitation-email-shared';

interface SupplyInvitationWording extends InvitationEmailCoreWording {
  readonly subject: (supplier: string) => string;
  readonly heading: string;
  readonly intro: (supplier: string) => string;
  readonly scopeLabel: string;
  readonly scope: string;
  readonly noAccount: string;
  readonly expiresLabel: string;
  readonly unnamedSupplier: string;
}

/** ⚠️ `Record<HumanLanguage, …>`, ποτέ `Partial`: νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της. */
const TEXTS: Readonly<Record<HumanLanguage, SupplyInvitationWording>> = {
  el: {
    subject: (supplier) => `Σύνδεση με τον προμηθευτή ${supplier}`,
    heading: 'Ο προμηθευτής σας ανοίγει τον κατάλογό του',
    intro: (supplier) => `${supplier} σας προσκαλεί να συνδέσετε το γραφείο σας με τον κατάλογό του στο ${PRODUCT_NAME}.`,
    scopeLabel: 'Τι ανοίγει',
    scope: 'Τα προϊόντα και οι τιμές που έχει ορίσει για εσάς, μέσα στους προϋπολογισμούς σας. Ο προμηθευτής δεν αποκτά πρόσβαση στο γραφείο σας.',
    noAccount: 'Δεν έχετε λογαριασμό; Η εγγραφή με αυτό το email παίρνει περίπου 2 λεπτά.',
    expiresLabel: 'Ο σύνδεσμος λήγει στις',
    cta: 'Δείτε την πρόσκληση',
    onlyWord: 'μόνο',
    boundToAddress: (onlyHtml) => `Ο σύνδεσμος λειτουργεί ${onlyHtml} για αυτή τη διεύθυνση email: μην τον προωθήσετε.`,
    footnote: 'Δεν το περιμένατε; Αγνοήστε το μήνυμα, ή ανοίξτε τον σύνδεσμο και πατήστε «Όχι, ευχαριστώ». Μπορείτε να διακόψετε τη σύνδεση όποτε θέλετε.',
    unnamedSupplier: 'Ένας προμηθευτής',
  },
  en: {
    subject: (supplier) => `Connect with your supplier ${supplier}`,
    heading: 'Your supplier is opening their catalogue to you',
    intro: (supplier) => `${supplier} invites you to connect your office to their catalogue on ${PRODUCT_NAME}.`,
    scopeLabel: 'What opens',
    scope: 'The products and prices they have set for you, inside your own budgets. The supplier gets no access to your office.',
    noAccount: 'No account? Signing up with this email takes about 2 minutes.',
    expiresLabel: 'The link expires on',
    cta: 'View the invitation',
    onlyWord: 'only',
    boundToAddress: (onlyHtml) => `The link works ${onlyHtml} for this email address: do not forward it.`,
    footnote: 'Not expecting this? Ignore this message, or open the link and press “No, thanks”. You can disconnect at any time.',
    unnamedSupplier: 'A supplier',
  },
};

export interface SupplyInvitationEmailInput {
  /** Η γλώσσα του παραλήπτη, από **δεδομένα**, άρα `unknown` (άγνωστη ⇒ προεπιλογή). */
  readonly language: unknown;
  readonly supplierName: string | null;
  readonly expiresAt: string;
  /** Το **ωμό** token: μόνο στην επιστροφή της έκδοσης και **εδώ**. */
  readonly token: string;
}

/** **Το email, στη γλώσσα του παραλήπτη.** `null` ⇒ χωρίς δημόσια διεύθυνση: ποτέ σύνδεσμος που δεν οδηγεί πουθενά. */
export function buildSupplyInvitationEmail(input: SupplyInvitationEmailInput): ConfirmationEmailResult | null {
  const link = publicUrl(supplyInvitationHref(input.token));
  if (link === null) return null;
  const language = resolveHumanLanguage(input.language);
  const w = TEXTS[language];
  const supplier = input.supplierName?.trim() || w.unnamedSupplier;
  return composeInvitationEmail({
    language,
    subject: w.subject(supplier),
    heading: w.heading,
    intro: { html: w.intro(`<strong>${escapeHtml(supplier)}</strong>`), text: w.intro(supplier) },
    details: [
      invitationDetailLine(w.scopeLabel, w.scope),
      invitationDetailLine(w.expiresLabel, formatOperatorDate(input.expiresAt, language)),
      { html: escapeHtml(w.noAccount), text: w.noAccount },
    ],
    link,
    core: w,
  });
}

/** **Έχει κάθε γλώσσα ΟΛΑ τα λόγια της;** Άγκυρα που **εκτελείται**, και ελέγχει και τις συναρτήσεις. */
export function everyLanguageHasSupplyInvitationWording(): boolean {
  return HUMAN_LANGUAGES.every((language) => {
    const w = TEXTS[language];
    if (!w) return false;
    const texts = [
      w.subject('χ'), w.heading, w.intro('χ'), w.scopeLabel, w.scope, w.noAccount, w.expiresLabel,
      w.cta, w.onlyWord, w.boundToAddress(w.onlyWord), w.footnote, w.unnamedSupplier,
    ];
    return texts.every((text) => typeof text === 'string' && text.length > 0);
  });
}
