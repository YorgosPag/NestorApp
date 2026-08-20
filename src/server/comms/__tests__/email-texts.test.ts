/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΗΣ ΓΛΩΣΣΑΣ ΤΩΝ EMAIL — ADR-777 §8.29
 * =============================================================================
 *
 * 🔑 **Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ, ΚΑΙ ΕΙΝΑΙ Η ΜΟΝΗ ΑΓΚΥΡΑ ΠΟΥ ΜΕΤΡΑΕΙ ΠΡΑΓΜΑΤΙΚΑ.**
 *
 * Μια παράμετρος γλώσσας που κανείς δεν συγκρίνει με **δεύτερη** γλώσσα είναι
 * **αδρανής**: κάθε άλλο test περνά με μία γλώσσα, ακόμη κι αν ο πίνακας έχει τα
 * ίδια ελληνικά και στις δύο στήλες — δηλαδή ακόμη κι αν η μετάφραση **δεν έγινε
 * ποτέ**. Το `Μ0` απαιτεί τα κείμενα να **διαφέρουν**, και είναι ο λόγος που το
 * §8.29 δεν μπορεί να προσγειωθεί «πράσινο και ανενεργό».
 *
 * (Ίδιο μάθημα με τον αδρανή φρουρό του `withQuietHours` — ADR-749 §5.)
 */

import {
  DEFAULT_LANGUAGE,
  HUMAN_LANGUAGES,
  PSEUDO_LANGUAGE,
  SUPPORTED_LANGUAGES,
  isHumanLanguage,
  resolveHumanLanguage,
} from '@/i18n/languages';
import { emailTextsFor, everyLanguageHasWording } from '@/server/comms/email-texts';

describe('ADR-777 §8.29 — το λεξιλόγιο των γλωσσών', () => {
  it('Λ1 🔑 — το `pseudo` ΕΙΝΑΙ γλώσσα i18next αλλά ΔΕΝ είναι γλώσσα ανθρώπου', () => {
    // Η αφαίρεση είναι ο μηχανισμός. Αν αυτές οι δύο γίνουν ίδιες, το `pseudo`
    // ταξιδεύει σε email και ο παραλήπτης παίρνει `[[~~ … ~~]]`.
    expect(SUPPORTED_LANGUAGES).toContain(PSEUDO_LANGUAGE);
    expect(HUMAN_LANGUAGES).not.toContain(PSEUDO_LANGUAGE);
  });

  it('Λ2 — το ανθρώπινο σύνολο είναι ΑΚΡΙΒΩΣ το i18next μείον το όργανο', () => {
    // Παραγόμενο, όχι ξαναγραμμένο: μια τρίτη γλώσσα στο `SUPPORTED_LANGUAGES`
    // πρέπει να εμφανιστεί εδώ **χωρίς** να την προσθέσει κανείς δεύτερη φορά.
    expect([...HUMAN_LANGUAGES]).toEqual(
      SUPPORTED_LANGUAGES.filter((language) => language !== PSEUDO_LANGUAGE),
    );
  });

  it('Λ3 — η προεπιλογή είναι γλώσσα ανθρώπου', () => {
    expect(isHumanLanguage(DEFAULT_LANGUAGE)).toBe(true);
  });

  it('Λ4 🔴 — άκυρη/άγνωστη/απούσα τιμή πέφτει στην προεπιλογή, ΠΟΤΕ δεν πετά', () => {
    // Το πεδίο ζει σε έγγραφο Firestore: μπορεί να περιέχει ό,τι να 'ναι. Μια
    // εξαίρεση εδώ θα σταματούσε την αλληλογραφία **όλων** για ένα κακό έγγραφο.
    for (const rubbish of [undefined, null, '', 'el-GR', 'κινέζικα', 42, {}, [], PSEUDO_LANGUAGE]) {
      expect(resolveHumanLanguage(rubbish)).toBe(DEFAULT_LANGUAGE);
    }
  });

  it('Λ5 — έγκυρη τιμή περνά αυτούσια', () => {
    for (const language of HUMAN_LANGUAGES) {
      expect(resolveHumanLanguage(language)).toBe(language);
    }
  });
});

