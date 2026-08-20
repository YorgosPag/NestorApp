/**
 * @fileoverview **ΤΑ ΛΟΓΙΑ ΤΟΥ ΜΗΝΥΜΑΤΟΣ ΠΡΟΣ ΤΟΝ ΙΔΙΟΚΤΗΤΗ** — ανά γλώσσα, χωρίς i18next.
 * @related ADR-777 §8.33 · §8.29 · server/comms/email-texts.ts
 * @module services/mandate/mandate-email-texts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ `t()` — Η ΑΠΑΝΤΗΣΗ ΕΙΝΑΙ ΗΔΗ ΓΡΑΜΜΕΝΗ (§8.29)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `server/comms/email-texts.ts` το τεκμηριώνει: το `t()` απαιτεί **ενεργή γλώσσα
 * i18next**, δηλαδή καθολική κατάσταση σε διεργασία που εξυπηρετεί **πολλούς**
 * παραλήπτες στο ίδιο πέρασμα — *«συνθήκη αγώνα με αποτέλεσμα λάθος γλώσσα σε λάθος
 * άνθρωπο, που κανένα test δεν πιάνει επειδή τα tests στέλνουν ένα email τη φορά»*.
 *
 * **Ένας πίνακας με παράμετρο δεν έχει κατάσταση.** Ίδιο πρότυπο, ίδιος λόγος.
 *
 * ⚠️ **ΔΕΝ είναι εξαίρεση του N.11.** Ο N.11 φρουρά τη **διεπαφή** — ό,τι βλέπει ο
 * χρήστης μέσα στην εφαρμογή. Αυτά είναι **περιεχόμενο μηνύματος**, γραμμένο εκτός
 * κύκλου ζωής React, και το έργο έχει ήδη αποφασίσει γι' αυτά **δύο φορές**
 * (`REMINDER_TEXTS`, `EMAIL_TEXTS`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΜΗΝΥΜΑΤΑ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΛΛΑΓΕΣ ΤΟΥ ΙΔΙΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Δρόμος | Τι ζητά το μήνυμα |
 * |---|---|
 * | **Συγκατάθεση** (`owner-consent`) | *«Δίνεις την εντολή;»* — η αγγελία **δεν** έχει δημοσιευτεί και **δεν θα** δημοσιευτεί χωρίς απάντηση |
 * | **Ενημέρωση** (`agency-attestation`) | *«Το γραφείο δήλωσε ότι έχει υπογεγραμμένη εντολή σου· αν δεν το αναγνωρίζεις, πάτησε εδώ»* — η αγγελία **είναι ήδη ζωντανή** |
 *
 * 🏆 **Το δεύτερο δεν το στέλνει κανένα MLS.** Εκεί ο πωλητής υπογράφει χαρτί και το
 * σύστημα δεν του μιλά ποτέ. Ένα μήνυμα που λέει *«σε διαφημίζουμε — αν κάνουμε
 * λάθος, σταμάτησέ μας»* είναι η διαφορά ανάμεσα σε **εξουσιοδότηση** και σε
 * **ισχυρισμό εξουσιοδότησης**.
 *
 * ⚠️ **Το ίδιο κείμενο για τα δύο θα ήταν χειρότερο από κανένα**: θα ρωτούσε «δίνεις
 * την εντολή;» κάποιον που **έχει ήδη υπογράψει**, δηλαδή θα του έλεγε ότι δεν τον
 * θυμόμαστε.
 */

