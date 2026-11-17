/**
 * @fileoverview ADR-943 Φ5β (Ζ-1) — **τα λόγια του email με νέο σύνδεσμο προκαταβολής**, στις γλώσσες του παραλήπτη.
 * @related issuance-invitation-email.ts (ο συνθέτης, είδος `advance-link`) · server/issuance-invitations/issuance-advance-link.ts
 * @module services/email-templates/issuance-advance-link-email-texts
 *
 * 🔑 Τρεις στιγμές, **ένα** μήνυμα: «έγινε η αυτοψία — αποδεσμεύεται στις …» (αυτόματο, από την πράξη του μηχανικού) ·
 *    «αίτημα πληρωμής» (από το γραφείο) · Φ5γ «επιστροφή» (ακύρωση ή απόφαση διαφοράς: πόσα γυρίζουν). Κάθε email φέρει
 *    **νέο** σύνδεσμο (πρότυπο Stripe hosted invoice).
 * 🔒 Ποτέ στοιχεία κάρτας με email· ποτέ ο κωδικός §29 μέσα στο μήνυμα — μόνο **πού** τον ξέρει ο παραλήπτης.
 *
 * **Layering**: leaf — καθαρά δεδομένα.
 */

import type { HumanLanguage } from '@/i18n/languages';

import type { InvitationEmailCoreWording } from './invitation-email-shared';

/** Πότε φεύγει το μήνυμα με νέο σύνδεσμο προκαταβολής. */
export const ADVANCE_LINK_MOMENTS = ['work-started', 'payment-request', 'settlement'] as const;
export type AdvanceLinkMoment = (typeof ADVANCE_LINK_MOMENTS)[number];

type ByMoment<T> = Readonly<Record<AdvanceLinkMoment, T>>;

export interface AdvanceLinkEmailWording extends InvitationEmailCoreWording {
  readonly subject: ByMoment<(document: string, property: string) => string>;
  readonly heading: ByMoment<string>;
  readonly intro: ByMoment<(office: string, document: string, property: string) => string>;
  /** Το ποσό του μηνύματος: η προκαταβολή — ή (Φ5γ, `settlement`) ό,τι επιστρέφεται. */
  readonly amountLabel: ByMoment<string>;
  readonly releaseAtLabel: string;
  readonly nextLabel: string;
  readonly next: ByMoment<string>;
  readonly accessCodeLabel: string;
  readonly accessCodeHowTo: string;
  readonly expiresLabel: string;
}