describe('ADR-777 §8.29 — τα λόγια, ανά γλώσσα', () => {
  it('Κ1 — ΚΑΘΕ γλώσσα ανθρώπου έχει πλήρη λόγια', () => {
    // Ο τύπος `Record<HumanLanguage, …>` το εγγυάται σε χρόνο μεταγλώττισης — αλλά
    // ο κανόνας N.17 απαγορεύει στον πράκτορα να τρέξει `tsc`, οπότε στη ροή μας ο
    // μεταγλωττιστής **δεν είναι φρουρός που εκτελείται**. Αυτό εκτελείται.
    expect(everyLanguageHasWording()).toBe(true);
  });

  it('Μ0 🔴🔴 — ΔΥΟ ΓΛΩΣΣΕΣ ⇒ ΔΙΑΦΟΡΕΤΙΚΟ ΚΕΙΜΕΝΟ (αλλιώς η παράμετρος είναι αδρανής)', () => {
    const el = emailTextsFor('el');
    const en = emailTextsFor('en');

    expect(el.fallbackSubject).not.toBe(en.fallbackSubject);
    expect(el.digest.subject(3)).not.toBe(en.digest.subject(3));
    expect(el.digest.intro(3)).not.toBe(en.digest.intro(3));
    expect(el.digest.footer).not.toBe(en.digest.footer);
  });

  it('Μ0β 🔑 — και το κείμενο είναι ΟΝΤΩΣ στη γλώσσα του, όχι απλώς διαφορετικό', () => {
    // Η `Μ0` θα περνούσε με `'Ειδοποίηση'` και `'Ειδοποίηση '` — δύο διαφορετικά
    // ελληνικά. Ο έλεγχος αλφαβήτου κάνει τη διαφορά **σημασιολογική**: ελληνικοί
    // χαρακτήρες στο ελληνικό, κανένας στο αγγλικό.
    const GREEK = /[Ͱ-Ͽ]/;
    const el = emailTextsFor('el');
    const en = emailTextsFor('en');

    expect(GREEK.test(el.fallbackSubject)).toBe(true);
    expect(GREEK.test(el.digest.subject(3))).toBe(true);
    expect(GREEK.test(el.digest.intro(3))).toBe(true);
    expect(GREEK.test(el.digest.footer)).toBe(true);

    expect(GREEK.test(en.fallbackSubject)).toBe(false);
    expect(GREEK.test(en.digest.subject(3))).toBe(false);
    expect(GREEK.test(en.digest.intro(3))).toBe(false);
    expect(GREEK.test(en.digest.footer)).toBe(false);
  });

  it('Κ2 — το πλήθος φτάνει στο κείμενο, σε ΚΑΘΕ γλώσσα', () => {
    // Χωρίς αυτό, μια στήλη θα μπορούσε να αγνοεί την παράμετρο και να λέει
    // «νέες ειδοποιήσεις» χωρίς αριθμό — σιωπηλά, μόνο για μία γλώσσα.
    for (const language of HUMAN_LANGUAGES) {
      const texts = emailTextsFor(language);
      expect(texts.digest.subject(7)).toContain('7');
      expect(texts.digest.intro(7)).toContain('7');
    }
  });

  it('Κ3 🔴 — άγνωστη γλώσσα ⇒ τα λόγια της προεπιλογής, ΠΟΤΕ `undefined`', () => {
    // Ο τύπος επιστροφής είναι `EmailWording`, όχι `EmailWording | undefined`:
    // μια αναζήτηση πίνακα που αστοχεί θα έστελνε email με θέμα «undefined».
    const fallback = emailTextsFor(DEFAULT_LANGUAGE);
    for (const rubbish of [undefined, 'el-GR', PSEUDO_LANGUAGE, 99]) {
      expect(emailTextsFor(rubbish).fallbackSubject).toBe(fallback.fallbackSubject);
    }
  });

  it('Κ4 — το θέμα-εφεδρεία δεν είναι ποτέ κενό', () => {
    // Ένα email χωρίς θέμα καταλήγει συχνότερα σε ανεπιθύμητα και ο παραλήπτης δεν
    // έχει τίποτα να διαβάσει στη λίστα του.
    for (const language of HUMAN_LANGUAGES) {
      expect(emailTextsFor(language).fallbackSubject.trim().length).toBeGreaterThan(0);
    }
  });
});
