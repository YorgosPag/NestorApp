/**
 * Άγκυρα — **ΤΑ ΧΕΙΡΙΣΤΗΡΙΑ ΛΕΝΕ ΤΗΝ ΑΛΗΘΕΙΑ ΓΙΑ ΤΟ ΤΙ ΦΙΛΤΡΑΡΟΥΝ** *(ADR-846 §9 #12)*.
 *
 * ## Το περιστατικό που κλείνει — μετρημένο στην οθόνη, όχι υποθετικό
 *
 * Στο `/pro?lat=40.6307&lng=22.9469&r=5` η οθόνη έλεγε **ταυτόχρονα** *«10 από 22»* και
 * **«Όλη η Ελλάδα»**. Το φίλτρο δούλευε· **η οθόνη ψευδόταν**.
 *
 * 🎯 **Η αιτία σε μία γραμμή** — `WhereControl`:
 * ```tsx
 * const areaId = where !== null && isAdministrativeWhere(where) ? where.adminId : '';
 * {areaId === '' ? t(DIRECTORY_KEYS.placeAll) : t(DIRECTORY_KEYS.areaHint)}
 * ```
 * Το `ShowcaseWhere | null` έχει **τρεις** καταστάσεις· ο τελεστής τις ισοπέδωνε σε
 * **δύο**, και το σκέλος `circle` έπεφτε **στον κάδο του «δεν φιλτράρω»**.
 *
 * ## Γιατί καμία από τις υπάρχουσες δοκιμές δεν το έβλεπε
 *
 * ⚠️ **Καμία δεν απέδιδε το `AgencyDirectoryFilters` με `where = { circle }`.** Το ίδιο
 * ακριβώς σχήμα με τη **§7.1** *(η `presenceMatches` άλλαξε υπογραφή και **καμία από τις
 * 277** δοκιμές του `components/mandate` δεν περνούσε ενεργό ερώτημα στην κάρτα)*. Η
 * θεραπεία και εκεί και εδώ είναι η ίδια: **άγκυρα που ΕΚΤΕΛΕΙ το σκέλος**.
 *
 * ## Τι φυλάει
 *
 * ✅ **Κ1** — ερώτημα-**κύκλος**: η οθόνη **ΔΕΝ** λέει «Όλη η Ελλάδα». *(Η καρδιά του #12.)*
 * ✅ **Κ2** — και λέει την **ακτίνα με λέξεις**, όχι σιωπή.
 * ✅ **Κ3** — με **μετρημένο** αγκυροβόλιο, λέει και **πού**.
 * ✅ **Κ4** — **παρονομαστής**: χωρίς άξονα τόπου λέει **πράγματι** «Όλη η Ελλάδα»
 *    *(αλλιώς ένα «μη λες ποτέ placeAll» θα περνούσε το Κ1 θριαμβευτικά)*.
 * ✅ **Κ5** — **παρονομαστής**: διοικητική περιοχή κρατά το **δικό της** κείμενο, που λέει
 *    *«η σειρά τους δεν αλλάζει»* — αλήθεια **μόνο** εκεί.
 * ✅ **Κ6** — 🔴 **ΤΟ ΚΕΙΜΕΝΟ ΤΗΣ ΣΕΙΡΑΣ ΔΕΝ ΤΑΞΙΔΕΥΕΙ ΣΤΟΝ ΚΥΚΛΟ**: με κέντρο, το
 *    `orderAgencies` ταξινομεί **κατά απόσταση** — άρα το «δεν αλλάζει τη σειρά» θα ήταν
 *    **δεύτερο ψέμα**, γεννημένο από την ίδια ισοπέδωση.
 * ✅ **Κ7** — 🔒 **ΟΛΙΚΟΤΗΤΑ**: κάθε σκέλος της `ShowcaseWhereVoice` έχει κλειδί, και κάθε
 *    κλειδί **επιλύεται** στα locale. Ένα πέμπτο σκέλος δεν μεταγλωττίζεται· ένα κλειδί
 *    χωρίς κείμενο θα ζωγράφιζε **λατινικά στην οθόνη**, και ο μεταγλωττιστής **δεν** το βλέπει.
 *
 * @module components/mandate/__tests__/where-control-truth
 * @see ADR-846 §8.8.19 · `lib/agency/showcase-where-voice` · `AgencyDirectoryFilters`
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  showcaseWhereVoice,
  type ShowcaseWhereVoice,
} from '@/lib/agency/showcase-where-voice';
import type { ShowcaseFilters } from '@/lib/agency/showcase-filter';

/**
 * 🔑 **Τα δύο χειριστήρια-αδέλφια μοκάρονται, ο υπαινιγμός ΟΧΙ.** Ο `AreaCombobox`
 * σέρνει το `SearchableCombobox` και την ιεραρχία των 3,9 MB· το `OccupationSelect`
 * σέρνει Radix. Τίποτα από τα δύο **δεν κρίνεται εδώ** — και μια αποτυχία τους θα έβαφε
 * κόκκινη αυτή την άγκυρα για λόγο **άσχετο** με ό,τι φυλάει.
 *
 * ⛔ **Ο `WhereHint` ΔΕΝ μοκάρεται ΠΟΤΕ** — είναι το υποκείμενο.
 */
