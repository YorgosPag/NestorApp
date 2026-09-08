/**
 * @jest-environment jsdom
 *
 * @fileoverview **Η ΦΩΝΗ ΤΟΥ ΔΗΜΟΣΙΕΥΜΕΝΟΥ ΣΗΜΑΤΟΣ** — οι άγκυρες του ADR-841 §7 Α21.13.
 * @related components/mandate/ShowcaseMarkFidelityNote · lib/agency/showcase-mark-fidelity
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΜΙΣΟ ΑΥΤΗΣ ΤΗΣ ΣΟΥΙΤΑΣ ΕΙΝΑΙ Η **ΣΙΩΠΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Άγκυρα που δείχνει μόνο ότι *«εμφανίζεται προειδοποίηση»* μένει **πράσινη** και όταν η
 * προειδοποίηση εμφανίζεται **πάντα** — δηλαδή ακριβώς στην περίπτωση που ο μηχανισμός
 * είναι **άχρηστος θόρυβος**. Και δεν είναι υποθετικό: η πρώτη γραφή της Α21.13, με τον
 * κριτή όπως τον βρήκε, θα κρεμούσε μόνιμη προειδοποίηση πάνω στο **πραγματικό σήμα του
 * Giorgio** *(512×122)*. Το βρήκε ο **παρονομαστής**, όχι ο αριθμητής.
 *
 * ⚠️ **Το `t()` επιστρέφει κλειδί ΚΑΙ ορίσματα**: η οθόνη δεν διαλέγει μόνο *ποιο* μήνυμα
 * αλλά και *με ποια νούμερα*, και το δεύτερο είναι που αλλάζει στην Α21.13 *(το `ideal`
 * έγινε αριθμός **του σήματος**)*. Ένα mock που πετά τα ορίσματα θα άφηνε τη μισή αλλαγή
 * ανεπαλήθευτη.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { ShowcaseMarkFidelityNote } from '../ShowcaseMarkFidelityNote';
import { SHOWCASE_MARK_ADVICE_KEYS, SHOWCASE_MARK_KEYS } from '../agency-showcase-labels';
import { SHOWCASE_MARK_KINDS, type ShowcaseMarkKind } from '@/lib/agency/showcase-mark-kind';
import type { DeclaredShowcaseMark } from '@/types/agency-profile';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key}|${JSON.stringify(params)}`,
    i18n: { language: 'el' },
  }),
}));

function mark(kind: ShowcaseMarkKind, width: number, height: number): DeclaredShowcaseMark {
  return {
    kind,
    image: {
      url: 'https://example.test/mark.webp',
      width,
      height,
      altKey: 'alt',
      sources: [{ url: 'https://example.test/mark.webp', width }],
    },
  };
}

/** Το ωμό κείμενο της σημείωσης, ή `null` όταν **δεν ζωγραφίστηκε τίποτα**. */
function noteText(published: DeclaredShowcaseMark): string | null {
  const { container } = render(<ShowcaseMarkFidelityNote published={published} />);
  return container.textContent === '' ? null : container.textContent;
}

// ===========================================================================

describe('🔴 Α21.13 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η σιωπή είναι το μισό της δουλειάς', () => {
  it('🔴 ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΣΗΜΑ (512×122) ΔΕΝ ΖΩΓΡΑΦΙΖΕΙ ΤΙΠΟΤΑ', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα τον κριτή στο «μικρή πλευρά ≥ 192» ⇒ αυτή η γραμμή
    //    κοκκινίζει, και ο Giorgio βλέπει μόνιμη προειδοποίηση στο δικό του σήμα.
    expect(noteText(mark('logo', 512, 122))).toBeNull();
  });

  it('🔑 σωπαίνει σε ΚΑΘΕ επαρκές σήμα, και στα δύο είδη', () => {
    for (const published of [
      mark('portrait', 192, 192),
      mark('portrait', 512, 512),
      mark('logo', 192, 192),
      mark('logo', 384, 128),
    ]) {
      expect(noteText(published)).toBeNull();
    }
  });
});

