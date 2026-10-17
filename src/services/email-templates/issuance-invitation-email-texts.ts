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
    noteLabel: 'Note from the office',
    unnamedOffice: 'The office',
    unnamedProperty: 'of yours',
    unnamedPerson: 'a professional',
  },
};
