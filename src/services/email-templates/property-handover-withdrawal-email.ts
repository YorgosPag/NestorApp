/**
 * @fileoverview **«Η ΠΑΡΑΔΟΣΗ ΑΝΑΚΛΗΘΗΚΕ»** — η ενημέρωση του αγοραστή όταν το γραφείο ανακαλεί την παράδοση (ADR-916 §5.19 Φ-Δ.5 · Δ8).
 * @module services/email-templates/property-handover-withdrawal-email
 * @related `invitation-email-shared.ts` (`composeNoticeEmail` — ο ΚΟΙΝΟΣ σκελετός ενημέρωσης χωρίς πράξη) ·
 *          `property-handover-invitation-email.ts` (τα λόγια της ίδιας σχέσης)
 *
 * @note Οι ελληνικές/αγγλικές συμβολοσειρές εδώ **ΔΕΝ** είναι παράβαση του N.11: τα server-side πρότυπα email
 *       φέρουν το κείμενό τους inline by design (δες `server/comms/email-texts.ts`). Η γλώσσα είναι **παράμετρος**.
 *
 * 🔑 **Ενημέρωση, όχι πράξη** (DocuSign void: ο παραλήπτης μαθαίνει, δεν αποφασίζει): **κανένα** κουμπί, **κανένας**
 *    σύνδεσμος — τίποτα να «πατηθεί» σε προωθημένο email, και καμία εξάρτηση από τη δημόσια διεύθυνση της εφαρμογής.
 * 🔑 **Το πιο σημαντικό λέγεται πρώτο**: ό,τι παραδόθηκε **μένει** δικό του (Δ2 · Δ5) — ο άνθρωπος δεν πρέπει να
 *    φοβηθεί ότι χάνει τα έγγραφα του σπιτιού του.
 * 🔒 **Η αιτιολογία του γραφείου ΔΕΝ ταξιδεύει** (Δ10): μπορεί να αφορά συνιδιοκτήτες ή εσωτερικά της πώλησης. Σε αντίθεση
 *    με το DocuSign, που στέλνει τον λόγο αυτούσιο, εδώ ο αγοραστής παραπέμπεται στην εταιρεία. Μόνο εταιρεία και σπίτι (ADR-742).
 */

import 'server-only';

import { HUMAN_LANGUAGES, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';

import { escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import { composeNoticeEmail, invitationDetailLine } from './invitation-email-shared';

interface HandoverWithdrawalWording {
  /** ⚠️ Το θέμα λέει **το σπίτι**: ο αγοραστής πρέπει να αναγνωρίσει το μήνυμα χωρίς να το ανοίξει. */
  readonly subject: (property: string) => string;
  readonly heading: string;
  /** Τα ορίσματα είναι είτε ωμό κείμενο είτε **ήδη ασφαλές HTML** — ο renderer αποφασίζει. */
  readonly intro: (issuer: string, property: string) => string;
  readonly keptLabel: string;
  readonly kept: string;
  readonly nextLabel: string;
  readonly next: string;
  readonly questionsLabel: string;
  readonly questions: (issuer: string) => string;
  readonly footnote: string;
  readonly unnamedIssuer: string;
  readonly unnamedProperty: string;
}

/** ⚠️ `Record<HumanLanguage, …>`, ποτέ `Partial` — νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της. */
const TEXTS: Readonly<Record<HumanLanguage, HandoverWithdrawalWording>> = {
  el: {
    subject: (property) => `Ανάκληση της παράδοσης του φακέλου — ${property}`,
    heading: 'Η παράδοση του φακέλου ανακλήθηκε',
    intro: (issuer, property) => `${issuer} ανακάλεσε την παράδοση του ψηφιακού φακέλου του ακινήτου ${property}.`,
    keptLabel: 'Τι μένει σε εσάς',
    kept: 'Ό,τι σας έχει ήδη παραδοθεί παραμένει δικό σας, στον φάκελό σας — δεν αφαιρείται.',
    nextLabel: 'Τι αλλάζει',
    next: 'Νέα έγγραφα της εταιρείας δεν θα προστίθενται πλέον στον φάκελο.',
    questionsLabel: 'Ερωτήσεις',
    questions: (issuer) => `Για τον λόγο της ανάκλησης επικοινωνήστε απευθείας με ${issuer}.`,
    footnote: 'Λαμβάνετε αυτό το μήνυμα επειδή είχατε αποδεχτεί τον φάκελο αυτού του ακινήτου.',
    unnamedIssuer: 'Η εταιρεία που σας πούλησε το ακίνητο',
    unnamedProperty: 'σας',
  },
  en: {
    subject: (property) => `Handover of the home file withdrawn — ${property}`,
    heading: 'The handover of the file was withdrawn',
    intro: (issuer, property) => `${issuer} has withdrawn the handover of the digital file of the property ${property}.`,
    keptLabel: 'What stays with you',
    kept: 'Everything already delivered to you remains yours, in your file — it is not removed.',
    nextLabel: 'What changes',
    next: 'New documents from the company will no longer be added to the file.',
    questionsLabel: 'Questions',
    questions: (issuer) => `For the reason of the withdrawal, contact ${issuer} directly.`,
    footnote: 'You receive this message because you had accepted the file of this property.',
    unnamedIssuer: 'The company that sold you the property',
    unnamedProperty: 'you purchased',
  },
};

export interface PropertyHandoverWithdrawalEmailInput {
  /** Η γλώσσα του παραλήπτη — από **δεδομένα**, άρα `unknown` (άγνωστη ⇒ προεπιλογή). */
  readonly language: unknown;
  readonly issuerName: string | null;
  readonly propertyLabel: string | null;
}

/** **Το email, στη γλώσσα του παραλήπτη.** Ποτέ `null`: χωρίς σύνδεσμο, δεν εξαρτάται από τη δημόσια διεύθυνση. */
export function buildPropertyHandoverWithdrawalEmail(input: PropertyHandoverWithdrawalEmailInput): ConfirmationEmailResult {
  const language = resolveHumanLanguage(input.language);
  const w = TEXTS[language];
  const issuer = input.issuerName?.trim() || w.unnamedIssuer;
  const property = input.propertyLabel?.trim() || w.unnamedProperty;
  return composeNoticeEmail({
    language,
    subject: w.subject(property),
    heading: w.heading,
    intro: {
      html: w.intro(`<strong>${escapeHtml(issuer)}</strong>`, `<strong>${escapeHtml(property)}</strong>`),
      text: w.intro(issuer, property),
    },
    details: [
      invitationDetailLine(w.keptLabel, w.kept),
      invitationDetailLine(w.nextLabel, w.next),
      invitationDetailLine(w.questionsLabel, w.questions(issuer)),
    ],
    footnote: w.footnote,
  });
}

/** **Έχει κάθε γλώσσα ΟΛΑ τα λόγια της;** — άγκυρα που **εκτελείται**, και ελέγχει και τις συναρτήσεις. */
export function everyLanguageHasHandoverWithdrawalWording(): boolean {
  return HUMAN_LANGUAGES.every((language) => {
    const w = TEXTS[language];
    if (!w) return false;
    const texts = [
      w.subject('χ'), w.heading, w.intro('χ', 'ψ'), w.keptLabel, w.kept, w.nextLabel, w.next, w.questionsLabel,
      w.questions('χ'), w.footnote, w.unnamedIssuer, w.unnamedProperty,
    ];
    return texts.every((text) => typeof text === 'string' && text.length > 0);
  });
}
