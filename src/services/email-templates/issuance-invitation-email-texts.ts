/**
 * @fileoverview ADR-915 §28 — **τα λόγια** των μηνυμάτων της ανάθεσης έκδοσης: έγκριση (υπεύθυνος) · ανάθεση (επαγγελματίας) ·
 *   ενημέρωση (συνιδιοκτήτης), σε κάθε γλώσσα. Οι **ονομασίες** (έγγραφο · προσόν) **δεν** ζουν εδώ: έρχονται από τα ίδια
 *   κλειδιά locale με την οθόνη (`DOCUMENT_KIND_LABEL_KEYS` · `qualificationText`).
 * @related issuance-invitation-email.ts (ο συνθέτης) · invitation-email-shared.ts (ο σκελετός)
 * @module services/email-templates/issuance-invitation-email-texts
 *
 * 🔒 **Ειλικρίνεια για την προώθηση** (§28 Η-Β6): η γραμμή του συνδέσμου **δεν** υπόσχεται ότι «για άλλον δεν θα δουλέψει» —
 *    χωρίς λογαριασμό, όποιος κρατά τον σύνδεσμο απαντά. Το λέμε, όπως το DocuSign λέει «μην τον προωθήσετε».
 * 🔒 **Διαφάνεια (GDPR άρθρο 14)**: κάθε υποσημείωση λέει **γιατί** το λαμβάνει ο άνθρωπος και πώς λέει «όχι».
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { IssuanceLinkAnswer } from '@/lib/document-validity/issuance-request';

import type { InvitationEmailCoreWording } from './invitation-email-shared';

interface LinkWording extends InvitationEmailCoreWording {
  readonly subject: (document: string, property: string) => string;
  readonly heading: string;
  readonly expiresLabel: string;
}

export interface IssuanceEmailWording {
  readonly approval: LinkWording & {
    readonly intro: (office: string, professional: string, document: string, property: string) => string;
    readonly professionalLabel: string;
    readonly credentialLabel: string;
    readonly registryNumber: (credential: string, number: string) => string;
    readonly coOwnersLabel: string;
  };
  readonly professional: LinkWording & {
    readonly intro: (office: string, document: string, property: string) => string;
  };
  readonly coOwner: {
    readonly subject: (document: string, property: string) => string;
    readonly heading: string;
    readonly intro: (office: string, professional: string, document: string, property: string, lead: string) => string;
    readonly footnote: string;
  };
  /**
   * §29 — ο σύνδεσμος ζητά **και** κωδικό: πώς τον παίρνει ο άνθρωπος (ποτέ ο ίδιος ο κωδικός — το email είναι το **πρώτο**
   * κανάλι), και η γραμμή προώθησης αλλάζει: με κωδικό, «όποιος τον έχει απαντά» δεν ισχύει πια.
   */
  readonly accessCode: {
    readonly label: string;
    readonly howTo: string;
    readonly boundToAddress: (onlyHtml: string) => string;
  };
  /**
   * §30 — **η απόδειξη απάντησης**, στη διεύθυνση όπου στάλθηκε ο σύνδεσμος (πρότυπο DocuSign «Completed» + ειδοποίηση
   * ασφαλείας «δεν ήσασταν εσείς;»). Λέει **τι** καταγράφηκε, **πότε** και **πώς** αποδείχθηκε η ταυτότητα· ποτέ σύνδεσμο.
   */
  readonly receipt: {
    readonly subject: (document: string, property: string) => string;
    readonly heading: string;
    readonly intro: Readonly<Record<IssuanceLinkAnswer, (document: string, property: string, professional: string) => string>>;
    readonly recordedAtLabel: string;
    readonly verifiedLabel: string;
    readonly verifiedByCode: string;
    readonly verifiedByLink: string;
    readonly commentLabel: string;
    readonly notYouLabel: string;
    readonly notYou: (office: string) => string;
    readonly footnote: string;
  };
  /**
   * §31 — **η υπενθύμιση** (DocuSign / Adobe Sign «Reminder»): το **ίδιο** μήνυμα, με θέμα που λέει ότι είναι υπενθύμιση,
   * πότε στάλθηκε το αίτημα, και πώς σταματούν οι υπενθυμίσεις (GDPR άρθρο 21 — ο άνθρωπος λέει «όχι» με μία κίνηση).
   * 🔒 Ο κωδικός πρόσβασης **ποτέ** — δεν τον έχουμε (μόνο HMAC), και το email είναι το πρώτο κανάλι.
   */
  readonly reminder: {
    readonly subject: (original: string) => string;
    readonly heading: Readonly<Record<'approval' | 'professional', string>>;
    readonly sentLabel: string;
    readonly accessCodeHowTo: string;
    readonly stopLabel: string;
    /** `button` = η ετικέτα του κουμπιού άρνησης **από το locale της σελίδας** — ό,τι διαβάζει, αυτό βλέπει. */
    readonly stop: (button: string) => string;
  };
  readonly noteLabel: string;
  readonly unnamedOffice: string;
  readonly unnamedProperty: string;
  readonly unnamedPerson: string;
}