jest.mock('../AreaCombobox', () => ({
  AreaCombobox: ({ value }: { value: string }) => <input readOnly value={value} />,
}));

jest.mock('../OccupationSelect', () => ({
  OccupationSelect: () => <span />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

// 🔑 **Ο επιλύτης ζει ΜΙΑ φορά** *(N.18)* — δες `lib/agency/__fixtures__/el-translate`.
//    Ήταν έτοιμος να γίνει τρίτο αντίγραφο, και το τρίτο αντίγραφο θα ήταν το μόνο που
//    ξέρει ICU plural — δηλαδή τρεις άγκυρες με **τρεις** ορισμούς του «τι βλέπει ο χρήστης».
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    i18n: { language: 'el' },
    t: jest.requireActual('@/lib/agency/__fixtures__/el-translate').elTranslate,
  }),
}));

import { AgencyDirectoryFilters } from '../AgencyDirectoryFilters';

import { EL_DIRECTORY as DIRECTORY } from '@/lib/agency/__fixtures__/el-translate';

const CENTRE = { lat: 40.6307, lng: 22.9469 };

function renderFilters(filters: ShowcaseFilters, anchor: string | null): void {
  render(
    <AgencyDirectoryFilters
      filters={filters}
      options={[]}
      locale="el"
      onChange={jest.fn()}
      onClear={null}
      whereVoice={showcaseWhereVoice(filters.where, anchor)}
    />,
  );
}

const CIRCLE: ShowcaseFilters = {
  occupation: null,
  where: { circle: { center: CENTRE, radiusKm: 5 } },
};

