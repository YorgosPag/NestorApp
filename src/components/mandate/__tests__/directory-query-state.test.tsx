/**
 * Άγκυρα — **ΤΟ ΑΦΑΙΡΟΥΜΕΝΟ ΣΗΜΑΔΙ: ΟΝΟΜΑΖΕΙ, ΑΦΑΙΡΕΙ ΜΟΝΟ ΤΟΝ ΤΟΠΟ, ΔΕΝ ΧΑΝΕΙ ΕΣΤΙΑΣΗ.**
 *
 * ## Γιατί υπάρχει
 *
 * Το §9 #12 ζήτησε να **φαίνεται** το ενεργό ερώτημα-κύκλο. Η βιομηχανική απάντηση
 * *(NN/g: «δείξε τα εφαρμοσμένα φίλτρα, με αφαίρεση ενός κλικ **ανά φίλτρο**»)* είναι
 * αφαιρούμενο σημάδι. Αλλά ένα σημάδι έχει **τρεις** τρόπους να είναι λάθος, και οι δύο
 * είναι **αόρατοι** σε οπτικό έλεγχο:
 *
 * | # | Η αστοχία | Ποιος τη βλέπει |
 * |---|---|---|
 * | 1 | αφαιρεί **περισσότερα** από όσα ονομάζει | ο χρήστης, όταν χάσει την ειδικότητά του |
 * | 2 | το `×` δεν λέει **τι** σβήνει | **μόνο** αναγνώστης οθόνης |
 * | 3 | η εστίαση πέφτει στο `<body>` μετά την αφαίρεση | **μόνο** χρήστης πληκτρολογίου |
 *
 * 🏆 **Το (3) είναι μετρημένο ελάττωμα των μεγάλων** *(Zillow/Redfin)* και η σύσταση
 * *(Adrian Roselli, «where to put focus when deleting a thing»)* είναι ρητή: μετακίνησε
 * την εστίαση σε **γείτονα μέσα στην ίδια δομή**, **πριν** φύγει ο κόμβος.
 *
 * ## Τι φυλάει
 *
 * ✅ **Κ1** — το σημάδι **υπάρχει** σε ερώτημα-κύκλο και **ονομάζει** τον τόπο.
 * ✅ **Κ2** — **παρονομαστής**: **δεν** υπάρχει όταν το χειριστήριο δείχνει ήδη την τιμή.
 * ✅ **Κ3** — το `×` έχει προσβάσιμο όνομα που **περιέχει το ορατό κείμενο** *(WCAG 2.5.3)*.
 * ✅ **Κ4** — 🔴 αφαιρεί **ΜΟΝΟ** τον τόπο· η ειδικότητα **επιβιώνει**.
 * ✅ **Κ5** — 🔴 η εστίαση **προσγειώνεται στην περιοχή**, ποτέ στο `<body>`.
 * ✅ **Κ6** — ο μετρητής ζει σε **ζωντανή περιοχή** *(`role="status"`)*, με **παρονομαστή**.
 *
 * @module components/mandate/__tests__/directory-query-state
 * @see ADR-846 §8.8.19 · `DirectoryQueryState` · `components/ui/filter-chip`
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { showcaseWhereVoice } from '@/lib/agency/showcase-where-voice';

// 🔑 **Ο επιλύτης ζει ΜΙΑ φορά** *(N.18)* — δες `lib/agency/__fixtures__/el-translate`.
//    Ήταν έτοιμος να γίνει τρίτο αντίγραφο, και το τρίτο αντίγραφο θα ήταν το μόνο που
//    ξέρει ICU plural — δηλαδή τρεις άγκυρες με **τρεις** ορισμούς του «τι βλέπει ο χρήστης».
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    i18n: { language: 'el' },
    t: jest.requireActual('@/lib/agency/__fixtures__/el-translate').elTranslate,
  }),
}));

import { DirectoryQueryState } from '../DirectoryQueryState';

import { EL_DIRECTORY as DIRECTORY } from '@/lib/agency/__fixtures__/el-translate';

const CENTRE = { lat: 40.6307, lng: 22.9469 };
const AREA = 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ';

const CHIP_TEXT = DIRECTORY.whereChipCircleNamed
  .replaceAll('{km}', '5')
  .replaceAll('{area}', AREA);

function renderState(
  where: Parameters<typeof showcaseWhereVoice>[0],
  anchor: string | null,
  onClearWhere: () => void = jest.fn(),
): void {
  render(
    <DirectoryQueryState
      voice={showcaseWhereVoice(where, anchor)}
      shown={10}
      total={22}
      filtering={where !== null}
      onClearWhere={onClearWhere}
    />,
  );
}

const CIRCLE = { circle: { center: CENTRE, radiusKm: 5 } } as const;

describe('ADR-846 §9 #12 — Α: το σημάδι υπάρχει ΑΚΡΙΒΩΣ όπου χρειάζεται', () => {
  it('🏆 Κ1 — ερώτημα-κύκλος: το σημάδι υπάρχει και ΟΝΟΜΑΖΕΙ τον τόπο', () => {
    renderState(CIRCLE, AREA);

    expect(screen.getByText(CHIP_TEXT)).toBeInTheDocument();
    // ⛔ Ποτέ ωμές συντεταγμένες — το Zillow δεν τις δείχνει, ούτε εμείς.
    expect(screen.queryByText(/40\.63|22\.94/)).not.toBeInTheDocument();
  });

  // ===========================================================================
  // Κ2 — ΠΑΡΟΝΟΜΑΣΤΗΣ. Χωρίς αυτόν, ένα «βάλε σημάδι πάντα» περνά το Κ1 — και θα
  //      έλεγε δύο φορές το ίδιο πράγμα δίπλα σε χειριστήριο που το λέει ήδη.
  // ===========================================================================
  it.each([
    ['χωρίς άξονα τόπου', null],
    ['με διοικητική περιοχή', { adminId: 'municipality:0701' }],
  ] as const)('Κ2 — %s: ΚΑΝΕΝΑ σημάδι', (_label, where) => {
    renderState(where, AREA);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ADR-846 §9 #12 — Β: το «×» λέει τι σβήνει, και σβήνει ΜΟΝΟ αυτό', () => {
  // ===========================================================================
  // Κ3 — Ορατά, ένα «×» είναι αυτονόητο. Για αναγνώστη οθόνης, N ταυτόσημα
  //      «Αφαίρεση» είναι **μαντεψιά**. Η έρευνα το ζητά ρητά: «Remove filter» +
  //      το ΟΡΑΤΟ κείμενο.
  // ===========================================================================
  it('🔴 Κ3 — το προσβάσιμο όνομα ΠΕΡΙΕΧΕΙ το ορατό κείμενο (WCAG 2.5.3)', () => {
    renderState(CIRCLE, AREA);

    const remove = screen.getByRole('button');
    const name = remove.getAttribute('aria-label') ?? '';
    expect(name).toContain(CHIP_TEXT);
    // …και δεν είναι **μόνο** το ορατό κείμενο: λέει και τι θα συμβεί.
    expect(name).not.toBe(CHIP_TEXT);
  });

  // ===========================================================================
  // 🔴 Κ4 — Η ΠΑΓΙΔΑ ΠΟΥ ΔΕΝ ΦΑΙΝΕΤΑΙ: σημάδι που ονομάζει τον τόπο και σβήνει
  //      **και** την ειδικότητα. Ο άνθρωπος χάνει δουλειά που δεν ζήτησε να χάσει,
  //      και δεν καταλαβαίνει γιατί. Η άγκυρα ελέγχει το **περιεχόμενο** της
  //      πράξης, όχι ότι «κάτι κλήθηκε».
  // ===========================================================================
  it('🔴 Κ4 — αφαιρεί ΜΟΝΟ τον τόπο, ποτέ τους υπόλοιπους άξονες', () => {
    const onClearWhere = jest.fn();
    renderState(CIRCLE, AREA, onClearWhere);

    fireEvent.click(screen.getByRole('button'));

    expect(onClearWhere).toHaveBeenCalledTimes(1);
    // ⚠️ Το κατηγόρημα ζει στον γονέα *(`apply({ ...filters, where: null })`)*· εδώ
    //    φυλάμε ότι το σημάδι καλεί **τον στενό** χειριστή και **κανέναν άλλο** — μηδέν
    //    ορίσματα σημαίνει ότι δεν μπορεί να «περάσει» δεύτερο άξονα κρυφά.
    expect(onClearWhere).toHaveBeenCalledWith();
  });

  // ===========================================================================
  // 🔴 Κ5 — ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΜΟΝΟ ΧΡΗΣΤΗΣ ΠΛΗΚΤΡΟΛΟΓΙΟΥ ΒΛΕΠΕΙ.
  //
  //     Το κουμπί φεύγει από το DOM με το πάτημα. Αν η εστίαση ήταν πάνω του και
  //     κανείς δεν τη μετακινήσει, ο περιηγητής την πετά στο `<body>` — και ο
  //     άνθρωπος ξαναρχίζει το Tab από την κορυφή της σελίδας.
  //
  //     ⚠️ **Η άγκυρα μετρά την ΕΣΤΙΑΣΗ, όχι την ύπαρξη `ref`**: μια υλοποίηση με
  //     `ref` που δεν καλεί `focus()`, ή που το καλεί **μετά** την αφαίρεση, περνά
  //     κάθε οπτικό έλεγχο και κοκκινίζει **εδώ**.
  // ===========================================================================
  it('🔴 Κ5 — μετά την αφαίρεση η εστίαση προσγειώνεται στην ΠΕΡΙΟΧΗ, όχι στο body', () => {
    renderState(CIRCLE, AREA);

    const remove = screen.getByRole('button');
    remove.focus();
    expect(document.activeElement).toBe(remove);

    fireEvent.click(remove);

    const region = screen.getByRole('region', { name: DIRECTORY.queryStateLabel });
    expect(document.activeElement).toBe(region);
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('ADR-846 §9 #12 — Γ: ο αριθμός ανακοινώνεται, με παρονομαστή', () => {
  // ===========================================================================
  // Κ6 — Ο χρήστης αναγνώστη οθόνης που αλλάζει φίλτρο έχει την εστίαση στο
  //      χειριστήριο· η λίστα ενημερώνεται **αθόρυβα**. Χωρίς ζωντανή περιοχή δεν
  //      μαθαίνει ΠΟΤΕ ότι το πλήθος άλλαξε — δηλαδή το #12 θα έμενε ανοιχτό γι'
  //      αυτόν, ακόμη κι αφού κλείσει οπτικά.
  // ===========================================================================
  it('🔴 Κ6 — «10 από 22» ζει σε ζωντανή περιοχή, με ΚΑΙ ΤΟΥΣ ΔΥΟ αριθμούς', () => {
    renderState(CIRCLE, AREA);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('10');
    // 🔑 **Ο παρονομαστής είναι ο μισός λόγος ύπαρξης** *(Φ4: «7 από 34», ποτέ σκέτο «7»)*.
    expect(status).toHaveTextContent('22');
  });

  it('Κ6β — χωρίς φίλτρο λέει το ΠΛΗΘΟΣ, όχι κλάσμα', () => {
    renderState(null, null);

    expect(screen.getByRole('status')).toHaveTextContent('22');
  });
});