/** ⚠️ `Record<HumanLanguage, …>`, ποτέ `Partial` — νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της. */
export const ISSUANCE_EMAIL_TEXTS: Readonly<Record<HumanLanguage, IssuanceEmailWording>> = {
  el: {
    approval: {
      subject: (document, property) => `Η απόφασή σας: ${document} — ${property}`,
      heading: 'Χρειάζεται η απόφασή σας',
      intro: (office, professional, document, property) =>
        `${office} προτείνει τον/την ${professional} για το έγγραφο «${document}» του ακινήτου ${property}. Η απόφαση είναι δική σας.`,
      professionalLabel: 'Επαγγελματίας',
      credentialLabel: 'Προσόν (όπως το δήλωσε το γραφείο)',
      registryNumber: (credential, number) => `${credential} · αρ. μητρώου ${number}`,
      coOwnersLabel: 'Ενημερώνονται επίσης',
      expiresLabel: 'Ο σύνδεσμος λήγει στις',
      cta: 'Δείτε και αποφασίστε',
      onlyWord: 'μόνο',
      boundToAddress: (onlyHtml) =>
        `Ο σύνδεσμος είναι προσωπικός και ισχύει ${onlyHtml} για αυτή την απόφαση — μην τον προωθήσετε: όποιος τον έχει μπορεί να απαντήσει.`,
      footnote:
        'Λαμβάνετε αυτό το μήνυμα επειδή το γραφείο σάς έχει καταχωρίσει ως υπεύθυνο ιδιοκτήτη για τα έγγραφα του ακινήτου. '
        + 'Τίποτα δεν ανατίθεται χωρίς τη δική σας απόφαση· αν δεν σας αφορά, αγνοήστε το ή ενημερώστε το γραφείο.',
    },
    professional: {
      subject: (document, property) => `Αίτημα έκδοσης: ${document} — ${property}`,
      heading: 'Σας ζητούν να εκδώσετε ένα έγγραφο',
      intro: (office, document, property) =>
        `${office} σας αναθέτει, με την έγκριση του ιδιοκτήτη, την έκδοση του εγγράφου «${document}» για το ακίνητο ${property}.`,
      expiresLabel: 'Ο σύνδεσμος λήγει στις',
      cta: 'Αποδοχή ή άρνηση',
      onlyWord: 'μόνο',
      boundToAddress: (onlyHtml) =>
        `Ο σύνδεσμος είναι προσωπικός και ισχύει ${onlyHtml} για αυτή την ανάθεση — μην τον προωθήσετε: όποιος τον έχει μπορεί να απαντήσει.`,
      footnote:
        'Λαμβάνετε αυτό το μήνυμα επειδή είστε στις επαφές του γραφείου ως επαγγελματίας. '
        + 'Η απάντηση δεν δημιουργεί λογαριασμό και δεν δίνει πρόσβαση σε άλλα στοιχεία.',
    },
    coOwner: {
      subject: (document, property) => `Για την ενημέρωσή σας: ${document} — ${property}`,
      heading: 'Για την ενημέρωσή σας',
      intro: (office, professional, document, property, lead) =>
        `${office} πρότεινε τον/την ${professional} για το έγγραφο «${document}» του ακινήτου ${property}. `
        + `Την απόφαση την έχει ο/η ${lead}, ως υπεύθυνος ιδιοκτήτης για τα έγγραφα του ακινήτου.`,
      footnote:
        'Λαμβάνετε αυτό το μήνυμα επειδή το γραφείο σάς έχει καταχωρίσει ως συνιδιοκτήτη. Δεν χρειάζεται καμία ενέργεια· '
        + 'για αντίρρηση, επικοινωνήστε με το γραφείο ή με τον υπεύθυνο ιδιοκτήτη.',
    },
    accessCode: {
      label: 'Κωδικός πρόσβασης',
      howTo: 'Θα σας ζητηθεί 6ψήφιος κωδικός, που σας λέει το γραφείο τηλεφωνικά. Δεν στέλνεται ποτέ με email.',
      boundToAddress: (onlyHtml) =>
        `Ο σύνδεσμος είναι προσωπικός και ισχύει ${onlyHtml} για αυτό το αίτημα, μαζί με τον κωδικό που σας είπε το γραφείο — μην τον προωθήσετε.`,
    },
    receipt: {
      subject: (document, property) => `Καταγράψαμε την απάντησή σας: ${document} — ${property}`,
      heading: 'Καταγράψαμε την απάντησή σας',
      intro: {
        approve: (document, property, professional) =>
          `Εγκρίνατε την ανάθεση του εγγράφου «${document}» για το ακίνητο ${property}. Επαγγελματίας: ${professional}.`,
        reject: (document, property, professional) =>
          `Δεν εγκρίνατε την ανάθεση του εγγράφου «${document}» για το ακίνητο ${property}. Επαγγελματίας: ${professional}.`,
        accept: (document, property) => `Αναλάβατε την έκδοση του εγγράφου «${document}» για το ακίνητο ${property}.`,
        decline: (document, property) => `Αρνηθήκατε την έκδοση του εγγράφου «${document}» για το ακίνητο ${property}.`,
      },
      recordedAtLabel: 'Καταγράφηκε στις',
      verifiedLabel: 'Ταυτοποίηση',
      verifiedByCode: 'Με τον σύνδεσμο και τον κωδικό πρόσβασης',
      verifiedByLink: 'Με τον σύνδεσμο που στάλθηκε σε αυτή τη διεύθυνση',
      commentLabel: 'Το σχόλιό σας',
      notYouLabel: 'Δεν ήσασταν εσείς;',
      notYou: (office) => `Επικοινωνήστε αμέσως με το γραφείο που σας έστειλε το αίτημα (${office}).`,
      footnote:
        'Λαμβάνετε αυτή την επιβεβαίωση επειδή δόθηκε απάντηση με τον σύνδεσμο που στάλθηκε σε αυτή τη διεύθυνση. '
        + 'Είναι ενημερωτικό μήνυμα· δεν χρειάζεται καμία ενέργεια.',
    },
    reminder: {
      subject: (original) => `Υπενθύμιση: ${original}`,
      heading: { approval: 'Περιμένουμε ακόμη την απόφασή σας', professional: 'Περιμένουμε ακόμη την απάντησή σας' },
      sentLabel: 'Το αίτημα στάλθηκε στις',
      accessCodeHowTo: 'Χρησιμοποιήστε τον κωδικό που σας είπε το γραφείο. Αν τον χάσατε, ζητήστε από το γραφείο να ξαναστείλει το αίτημα.',
      stopLabel: 'Δεν θέλετε άλλες υπενθυμίσεις;',
      stop: (button) => `Πατήστε «${button}» στον σύνδεσμο ή ενημερώστε το γραφείο — οι υπενθυμίσεις σταματούν αμέσως.`,
    },
    noteLabel: 'Σημείωση του γραφείου',
    unnamedOffice: 'Το γραφείο',
    unnamedProperty: 'σας',
    unnamedPerson: 'επαγγελματία',
  },
  en: {
    approval: {
      subject: (document, property) => `Your decision: ${document} — ${property}`,
      heading: 'Your decision is needed',
      intro: (office, professional, document, property) =>
        `${office} proposes ${professional} for the document “${document}” of the property ${property}. The decision is yours.`,
      professionalLabel: 'Professional',
      credentialLabel: 'Qualification (as declared by the office)',
      registryNumber: (credential, number) => `${credential} · registry no. ${number}`,
      coOwnersLabel: 'Also informed',
      expiresLabel: 'The link expires on',
      cta: 'Review and decide',
      onlyWord: 'only',
      boundToAddress: (onlyHtml) =>
        `This link is personal and works ${onlyHtml} for this decision — do not forward it: whoever has it can answer.`,
      footnote:
        'You are receiving this because the office has recorded you as the owner responsible for this property’s documents. '
        + 'Nothing is assigned without your decision; if this is not for you, ignore it or tell the office.',
    },
    professional: {
      subject: (document, property) => `Issuance request: ${document} — ${property}`,
      heading: 'You are asked to issue a document',
      intro: (office, document, property) =>
        `${office}, with the owner’s approval, asks you to issue the document “${document}” for the property ${property}.`,
      expiresLabel: 'The link expires on',
      cta: 'Accept or decline',
      onlyWord: 'only',
      boundToAddress: (onlyHtml) =>
        `This link is personal and works ${onlyHtml} for this assignment — do not forward it: whoever has it can answer.`,
      footnote:
        'You are receiving this because you are in the office’s contacts as a professional. '
        + 'Answering does not create an account and gives no access to any other data.',
    },
    coOwner: {
      subject: (document, property) => `For your information: ${document} — ${property}`,
      heading: 'For your information',
      intro: (office, professional, document, property, lead) =>
        `${office} proposed ${professional} for the document “${document}” of the property ${property}. `
        + `The decision rests with ${lead}, as the owner responsible for the property’s documents.`,
      footnote:
        'You are receiving this because the office has recorded you as a co-owner. No action is needed; '
        + 'to object, contact the office or the responsible owner.',
    },
    accessCode: {
      label: 'Access code',
      howTo: 'You will be asked for a 6-digit code, which the office tells you by phone. It is never sent by email.',
      boundToAddress: (onlyHtml) =>
        `This link is personal and works ${onlyHtml} for this request, together with the code the office gave you — do not forward it.`,
    },
    receipt: {
      subject: (document, property) => `We recorded your answer: ${document} — ${property}`,
      heading: 'We recorded your answer',
      intro: {
        approve: (document, property, professional) =>
          `You approved the assignment of the document “${document}” for the property ${property}. Professional: ${professional}.`,
        reject: (document, property, professional) =>
          `You did not approve the assignment of the document “${document}” for the property ${property}. Professional: ${professional}.`,
        accept: (document, property) => `You accepted to issue the document “${document}” for the property ${property}.`,
        decline: (document, property) => `You declined to issue the document “${document}” for the property ${property}.`,
      },
      recordedAtLabel: 'Recorded on',
      verifiedLabel: 'Identity check',
      verifiedByCode: 'With the link and the access code',
      verifiedByLink: 'With the link sent to this address',
      commentLabel: 'Your comment',
      notYouLabel: 'Was this not you?',
      notYou: (office) => `Contact the office that sent you the request (${office}) right away.`,
      footnote:
        'You are receiving this confirmation because an answer was given with the link sent to this address. '
        + 'It is for your information; no action is needed.',
    },
    reminder: {
      subject: (original) => `Reminder: ${original}`,
      heading: { approval: 'We are still waiting for your decision', professional: 'We are still waiting for your answer' },
      sentLabel: 'The request was sent on',
      accessCodeHowTo: 'Use the code the office gave you. If you lost it, ask the office to send the request again.',
      stopLabel: 'No more reminders?',
      stop: (button) => `Choose “${button}” on the link or tell the office — the reminders stop right away.`,
    },
    noteLabel: 'Note from the office',
    unnamedOffice: 'The office',
    unnamedProperty: 'of yours',
    unnamedPerson: 'a professional',
  },
};