export const ADVANCE_LINK_EMAIL_TEXTS: Readonly<Record<HumanLanguage, AdvanceLinkEmailWording>> = {
  el: {
    subject: {
      'work-started': (document, property) => `Έγινε η αυτοψία — η προκαταβολή αποδεσμεύεται σύντομα: ${document} — ${property}`,
      'payment-request': (document, property) => `Αίτημα πληρωμής προκαταβολής: ${document} — ${property}`,
      settlement: (document, property) => `Επιστροφή προκαταβολής: ${document} — ${property}`,
    },
    heading: {
      'work-started': 'Έγινε η αυτοψία', 'payment-request': 'Η προκαταβολή περιμένει την πληρωμή σας', settlement: 'Επιστροφή της προκαταβολής σας',
    },
    intro: {
      'work-started': (office, document, property) =>
        `Ο επαγγελματίας δήλωσε ότι έγινε η αυτοψία για το έγγραφο «${document}» του ακινήτου ${property} (γραφείο: ${office}).`,
      'payment-request': (office, document, property) =>
        `${office} σας στέλνει τον σύνδεσμο πληρωμής της προκαταβολής για το έγγραφο «${document}» του ακινήτου ${property}.`,
      settlement: (office, document, property) =>
        `${office} ολοκλήρωσε τον διακανονισμό της προκαταβολής για το έγγραφο «${document}» του ακινήτου ${property}.`,
    },
    amountLabel: { 'work-started': 'Προκαταβολή', 'payment-request': 'Προκαταβολή', settlement: 'Επιστρέφεται σε εσάς' },
    releaseAtLabel: 'Αποδεσμεύεται αυτόματα στον επαγγελματία στις',
    nextLabel: 'Τι κάνετε τώρα',
    next: {
      'work-started': 'Αν όλα πήγαν καλά, δεν χρειάζεται να κάνετε τίποτα. Αν κάτι δεν πήγε καλά, πείτε το από τη σελίδα '
        + 'της προκαταβολής πριν από αυτή την ώρα· τα χρήματα θα παραμείνουν κρατημένα και θα αποφασίσει το γραφείο.',
      'payment-request': 'Πληρώνετε με κάρτα ή IRIS στη σελίδα του αδειοδοτημένου παρόχου. Τα χρήματα κρατούνται και '
        + 'αποδίδονται στον επαγγελματία μόνο μετά την έναρξη (αυτοψία) και 48 ώρες χωρίς αντίρρηση.',
      settlement: 'Δεν χρειάζεται να κάνετε τίποτα. Η επιστροφή γίνεται αυτόματα από τον αδειοδοτημένο πάροχο στον τρόπο '
        + 'πληρωμής σας· την πορεία της τη βλέπετε στη σελίδα της προκαταβολής.',
    },
    accessCodeLabel: 'Κωδικός πρόσβασης',
    accessCodeHowTo: 'Θα σας ζητηθεί ο 6ψήφιος κωδικός που σας είπε το γραφείο — ο ίδιος με την έγκριση, αν σας είχε ζητηθεί και τότε.',
    expiresLabel: 'Ο σύνδεσμος ισχύει ως',
    cta: 'Άνοιγμα σελίδας προκαταβολής',
    onlyWord: 'μόνο',
    boundToAddress: (onlyHtml) => `Ο σύνδεσμος είναι ${onlyHtml} δικός σας — μην τον προωθήσετε.`,
    footnote: 'Ποτέ δεν σας ζητάμε στοιχεία κάρτας με email· η πληρωμή γίνεται στη σελίδα του αδειοδοτημένου παρόχου.',
  },
  en: {
    subject: {
      'work-started': (document, property) => `Site visit done — the advance is released soon: ${document} — ${property}`,
      'payment-request': (document, property) => `Advance payment request: ${document} — ${property}`,
      settlement: (document, property) => `Advance refund: ${document} — ${property}`,
    },
    heading: {
      'work-started': 'The site visit is done', 'payment-request': 'The advance is waiting for your payment', settlement: 'Your advance refund',
    },
    intro: {
      'work-started': (office, document, property) =>
        `The professional declared the site visit done for the document “${document}” of the property ${property} (office: ${office}).`,
      'payment-request': (office, document, property) =>
        `${office} is sending you the advance payment link for the document “${document}” of the property ${property}.`,
      settlement: (office, document, property) =>
        `${office} settled the advance for the document “${document}” of the property ${property}.`,
    },
    amountLabel: { 'work-started': 'Advance', 'payment-request': 'Advance', settlement: 'Refunded to you' },
    releaseAtLabel: 'Paid out automatically to the professional on',
    nextLabel: 'What to do now',
    next: {
      'work-started': 'If everything went well, you need to do nothing. If something went wrong, say so on the advance page '
        + 'before that time; the money will stay held and the office will decide.',
      'payment-request': 'You pay by card or IRIS on the licensed payment provider’s page. The money is held and paid out '
        + 'to the professional only after the start (site visit) and 48 hours without objection.',
      settlement: 'You need to do nothing. The licensed payment provider refunds you automatically to your payment method; '
        + 'you can follow it on the advance page.',
    },
    accessCodeLabel: 'Access code',
    accessCodeHowTo: 'You will be asked for the 6-digit code the office gave you — the same as for the approval, if you were asked for one then.',
    expiresLabel: 'The link is valid until',
    cta: 'Open the advance page',
    onlyWord: 'only',
    boundToAddress: (onlyHtml) => `This link is for you ${onlyHtml} — do not forward it.`,
    footnote: 'We never ask for card details by email; payment happens on the licensed payment provider’s page.',
  },
};