import { DEFAULT_LANGUAGE, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';

/** Ο τρόπος με τον οποίο απευθυνόμαστε στον ιδιοκτήτη. */
export type MandateMessageKind = 'consent-request' | 'attestation-notice';

/** Τα λόγια ενός μηνύματος, σε **μία** γλώσσα. */
export interface MandateWording {
  readonly subject: (agency: string, listing: string) => string;
  readonly body: (agency: string, listing: string, until: string, url: string) => string;
}

type WordingTable = Record<MandateMessageKind, Record<HumanLanguage, MandateWording>>;

/**
 * ⚠️ **Απλό κείμενο, όχι HTML.** Ο αγωγός (`outbound-email-flush`) στέλνει το `content`
 * ως σώμα· ένα HTML εδώ θα έφτανε ως **ωμή σήμανση** σε όποιον πάροχο δεν το
 * ερμηνεύει, και ο ιδιοκτήτης θα διάβαζε ετικέτες αντί για ερώτηση.
 */
export const MANDATE_TEXTS: WordingTable = {
  'consent-request': {
    el: {
      subject: (agency, listing) => `${agency}: έγκριση για την προβολή του ακινήτου «${listing}»`,
      body: (agency, listing, until, url) =>
        [
          `Το μεσιτικό γραφείο «${agency}» ζητά να αναλάβει την προβολή του ακινήτου σας:`,
          '',
          `  ${listing}`,
          `  Η εντολή θα ισχύει μέχρι ${until}.`,
          '',
          'Η αγγελία ΔΕΝ έχει δημοσιευτεί και δεν θα δημοσιευτεί αν δεν απαντήσετε εσείς.',
          '',
          'Απαντήστε εδώ:',
          url,
          '',
          'Μπορείτε να αλλάξετε την απάντησή σας οποτεδήποτε, από τον ίδιο σύνδεσμο.',
        ].join('\n'),
    },
    en: {
      subject: (agency, listing) => `${agency}: approval to market your property "${listing}"`,
      body: (agency, listing, until, url) =>
        [
          `The agency "${agency}" is asking to market your property:`,
          '',
          `  ${listing}`,
          `  The mandate would run until ${until}.`,
          '',
          'The listing has NOT been published, and will not be unless you answer.',
          '',
          'Answer here:',
          url,
          '',
          'You can change your answer at any time, from the same link.',
        ].join('\n'),
    },
  },
  'attestation-notice': {
    el: {
      subject: (agency, listing) => `${agency}: το ακίνητό σας «${listing}» προβάλλεται`,
      body: (agency, listing, until, url) =>
        [
          `Το μεσιτικό γραφείο «${agency}» δήλωσε ότι έχει υπογεγραμμένη εντολή σας και`,
          'καταχώρησε το ακίνητό σας:',
          '',
          `  ${listing}`,
          `  Η εντολή ισχύει μέχρι ${until}.`,
          '',
          'Η αγγελία είναι ήδη δημοσιευμένη. Αν ΔΕΝ αναγνωρίζετε αυτή την εντολή,',
          'σταματήστε την εδώ — η αγγελία κατεβαίνει αμέσως:',
          url,
        ].join('\n'),
    },
    en: {
      subject: (agency, listing) => `${agency}: your property "${listing}" is being marketed`,
      body: (agency, listing, until, url) =>
        [
          `The agency "${agency}" declared it holds a signed mandate from you and listed`,
          'your property:',
          '',
          `  ${listing}`,
          `  The mandate runs until ${until}.`,
          '',
          'The listing is already published. If you do NOT recognise this mandate,',
          'stop it here — the listing comes down immediately:',
          url,
        ].join('\n'),
    },
  },
};

/**
 * Τα λόγια για **αυτό** το μήνυμα σε **αυτή** τη γλώσσα.
 *
 * ⚠️ Άγνωστη γλώσσα ⇒ η προεπιλογή, ποτέ σφάλμα: ένα μήνυμα που **δεν φεύγει** επειδή
 * η επαφή δεν δήλωσε γλώσσα είναι χειρότερο από ένα μήνυμα στα ελληνικά.
 */
export function mandateTextsFor(
  kind: MandateMessageKind,
  language: unknown,
): MandateWording {
  const resolved: HumanLanguage = resolveHumanLanguage(language);
  return MANDATE_TEXTS[kind][resolved] ?? MANDATE_TEXTS[kind][DEFAULT_LANGUAGE];
}
