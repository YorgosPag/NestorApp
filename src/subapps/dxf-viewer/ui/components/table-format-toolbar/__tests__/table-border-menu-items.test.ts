/**
 * ADR-750 Φάση 3 — **τι δείχνει το μενού**, και η πύλη που το static tooling δεν έχει.
 *
 * ## 🔴 Γιατί υπάρχει το δεύτερο `describe`
 * Τα ονόματα των εντολών επιλύονται με **δυναμικό** κλειδί
 * (``t(`table.borders.commands.${command.id}`)``), γιατί η ταυτότητα **είναι** ήδη το κλειδί και
 * ένας χειρόγραφος πίνακας 13 γραμμών θα ήταν δεύτερη δήλωση της ίδιας γνώσης. Η τιμή που
 * πληρώνεται είναι ότι η **CHECK 3.8** (missing i18n keys) ψάχνει `t('literal')` και **δεν
 * βλέπει τίποτα εδώ** — το ίδιο σχήμα «0 = κανείς δεν κοίταξε» που περιγράφει ο N.11 για τα ωμά
 * ελληνικά σε JSX.
 *
 * Το κενό κλείνει εδώ, με τον μόνο τρόπο που το κλείνει πραγματικά: διαβάζοντας τα **αληθινά**
 * locale JSON και το **αληθινό** μητρώο, και απαιτώντας να συμφωνούν και στις δύο γλώσσες.
 * Χωρίς αυτό, μια εντολή που θα προστεθεί αύριο θα έβαφε ωμό κλειδί στην οθόνη.
 */

import el from '@/i18n/locales/el/dxf-viewer.json';
import en from '@/i18n/locales/en/dxf-viewer.json';
import { tableBorderMenuItems } from '../table-border-menu-items';
import { TABLE_BORDER_COMMANDS } from '../../../../bim/table/table-range-border-ops';

/** Ακολουθεί κλειδί με τελείες μέσα σε φορτωμένο locale· `undefined` όταν λείπει. */
function lookup(locale: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) =>
      node !== null && typeof node === 'object'
        ? (node as Record<string, unknown>)[part]
        : undefined,
    locale,
  );
}

describe('ADR-750 Φ3 — τα στοιχεία του μενού βγαίνουν από το μητρώο', () => {
  it('✅ Φ5 — δείχνει και τις ΔΕΚΑΤΡΕΙΣ· καμία δεν κόβεται πλέον (Α17 → Α24)', () => {
    const shown = tableBorderMenuItems().map((item) => item.command.id);
    expect(shown).toEqual(TABLE_BORDER_COMMANDS.map((c) => c.id));
    expect(shown).toHaveLength(13);
    // Οι δύο που έλειπαν όσο η διπλή γραμμή ήταν τρύπα — το ρητό ίχνος που ζήτησε η Α17.
    expect(shown).toContain('doubleBottom');
    expect(shown).toContain('topAndDoubleBottom');
  });

  it('κρατά τη ΣΕΙΡΑ του μητρώου — δηλαδή τη μετρημένη σειρά του Excel', () => {
    const shown = tableBorderMenuItems().map((item) => item.command.id);
    expect(shown).toEqual(TABLE_BORDER_COMMANDS.map((c) => c.id));
  });

  it('🔴 τα διαχωριστικά προκύπτουν από το `group`, όχι από σταθερές θέσεις', () => {
    // 🔑 Η ΑΠΟΔΕΙΞΗ ΤΟΥ ΣΧΕΔΙΑΣΜΟΥ: όσο έλειπε η `doubleBottom`, το δεύτερο διαχωριστικό
    // έπεφτε στη θέση **7**· με τις 13 πέφτει στη **8**. Ο κώδικας δεν άλλαξε γραμμή — μια
    // χειρόγραφη λίστα θέσεων («μετά την 4η και την 8η») θα ήταν λάθος τη μια από τις δύο
    // φορές, σιωπηλά.
    const items = tableBorderMenuItems();
    const separatorsAt = items.flatMap((item, index) => (item.startsGroup ? [index] : []));
    expect(separatorsAt).toEqual([4, 8]);
    // Και κάθε διαχωριστικό πέφτει όντως σε αλλαγή ομάδας.
    for (const index of separatorsAt) {
      expect(items[index].command.group).not.toBe(items[index - 1].command.group);
    }
  });

  it('το πρώτο στοιχείο ΔΕΝ ανοίγει ομάδα — δεν υπάρχει τίποτα να χωρίσει', () => {
    expect(tableBorderMenuItems()[0].startsGroup).toBe(false);
  });
});

describe('🔴 i18n — η πύλη που η CHECK 3.8 δεν μπορεί να κάνει (δυναμικά κλειδιά)', () => {
  // ✅ Η Φ3 κατέγραψε και τα 13 ονόματα ενώ μόνο 11 φαίνονταν, «όσο υπήρχε η απόδειξη» (το
  // στιγμιότυπο του §8.1). Η Φ5 άναψε τα δύο υπόλοιπα και **δεν χρειάστηκε ούτε ένα κλειδί**.
  it.each(TABLE_BORDER_COMMANDS.map((c) => c.id))(
    '«%s»: υπάρχει όνομα και στα ΔΥΟ locale, μη κενό',
    (id) => {
      const key = `table.borders.commands.${id}`;
      expect(typeof lookup(el, key)).toBe('string');
      expect(typeof lookup(en, key)).toBe('string');
      expect(String(lookup(el, key)).length).toBeGreaterThan(0);
      expect(String(lookup(en, key)).length).toBeGreaterThan(0);
    },
  );

  it.each(['table.borders.trigger', 'table.borders.menuLabel', 'table.borders.resetBorders'])(
    '«%s»: υπάρχει και στα δύο locale',
    (key) => {
      expect(typeof lookup(el, key)).toBe('string');
      expect(typeof lookup(en, key)).toBe('string');
    },
  );

  it('🔑 Α18 — το #12 γράφει «παχύ», ΟΧΙ «πλατύ» (δεν αντιγράφουμε την ασυνέπεια)', () => {
    const label = String(lookup(el, 'table.borders.commands.topAndThickBottom'));
    expect(label).toContain('παχύ');
    expect(label).not.toContain('πλατύ');
  });

  it('🔴 Α19 — καμία ΔΥΟ εντολές του toolbar δεν μοιράζονται ταυτόσημο ορατό κείμενο', () => {
    // Η σύγκρουση που κανένα test δεν έβλεπε: «Επαναφορά στο στυλ» υπήρχε ήδη για το στυλ
    // κειμένου, και η Φ2 γέννησε δεύτερη πράξη με το ίδιο ακριβώς νόημα για τα περιγράμματα.
    // Δύο κουμπιά με ίδιο κείμενο σε απόσταση εκατοστών είναι ελάττωμα που βλέπει κάθε χρήστης.
    const toolbarLabels = [
      ...Object.values(lookup(el, 'table.formatToolbar') as Record<string, string>),
      String(lookup(el, 'table.borders.trigger')),
      String(lookup(el, 'table.borders.resetBorders')),
      ...Object.values(lookup(el, 'table.borders.commands') as Record<string, string>),
    ];
    expect(new Set(toolbarLabels).size).toBe(toolbarLabels.length);
  });

  it('το παλιό κλειδί `resetToStyle` έχει φύγει — αλλιώς θα ζούσαν δύο ονόματα μαζί', () => {
    expect(lookup(el, 'table.formatToolbar.resetToStyle')).toBeUndefined();
    expect(lookup(en, 'table.formatToolbar.resetToStyle')).toBeUndefined();
  });
});