describe('🔴 Α21.13 — ΟΤΑΝ ΜΙΛΑ: λέει ΠΟΥ φαίνεται θολό ΚΑΙ τι να κάνει ο άνθρωπος', () => {
  it('🏆 δύο προτάσεις: η ζώνη που δεν καλύπτεται ΚΑΙ η οδηγία', () => {
    const text = noteText(mark('logo', 100, 100));

    expect(text).toContain(SHOWCASE_MARK_KEYS.blurryPage);
    expect(text).toContain(SHOWCASE_MARK_ADVICE_KEYS.logo);
  });

  it('🏆 το «ideal» είναι ΤΟΥ ΣΗΜΑΤΟΣ — 192 για τετράγωνο, λιγότερα για wordmark', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: ξαναδέσε το `ideal` σε σταθερά ⇒ οι δύο γραμμές γίνονται ίδιες,
    //    και ο wordmark ξαναζητά **50% παραπάνω** απ' όσο χρειάζεται.
    expect(noteText(mark('logo', 100, 100))).toContain('"ideal":192');
    expect(noteText(mark('logo', 300, 100))).toContain('"ideal":128');
  });

  it('🔑 δείχνει τη ΜΙΚΡΗ πλευρά του ΔΗΜΟΣΙΕΥΜΕΝΟΥ σήματος, όχι του αρχείου', () => {
    // Το αρχείο ήταν 200×200· ο καθαριστής έγραψε 40×40. Η οθόνη λέει **40**.
    expect(noteText(mark('logo', 40, 40))).toContain('"shortest":40');
  });

  it('🔴 ΚΑΜΙΑ ΑΡΝΗΣΗ: σήμα κάτω από το ελάχιστο ΜΙΛΑ, δεν απορρίπτεται', () => {
    // ⚠️ Είναι **ήδη δημοσιευμένο** — δεν υπάρχει τίποτα να απορριφθεί αναδρομικά.
    const text = noteText(mark('logo', 40, 40));

    expect(text).toContain(SHOWCASE_MARK_KEYS.blurryEverywhere);
    expect(text).not.toContain(SHOWCASE_MARK_KEYS.tooSmall);
  });

  it('🔴 ΔΕΝ ΚΟΚΚΙΝΙΖΕΙ: μια πράξη που πέτυχε δεν είναι σφάλμα', () => {
    const { container } = render(<ShowcaseMarkFidelityNote published={mark('logo', 100, 100)} />);
    const note = container.firstElementChild;

    expect(note?.className).toContain('text-muted-foreground');
    expect(note?.className).not.toContain('destructive');
    // ⚠️ Καμία ζωντανή περιοχή: **δεν συνέβη τίποτα τώρα** — η πληροφορία ήταν πάντα εκεί.
    expect(note?.getAttribute('aria-live')).toBeNull();
    expect(note?.getAttribute('role')).toBeNull();
  });
});

