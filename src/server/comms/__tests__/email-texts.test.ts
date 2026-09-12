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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { KNOWN_PAST_SPELLINGS, PRODUCT_NAME } from '@/constants/product-identity';
import {
  DEFAULT_LANGUAGE,
  HUMAN_LANGUAGES,
  PSEUDO_LANGUAGE,
  SUPPORTED_LANGUAGES,
  isHumanLanguage,
  resolveHumanLanguage,
} from '@/i18n/languages';
import { brandedSubject, emailTextsFor, everyLanguageHasWording } from '@/server/comms/email-texts';

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

// =============================================================================
// Β — Η ΥΠΟΓΡΑΦΗ ΤΗΣ ΜΑΡΚΑΣ ΑΝΗΚΕΙ ΣΤΟΝ ΑΠΟΣΤΟΛΕΑ (ADR-777 §8.54)
// =============================================================================
//
// 🔴 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ**: το «— ΝΕΣΤΩΡ» ήταν γραμμένο με το χέρι σε **6 σημεία, 3
// αρχεία**, και **έλειπε** από το τέταρτο (`mandate-decision-notifier`). Μετρημένο
// στα εισερχόμενα του ανθρώπου 2026-09-05: τρεις γραμμές το είχαν, μία όχι — και
// μέσα στη σύνοψη επαναλαμβανόταν **πέντε φορές**, κάτω από θέμα που ήδη υπέγραφε.

describe('Β — το θέμα σφραγίζεται μία φορά, από τον αποστολέα', () => {
  it('Β1 🔑 — το θέμα αποκτά την υπογραφή', () => {
    expect(brandedSubject('Νέα αγγελία')).toBe(`Νέα αγγελία — ${PRODUCT_NAME}`);
  });

  it('Β2 🔴 ΑΜΕΤΑΒΛΗΤΗ ΠΡΑΞΗ — θέμα που υπογράφει ήδη ΔΕΝ υπογράφει δεύτερη φορά', () => {
    // Οι επώνυμες κοινοποιήσεις ακινήτων φέρνουν **δικό τους** θέμα από το `email-templates`.
    const once = brandedSubject(`Νέα αγγελία — ${PRODUCT_NAME}`);
    expect(once).toBe(`Νέα αγγελία — ${PRODUCT_NAME}`);
    expect(brandedSubject(once)).toBe(once);
  });

  it('Β3 🔴 ADR-857 — η υπογραφή ΔΕΝ εξαρτάται από γλώσσα (ήταν πεδίο ανά γλώσσα, και απέκλινε)', () => {
    // ⚠️ Η **παλιά** Β3 απαιτούσε το αντίθετο: «η υπογραφή ακολουθεί τον παραλήπτη».
    //    Ήταν λάθος ερώτηση — το όνομα του προϊόντος **δεν μεταφράζεται**, και το πεδίο ανά
    //    γλώσσα είχε ήδη αποκλίνει σε `ΝΕΣΤΩΡ` / `Nestor` ενώ το υποσέλιδο έλεγε `Nestor App`.
    expect(brandedSubject('A new listing')).toBe(`A new listing — ${PRODUCT_NAME}`);
    expect(brandedSubject('Νέα αγγελία')).toBe(`Νέα αγγελία — ${PRODUCT_NAME}`);
    expect(brandedSubject('Θέμα')).not.toContain('ΝΕΣΤΩΡ');
  });

  it('Β4 🔴🔴 Ο ΦΡΟΥΡΟΣ ΤΗΣ ΟΥΡΑΣ — θέμα με ΠΑΛΙΑ γραφή ΔΕΝ διπλοϋπογράφεται', () => {
    // 🔴 Ο πραγματικός κίνδυνος της μετονομασίας (ADR-857 §3 Δ): τα ήδη γραμμένα `pending`
    //    έγγραφα κουβαλούν το παλιό επίθεμα **για πάντα**. Χωρίς αυτόν τον φρουρό, ένα
    //    ουραγμένο «Νέα αγγελία — ΝΕΣΤΩΡ» θα έφευγε ως «… — ΝΕΣΤΩΡ — Nestor App».
    // ⚠️ Ο έλεγχος είναι `endsWith`, ΠΟΤΕ `contains`: το «Nestor» είναι **υποσυμβολοσειρά**
    //    του «Nestor App», οπότε ένα `not.toContain` θα ήταν μονίμως κόκκινο.
    for (const past of KNOWN_PAST_SPELLINGS) {
      expect(brandedSubject(`Νέα αγγελία — ${past}`)).toBe(`Νέα αγγελία — ${past}`);
    }
    expect(everyLanguageHasWording()).toBe(true);
  });

  it('Β5 🔴 Η ΡΙΖΑ — ΚΑΝΕΝΑΣ παραγωγός ειδοποιήσεων δεν γράφει πια τη μάρκα', () => {
    // ⚠️ Στατική άγκυρα σε **και τους τέσσερις** ιδιοκτήτες. Η προηγούμενη κατάσταση
    //    δεν ήταν «λάθος σε ένα αρχείο» — ήταν **τέσσερις ανεξάρτητες αποφάσεις** για
    //    το ίδιο ερώτημα, εκ των οποίων μία έλεγε «όχι» χωρίς να το ξέρει κανείς.
    const producers = [
      'src/services/demand/interest-notifier.service.ts',
      'src/services/demand/listing-match-notifier.service.ts',
      'src/services/mandate/mandate-decision-notifier.service.ts',
      'src/services/mandate/mandate-request-notifier.service.ts',
    ];
    for (const producer of producers) {
      const source = readFileSync(join(process.cwd(), producer), 'utf8');
      expect(source).not.toContain('ΝΕΣΤΩΡ');
    }
  });

  it('Β6 🔴 — ο αποστολέας σφραγίζει ΚΑΙ ΤΙΣ ΔΥΟ διαδρομές (μοναχικό + σύνοψη)', () => {
    // Ένα από τα δύο σημεία ξεχασμένο θα σήμαινε ότι η υπογραφή εξαφανίζεται
    // ακριβώς όταν ο άνθρωπος λαμβάνει **πολλά** — δηλαδή εκεί που μετράει.
    const sender = readFileSync(
      join(process.cwd(), 'src/lib/cron/jobs/outbound-email-flush.job.ts'),
      'utf8',
    );
    // 🔗 ADR-848 — ο φάκελος του ΜΟΝΑΧΙΚΟΥ (υπογραφή · σύνδεσμοι · κεφαλίδες) μετακόμισε
    //    στο `notification-email-envelope.ts`. Η ερώτηση μένει ίδια — «σφραγίζονται ΚΑΙ
    //    οι δύο διαδρομές;» — αλλά απαντιέται πλέον σε δύο αρχεία, ένα ανά διαδρομή.
    const envelope = readFileSync(
      join(process.cwd(), 'src/server/notifications/notification-email-envelope.ts'),
      'utf8',
    );
    // Η εισαγωγή δεν μετράει — γράφεται χωρίς παρένθεση.
    expect(sender.split('brandedSubject(').length - 1).toBe(1); // deliverDigest (σύνοψη)
    expect(envelope.split('brandedSubject(').length - 1).toBe(1); // soloEnvelope (μοναχικό)
    // …και ο αγωγός ΟΝΤΩΣ περνά το μοναχικό από τον φάκελο, όχι από δική του γραφή.
    expect(sender).toContain('soloEnvelope(');
  });
});