describe('ADR-846 §9 #12 — Α: το ερώτημα-ΚΥΚΛΟΣ παύει να λέει «Όλη η Ελλάδα»', () => {
  // ===========================================================================
  // 🔴 Κ1 — Η ΑΓΚΥΡΑ. Αυτή ακριβώς η πρόταση ήταν το ψέμα στην οθόνη.
  // ===========================================================================
  it('🔴 Κ1 — με ενεργό κύκλο ΔΕΝ εμφανίζεται το «Όλη η Ελλάδα»', () => {
    renderFilters(CIRCLE, null);

    expect(screen.queryByText(DIRECTORY.placeAll)).not.toBeInTheDocument();
  });

  it('Κ2 — και λέει την ΑΚΤΙΝΑ με λέξεις, χωρίς να ξέρει τον τόπο', () => {
    renderFilters(CIRCLE, null);

    expect(
      screen.getByText(DIRECTORY.placeCircleHint.replaceAll('{km}', '5')),
    ).toBeInTheDocument();
  });

  it('🏆 Κ3 — με ΜΕΤΡΗΜΕΝΟ αγκυροβόλιο λέει και ΠΟΥ', () => {
    renderFilters(CIRCLE, 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ');

    const expected = DIRECTORY.placeCircleHintNamed
      .replaceAll('{km}', '5')
      .replaceAll('{area}', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ');
    expect(screen.getByText(expected)).toBeInTheDocument();
    // ⛔ Και **ποτέ** ωμές συντεταγμένες — ό,τι κι αν πάει στραβά με το αγκυροβόλιο.
    expect(screen.queryByText(/40\.63|22\.94/)).not.toBeInTheDocument();
  });
});

describe('ADR-846 §9 #12 — Β: οι ΠΑΡΟΝΟΜΑΣΤΕΣ (χωρίς αυτούς το Α είναι κενό)', () => {
  // ===========================================================================
  // Κ4 — Χωρίς αυτό, μια υλοποίηση που **ποτέ** δεν λέει «Όλη η Ελλάδα» περνά το Κ1.
  // ===========================================================================
  it('Κ4 — χωρίς άξονα τόπου λέει ΠΡΑΓΜΑΤΙ «Όλη η Ελλάδα»', () => {
    renderFilters({ occupation: null, where: null }, null);

    expect(screen.getByText(DIRECTORY.placeAll)).toBeInTheDocument();
  });

  it('Κ5 — διοικητική περιοχή κρατά το ΔΙΚΟ της κείμενο', () => {
    renderFilters({ occupation: null, where: { adminId: 'municipality:0701' } }, null);

    expect(screen.getByText(DIRECTORY.areaHint)).toBeInTheDocument();
    expect(screen.queryByText(DIRECTORY.placeAll)).not.toBeInTheDocument();
  });

  // ===========================================================================
  // 🔴 Κ6 — ΤΟ ΔΕΥΤΕΡΟ ΨΕΜΑ ΤΗΣ ΙΔΙΑΣ ΙΣΟΠΕΔΩΣΗΣ.
  //
  //     Το `areaHint` υπόσχεται *«Η σειρά τους δεν αλλάζει από αυτό»*. Είναι αλήθεια
  //     **μόνο** στο διοικητικό σκέλος: το `whereCenter` δίνει κέντρο μόνο στον κύκλο,
  //     άρα το `orderAgencies` τρέχει με `from !== null` και ταξινομεί **κατά απόσταση**.
  //     Μια «διόρθωση» που απλώς έδειχνε το `areaHint` και στον κύκλο θα περνούσε τα
  //     Κ1–Κ2 και θα εγκαθιστούσε **νέο** ψέμα στη θέση του παλιού.
  // ===========================================================================
  it('🔴 Κ6 — ο κύκλος ΔΕΝ δανείζεται το κείμενο «δεν αλλάζει τη σειρά»', () => {
    renderFilters(CIRCLE, 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ');

    expect(screen.queryByText(DIRECTORY.areaHint)).not.toBeInTheDocument();
  });
});

describe('ADR-846 §9 #12 — Γ: η ΟΛΙΚΟΤΗΤΑ, που ο μεταγλωττιστής δεν βλέπει ολόκληρη', () => {
  /**
   * 🔒 **Ο `Record<ShowcaseWhereVoice['kind'], string>` πιάνει το σκέλος χωρίς ΚΛΕΙΔΙ.
   * ΔΕΝ πιάνει το κλειδί χωρίς ΚΕΙΜΕΝΟ.** Το δεύτερο ζωγραφίζει
   * `property-market:mandate.directory.…` **στην οθόνη ενός επισκέπτη** — και είναι
   * ακριβώς το σχήμα που κυνηγά το CHECK 3.51 *(ωμά i18n κλειδιά στο SSR HTML)*.
   *
   * ⚠️ Και ο πράκτορας **δεν τρέχει `tsc`** *(N.17)*, άρα ούτε το πρώτο μισό
   * επικυρώνεται πριν το commit. Αυτή η ομάδα καλύπτει **και τα δύο**, εκτελώντας.
   */
  const EVERY_VOICE: readonly ShowcaseWhereVoice[] = [
    { kind: 'nationwide' },
    { kind: 'administrative' },
    { kind: 'circlePlain', radiusKm: 5 },
    { kind: 'circleAnchored', radiusKm: 5, anchor: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ' },
  ];

  it.each(EVERY_VOICE.map((voice) => [voice.kind, voice] as const))(
    '🔒 Κ7 — το σκέλος «%s» ζωγραφίζει ΚΕΙΜΕΝΟ, ποτέ ωμό κλειδί',
    (_kind, voice) => {
      render(
        <AgencyDirectoryFilters
          filters={{ occupation: null, where: null }}
          options={[]}
          locale="el"
          onChange={jest.fn()}
          onClear={null}
          whereVoice={voice}
        />,
      );

      // Ωμό κλειδί αναγνωρίζεται αλάνθαστα: κουβαλά το πρόθεμα του namespace.
      expect(screen.queryByText(/property-market:/)).not.toBeInTheDocument();
      // …και καμία παράμετρος δεν μένει αντικατάστατη.
      expect(screen.queryByText(/\{km\}|\{area\}/)).not.toBeInTheDocument();
    },
  );
});