describe('🔴 Α21.13 — Η ΟΔΗΓΙΑ ΕΙΝΑΙ ΑΛΗΘΕΙΑ ΑΝΑ ΕΙΔΟΣ, ΟΧΙ ΦΙΛΟΛΟΓΙΑ', () => {
  it('🔴 το ΠΟΡΤΡΕΤΟ ΔΕΝ ακούει «αφαίρεσε το κενό» — δεν τρίβεται ποτέ', () => {
    // 🔑 Το τρίμμα *(Α21.10)* αφορά **μόνο** το λογότυπο. Ένα κοινό κείμενο θα έστελνε τον
    //    άνθρωπο να κόψει τη φωτογραφία του **χωρίς λόγο** — ψέμα με τη μορφή βοήθειας.
    const text = noteText(mark('portrait', 100, 100));

    expect(text).toContain(SHOWCASE_MARK_ADVICE_KEYS.portrait);
    expect(text).not.toContain(SHOWCASE_MARK_ADVICE_KEYS.logo);
  });

  it('🔑 ΚΑΘΕ είδος έχει δική του οδηγία, και η οθόνη τη διαλέγει από τον πίνακα', () => {
    // 🔴 Ο `Record<ShowcaseMarkKind, string>` σπάει τη μεταγλώττιση για τρίτο είδος χωρίς
    //    κείμενο· αυτή η άγκυρα φυλά ότι το κείμενο **φτάνει και στην οθόνη**.
    for (const kind of SHOWCASE_MARK_KINDS) {
      expect(noteText(mark(kind, 70, 70))).toContain(SHOWCASE_MARK_ADVICE_KEYS[kind]);
    }
  });

  it('🔑 οι οδηγίες είναι ΔΙΑΚΡΙΤΕΣ — αλλιώς ο πίνακας δεν θα είχε λόγο ύπαρξης', () => {
    const keys = SHOWCASE_MARK_KINDS.map((kind) => SHOWCASE_MARK_ADVICE_KEYS[kind]);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('🔴 Α21.13 — ΤΟ ΜΗΝΥΜΑ ΤΗΣ ΖΩΝΗΣ ΔΙΑΒΑΖΕΙ ΤΑ ΔΥΟ ΚΑΤΗΓΟΡΗΜΑΤΑ', () => {
  it('🔴 κάτω από την κάρτα ⇒ «θολό παντού»· πάνω από την κάρτα ⇒ «θολό στη σελίδα»', () => {
    // ⚠️ Η παλιά γραφή διάβαζε **ένα** κατηγόρημα για **δύο** ερωτήματα και ανακοίνωνε
    //    «θολό στη σελίδα» για εικόνα που τη σελίδα την κάλυπτε.
    expect(noteText(mark('logo', 70, 70))).toContain(SHOWCASE_MARK_KEYS.blurryEverywhere);
    expect(noteText(mark('logo', 100, 100))).toContain(SHOWCASE_MARK_KEYS.blurryPage);
  });

  it('🔑 ΠΟΤΕ και τα δύο μηνύματα μαζί — μία πρόταση για ένα γεγονός', () => {
    for (const published of [mark('logo', 70, 70), mark('logo', 100, 100), mark('portrait', 100, 100)]) {
      const text = noteText(published) ?? '';
      const both =
        text.includes(SHOWCASE_MARK_KEYS.blurryEverywhere) &&
        text.includes(SHOWCASE_MARK_KEYS.blurryPage);

      expect(both).toBe(false);
    }
  });
});

describe('🔴 Α21.13 — Η ΣΗΜΕΙΩΣΗ ΖΕΙ ΣΤΟ ΠΕΔΙΟ, ΟΧΙ ΣΤΗ ΓΡΑΜΜΗ ΚΑΤΑΣΤΑΣΗΣ', () => {
  it('🔴 το πεδίο τη ζωγραφίζει ΜΟΝΟ όταν υπάρχει δημοσιευμένο σήμα', () => {
    // 🔑 Η άγκυρα ρωτά το **ίδιο το αρχείο** του πεδίου: ένα render θα χρειαζόταν
    //    ολόκληρο το hook του ανεβάσματος, και θα έκρινε τον ορχηστρωτή αντί για τη
    //    **σύνδεση** — που είναι το μόνο που αλλάζει εδώ.
    const field = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/components/mandate/ShowcaseMarkField.tsx'),
      'utf8',
    ) as string;

    expect(field).toContain('ShowcaseMarkFidelityNote published={chooser.published}');
    // ⚠️ Η κατάσταση `warned` του ανεβάσματος **διαγράφηκε** (Α21.13.6): αν επιστρέψει,
    //    ο άνθρωπος ακούει δύο φωνές για το ίδιο πράγμα.
    expect(field).not.toContain("state.state === 'warned'");
  });
});
